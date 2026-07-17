import { useSyncExternalStore } from "react";
import { paneIds } from "./layout";
import type { ActivityState, Workspace } from "./types";

export interface ActivityTarget {
  workspaceId: string;
  tabId: string;
  paneId: string;
  sessionId: string;
}

export interface ActivityRecord extends ActivityTarget {
  state: ActivityState;
  command?: string;
  processName?: string;
  startedAt?: number;
  exitCode?: number;
  lastOutputAt?: number;
  foreground: boolean;
  changedAt: number;
}

export type ActivityEvent =
  | { type: "foreground"; running: boolean; processName?: string }
  | { type: "output" }
  | { type: "input" }
  | { type: "commandStarted"; command?: string }
  | { type: "commandCompleted"; exitCode: number }
  | { type: "bell" }
  | { type: "waiting" }
  | { type: "clear" }
  | { type: "focused" }
  | { type: "processExited" };

const priority: Record<ActivityState, number> = {
  failed: 6,
  waiting: 5,
  bell: 4,
  running: 3,
  completed: 2,
  idle: 1,
};

export const activityLabel: Record<ActivityState, string> = {
  idle: "Idle",
  running: "Running",
  waiting: "Waiting for input",
  completed: "Completed",
  failed: "Failed",
  bell: "Bell triggered",
};

export const bellAllowed = (
  previousAt: number,
  now: number,
  debounceMs = 2000,
): boolean => now - previousAt >= debounceMs;

export function transitionActivity(
  current: ActivityRecord,
  event: ActivityEvent,
  now = Date.now(),
): ActivityRecord {
  const update = (patch: Partial<ActivityRecord>): ActivityRecord => ({
    ...current,
    ...patch,
    changedAt: now,
  });
  switch (event.type) {
    case "foreground":
      if (event.running) {
        if (current.foreground && current.processName === event.processName)
          return current;
        return update({
          foreground: true,
          processName: event.processName,
          state: "running",
          startedAt: current.foreground ? current.startedAt : now,
          exitCode: undefined,
        });
      }
      if (!current.foreground) return current;
      return update({
        foreground: false,
        processName: undefined,
        state: current.state === "running" ? "completed" : current.state,
      });
    case "output":
      return {
        ...current,
        lastOutputAt: now,
        ...(current.state === "waiting" || current.state === "bell"
          ? { state: current.foreground ? "running" : "idle", changedAt: now }
          : {}),
      };
    case "input":
      return current.state === "waiting" ||
        current.state === "failed" ||
        current.state === "bell"
        ? update({ state: current.foreground ? "running" : "idle" })
        : current;
    case "commandStarted":
      return update({
        state: "running",
        command: event.command,
        startedAt: now,
        exitCode: undefined,
        foreground: true,
      });
    case "commandCompleted":
      return update({
        state: event.exitCode === 0 ? "completed" : "failed",
        exitCode: event.exitCode,
        foreground: false,
        processName: undefined,
      });
    case "bell":
      return current.state === "failed" || current.state === "waiting"
        ? current
        : update({ state: "bell" });
    case "waiting":
      return update({ state: "waiting" });
    case "focused":
      return current.state === "completed"
        ? update({ state: "idle", command: undefined, startedAt: undefined })
        : current;
    case "processExited":
      return update({
        state: current.state === "failed" ? "failed" : "completed",
        foreground: false,
        processName: undefined,
      });
    case "clear":
      return update({
        state: "idle",
        command: undefined,
        processName: undefined,
        startedAt: undefined,
        exitCode: undefined,
        foreground: false,
      });
  }
}

const records = new Map<string, ActivityRecord>();
let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version += 1;
  for (const listener of listeners) listener();
};

export const activityStore = {
  register(target: ActivityTarget) {
    records.set(target.paneId, {
      ...target,
      state: "idle",
      foreground: false,
      changedAt: Date.now(),
    });
    changed();
  },
  dispatch(paneId: string, event: ActivityEvent, now?: number) {
    const current = records.get(paneId);
    if (!current) return;
    const next = transitionActivity(current, event, now);
    if (next !== current) {
      records.set(paneId, next);
      changed();
    }
  },
  remove(paneId: string) {
    if (records.delete(paneId)) changed();
  },
  clearCompleted(paneIds?: ReadonlySet<string>) {
    for (const [id, record] of records)
      if (record.state === "completed" && (!paneIds || paneIds.has(id)))
        records.set(id, transitionActivity(record, { type: "clear" }));
    changed();
  },
  get(paneId: string) {
    return records.get(paneId);
  },
  all() {
    return [...records.values()];
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  version: () => version,
};

export function useActivityVersion(): number {
  return useSyncExternalStore(
    activityStore.subscribe,
    activityStore.version,
    activityStore.version,
  );
}

export function paneActivity(paneId: string): ActivityRecord | undefined {
  return activityStore.get(paneId);
}

export function aggregateActivity(ids: string[]): ActivityState {
  return ids
    .map((id) => records.get(id)?.state ?? "idle")
    .reduce(
      (highest, state) =>
        priority[state] > priority[highest] ? state : highest,
      "idle",
    );
}

export const tabActivity = (tab: Workspace["terminals"][number]) =>
  aggregateActivity(paneIds(tab.layout));

export const workspaceActivity = (workspace: Workspace) =>
  aggregateActivity(workspace.terminals.flatMap((tab) => paneIds(tab.layout)));

export function findActivityTarget(
  workspaces: Workspace[],
  states: ReadonlySet<ActivityState>,
  afterPaneId?: string,
): ActivityTarget | undefined {
  const targets = workspaces.flatMap((workspace) =>
    workspace.terminals.flatMap((tab) =>
      paneIds(tab.layout).flatMap((paneId) => {
        const record = records.get(paneId);
        return record && states.has(record.state) ? [record] : [];
      }),
    ),
  );
  if (!targets.length) return;
  const index = targets.findIndex(({ paneId }) => paneId === afterPaneId);
  return targets[(index + 1) % targets.length];
}
