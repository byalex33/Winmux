import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import type { ActivityRecord, ActivityTarget } from "./activity";
import { paneIds } from "./layout";
import type { TerminalSettings, Workspace } from "./types";

export const sanitizeCommand = (command?: string): string | undefined => {
  const safe = [...(command ?? "")]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159) ? " " : character;
    })
    .join("")
    .trim()
    .match(/^&?\s*(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/)
    ?.slice(1)
    .find(Boolean);
  if (!safe) return;
  const name = safe.replaceAll("\\", "/").split("/").pop()!;
  return name.length > 80 ? `${name.slice(0, 77)}...` : name;
};

export function notificationAllowed(
  record: ActivityRecord,
  settings: TerminalSettings,
  focusedPaneId: string | undefined,
  appFocused: boolean,
  now = Date.now(),
): boolean {
  if (
    !settings.notificationsEnabled ||
    (appFocused && focusedPaneId === record.paneId)
  )
    return false;
  if (record.state === "completed")
    return (
      settings.completionNotifications &&
      record.startedAt !== undefined &&
      now - record.startedAt >= settings.minimumCommandDuration * 1000
    );
  if (record.state === "failed") return settings.failureNotifications;
  if (record.state === "waiting") return settings.waitingNotifications;
  return (
    record.state === "bell" && settings.bellBehavior === "notify" && !appFocused
  );
}

export function resolveNotificationTarget(
  workspaces: Workspace[],
  target: ActivityTarget,
): ActivityTarget | undefined {
  const workspace = workspaces.find(({ id }) => id === target.workspaceId);
  const tab = workspace?.terminals.find(({ id }) => id === target.tabId);
  return tab && paneIds(tab.layout).includes(target.paneId) && target.sessionId
    ? target
    : undefined;
}

let permission: boolean | undefined;
const sent = new Set<string>();

export async function dispatchNotification(
  record: ActivityRecord,
  settings: TerminalSettings,
): Promise<void> {
  const eventId = `${record.sessionId}:${record.state}:${record.changedAt}`;
  if (sent.has(eventId)) return;
  sent.add(eventId);
  if (permission === undefined) {
    permission = await isPermissionGranted();
    if (!permission) permission = (await requestPermission()) === "granted";
  }
  if (!permission) return;
  const command = settings.notificationCommandName
    ? sanitizeCommand(record.command ?? record.processName)
    : undefined;
  const title =
    record.state === "completed"
      ? "Command completed"
      : record.state === "failed"
        ? "Command failed"
        : record.state === "waiting"
          ? "Terminal requires input"
          : "Terminal bell";
  await invoke("show_native_notification", {
    request: {
      title,
      body: command ?? "Open Winmux to view the terminal.",
      target: {
        workspaceId: record.workspaceId,
        tabId: record.tabId,
        paneId: record.paneId,
        sessionId: record.sessionId,
      },
    },
  });
}

export function resetNotificationState(): void {
  permission = undefined;
  sent.clear();
}
