import { expect, test } from "vitest";
import { filterCommands, registerCommands } from "./commands";
import { safeHttpUrl } from "./links";
import {
  defaultProfiles,
  selectDefaultProfile,
  validateProfile,
} from "./profiles";
import { initialSearchState, searchReducer } from "./search";
import {
  defaultSettings,
  serializeSettings,
  validateSettings,
} from "./settings";
import { deserializeState, serializeState } from "./storage";

test("registers unique commands and fuzzy filters them", () => {
  const commands = registerCommands(
    { id: "split", title: "Split right", run: () => undefined },
    {
      id: "settings",
      title: "Open settings",
      keywords: ["preferences"],
      run: () => undefined,
    },
  );
  expect(filterCommands(commands, "spr")[0]?.id).toBe("split");
  expect(filterCommands(commands, "pref").map(({ id }) => id)).toEqual([
    "settings",
  ]);
  expect(() => registerCommands(...commands, commands[0]!)).toThrow(
    "Duplicate command",
  );
});

test("validates shell profiles", () => {
  expect(validateProfile(defaultProfiles()[0])).toMatchObject({
    id: "powershell",
  });
  expect(
    validateProfile({ id: "bad", name: "Bad", command: "", args: [], env: {} }),
  ).toBeUndefined();
});

test("migrates legacy workspaces into folders without losing layouts", () => {
  const migrated = deserializeState(
    JSON.stringify({
      activeWorkspaceId: "w",
      workspaces: [
        {
          id: "w",
          name: "Saved",
          cwd: "C:\\Projects\\Winmux",
          shell: "powershell",
          activeTerminalId: "t",
          terminals: [
            {
              id: "t",
              title: "PowerShell",
              activePaneId: "p",
              layout: {
                type: "pane",
                pane: { id: "p", shell: "powershell", cwd: "C:\\Work" },
              },
            },
          ],
        },
      ],
    }),
  );
  expect(migrated.workspaces[0]?.terminals[0]?.layout).toMatchObject({
    pane: { id: "p", profileId: "powershell", cwd: "C:\\Work" },
  });
  expect(migrated.workspaces[0]?.cwd).toBe("C:\\Projects\\Winmux");
  expect(migrated.sidebar).toEqual({ collapsed: false, width: 224 });
  expect(deserializeState(serializeState(migrated))).toEqual(migrated);
});

test("restores and clamps persisted folder sidebar preferences", () => {
  const state = deserializeState(
    JSON.stringify({
      activeWorkspaceId: "f",
      workspaces: [{ id: "f", name: "Folder", terminals: [] }],
      sidebar: { collapsed: true, width: 900 },
    }),
  );
  expect(state.sidebar).toEqual({ collapsed: true, width: 360 });
});

test("selects an available default profile", () => {
  const profiles = defaultProfiles().map((profile) =>
    profile.id === "powershell" ? { ...profile, available: false } : profile,
  );
  expect(selectDefaultProfile(profiles, "powershell")).toBe("cmd");
});

test("tracks terminal search state", () => {
  let state = searchReducer(initialSearchState, { type: "open" });
  state = searchReducer(state, { type: "query", query: "error" });
  state = searchReducer(state, { type: "results", current: 2, total: 5 });
  expect(state).toEqual({ open: true, query: "error", current: 2, total: 5 });
  expect(searchReducer(state, { type: "close" })).toEqual(initialSearchState);
});

test("only accepts safe HTTP and HTTPS URLs", () => {
  expect(safeHttpUrl("https://example.com/path")?.hostname).toBe("example.com");
  expect(safeHttpUrl("http://localhost:3000")?.protocol).toBe("http:");
  expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
  expect(safeHttpUrl("https://user:secret@example.com")).toBeUndefined();
  expect(safeHttpUrl("file:///C:/secret")).toBeUndefined();
  expect(safeHttpUrl("https://")).toBeUndefined();
});

test("validates and serializes terminal settings", () => {
  const settings = validateSettings({
    ...defaultSettings(),
    fontSize: 500,
    cursorStyle: "invalid",
  });
  expect(settings.fontSize).toBe(32);
  expect(settings.cursorStyle).toBe("bar");
  expect(JSON.parse(serializeSettings(settings))).toEqual(settings);
});
