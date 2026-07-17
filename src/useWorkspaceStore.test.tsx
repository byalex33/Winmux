// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { findPane } from "./layout";
import { createInitialState, saveState } from "./storage";
import { useWorkspaceStore } from "./useWorkspaceStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => new Promise(() => undefined)),
}));

afterEach(() => localStorage.clear());

test("opens a new terminal in the active pane's working directory", () => {
  const state = createInitialState("folder");
  const current = state.workspaces[0]!.terminals[0]!;
  current.layout = {
    type: "split",
    id: "split",
    direction: "row",
    ratio: 0.5,
    first: current.layout,
    second: {
      type: "pane",
      pane: {
        id: "active-pane",
        profileId: "powershell",
        cwd: "C:\\Users\\alex\\Documents\\Winmux",
      },
    },
  };
  current.activePaneId = "active-pane";
  saveState(state);

  const { result } = renderHook(() => useWorkspaceStore());
  act(() => result.current.createTerminal());

  const created = result.current.activeWorkspace.terminals.at(-1)!;
  expect(findPane(created.layout, created.activePaneId)?.cwd).toBe(
    "C:\\Users\\alex\\Documents\\Winmux",
  );
});
