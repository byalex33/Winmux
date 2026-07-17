import { afterEach, describe, expect, test } from "vitest";
import {
  activityStore,
  aggregateActivity,
  bellAllowed,
  transitionActivity,
  workspaceActivity,
  type ActivityRecord,
} from "./activity";
import {
  notificationAllowed,
  resolveNotificationTarget,
  sanitizeCommand,
} from "./notifications";
import { defaultSettings, validateSettings } from "./settings";
import { integratedLaunch, parseShellEvent } from "./shellIntegration";
import { defaultProfiles } from "./profiles";
import type { Workspace } from "./types";

const target = {
  workspaceId: "folder",
  tabId: "tab",
  paneId: "pane",
  sessionId: "session",
};
const idle = (patch: Partial<ActivityRecord> = {}): ActivityRecord => ({
  ...target,
  state: "idle",
  foreground: false,
  changedAt: 0,
  ...patch,
});
const workspace = (): Workspace => ({
  id: "folder",
  name: "Folder",
  activeTerminalId: "tab",
  terminals: [
    {
      id: "tab",
      title: "Terminal",
      activePaneId: "pane",
      layout: {
        type: "pane",
        pane: { id: "pane", profileId: "powershell" },
      },
    },
  ],
});

afterEach(() => {
  for (const record of activityStore.all()) activityStore.remove(record.paneId);
});

describe("terminal activity", () => {
  test("transitions through running, completion, failure and acknowledgement", () => {
    const running = transitionActivity(
      idle(),
      { type: "commandStarted", command: "npm test" },
      1000,
    );
    expect(running).toMatchObject({
      state: "running",
      command: "npm test",
      startedAt: 1000,
    });
    expect(
      transitionActivity(
        running,
        { type: "commandCompleted", exitCode: 0 },
        2000,
      ).state,
    ).toBe("completed");
    const failed = transitionActivity(
      running,
      { type: "commandCompleted", exitCode: 1 },
      2000,
    );
    expect(failed.state).toBe("failed");
    expect(transitionActivity(failed, { type: "input" }, 3000).state).toBe(
      "idle",
    );
  });

  test("aggregates folder activity by documented priority", () => {
    for (const paneId of ["idle", "running", "waiting", "failed"])
      activityStore.register({ ...target, paneId, sessionId: paneId });
    activityStore.dispatch("running", { type: "commandStarted" });
    activityStore.dispatch("waiting", { type: "waiting" });
    activityStore.dispatch("failed", { type: "commandStarted" });
    activityStore.dispatch("failed", { type: "commandCompleted", exitCode: 1 });
    activityStore.register(target);
    activityStore.dispatch("pane", { type: "waiting" });
    expect(aggregateActivity(["idle", "running", "waiting"])).toBe("waiting");
    expect(aggregateActivity(["idle", "running", "waiting", "failed"])).toBe(
      "failed",
    );
    expect(aggregateActivity([])).toBe("idle");
    expect(workspaceActivity(workspace())).toBe("waiting");
  });

  test("clears completed records selectively and cleanup removes process state", () => {
    activityStore.register(target);
    activityStore.dispatch("pane", { type: "commandStarted" }, 1000);
    activityStore.dispatch(
      "pane",
      { type: "commandCompleted", exitCode: 0 },
      2000,
    );
    activityStore.clearCompleted(new Set(["pane"]));
    expect(activityStore.get("pane")?.state).toBe("idle");
    activityStore.remove("pane");
    expect(activityStore.get("pane")).toBeUndefined();
  });

  test("debounces rapid bells", () => {
    expect(bellAllowed(1000, 2500)).toBe(false);
    expect(bellAllowed(1000, 3000)).toBe(true);
  });
});

describe("activity notifications", () => {
  test("suppresses the focused pane and enforces completion duration", () => {
    const settings = defaultSettings();
    const completed = idle({
      state: "completed",
      startedAt: 1000,
      changedAt: 12_000,
    });
    expect(notificationAllowed(completed, settings, "pane", true, 12_000)).toBe(
      false,
    );
    expect(
      notificationAllowed(completed, settings, undefined, false, 10_999),
    ).toBe(false);
    expect(
      notificationAllowed(completed, settings, undefined, false, 11_000),
    ).toBe(true);
  });

  test("resolves only live notification navigation targets", () => {
    expect(resolveNotificationTarget([workspace()], target)).toEqual(target);
    expect(
      resolveNotificationTarget([workspace()], { ...target, paneId: "closed" }),
    ).toBeUndefined();
  });

  test("sanitizes and limits notification command text", () => {
    expect(sanitizeCommand("echo secret\nnext")).toBe("echo");
    expect(sanitizeCommand("x".repeat(100))).toHaveLength(80);
  });
});

test("migrates and validates activity settings", () => {
  const settings = validateSettings({
    minimumCommandDuration: -20,
    completedClearDelay: 99_999,
    bellBehavior: "loud",
    profileActivityOverrides: {
      powershell: { tracking: "disabled", shellIntegration: "bad" },
    },
  });
  expect(settings.minimumCommandDuration).toBe(0);
  expect(settings.completedClearDelay).toBe(3600);
  expect(settings.bellBehavior).toBe("visual");
  expect(settings.profileActivityOverrides.powershell).toEqual({
    tracking: "disabled",
    shellIntegration: "inherit",
    waitingDetection: "inherit",
  });
});

test("parses and validates structured shell integration events", () => {
  const command = btoa("npm test");
  const cwd = btoa("C:\\Work");
  expect(parseShellEvent(`winmux;started;${command}`)).toEqual({
    type: "started",
    command: "npm test",
  });
  expect(parseShellEvent(`winmux;completed;7;${cwd}`)).toEqual({
    type: "completed",
    exitCode: 7,
    cwd: "C:\\Work",
  });
  expect(parseShellEvent("winmux;completed;NaN;bad")).toBeUndefined();
  expect(parseShellEvent("other;started;bm90LXVz")).toBeUndefined();
});

test("injects shell integration only into the launched session", () => {
  const [powershell, cmd] = defaultProfiles();
  expect(integratedLaunch(powershell!).args).toContain("-EncodedCommand");
  expect(integratedLaunch(cmd!).env.PROMPT).toContain("winmux;prompt-raw");
  expect(
    integratedLaunch({
      ...powershell!,
      args: ["-Command", "Write-Host existing"],
    }).args,
  ).toEqual(["-Command", "Write-Host existing"]);
});
