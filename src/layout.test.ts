import { describe, expect, test } from "vitest";
import {
  cloneLayout,
  moveFocus,
  paneIds,
  paneNode,
  removePane,
  splitPane,
} from "./layout";
import { deserializeState, serializeState } from "./storage";
import { defaultProfiles } from "./profiles";
import { defaultSettings } from "./settings";
import type { AppState, Pane } from "./types";

const pane = (id: string): Pane => ({
  id,
  profileId: "powershell",
  cwd: `C:\\${id}`,
});

describe("split layouts", () => {
  test("creates a two-pane layout", () => {
    const layout = splitPane(
      paneNode(pane("a")),
      "a",
      "row",
      pane("b"),
      "split-1",
    );
    expect(layout).toMatchObject({
      type: "split",
      direction: "row",
      ratio: 0.5,
    });
    expect(paneIds(layout)).toEqual(["a", "b"]);
  });

  test("supports nested row and column splits", () => {
    let layout = splitPane(
      paneNode(pane("a")),
      "a",
      "row",
      pane("b"),
      "split-1",
    );
    layout = splitPane(layout, "b", "column", pane("c"), "split-2");
    expect(paneIds(layout)).toEqual(["a", "b", "c"]);
    expect(layout).toMatchObject({
      type: "split",
      second: { type: "split", direction: "column" },
    });
  });

  test("removes a pane and collapses its redundant split", () => {
    let layout = splitPane(
      paneNode(pane("a")),
      "a",
      "row",
      pane("b"),
      "split-1",
    );
    layout = splitPane(layout, "b", "column", pane("c"), "split-2");
    const reduced = removePane(layout, "b")!;
    expect(paneIds(reduced)).toEqual(["a", "c"]);
    expect(removePane(paneNode(pane("a")), "a")).toBeNull();
  });

  test("moves focus to geometrically adjacent panes", () => {
    let layout = splitPane(paneNode(pane("a")), "a", "row", pane("b"), "root");
    layout = splitPane(layout, "a", "column", pane("c"), "left");
    layout = splitPane(layout, "b", "column", pane("d"), "right");
    expect(moveFocus(layout, "a", "right")).toBe("b");
    expect(moveFocus(layout, "a", "down")).toBe("c");
    expect(moveFocus(layout, "d", "left")).toBe("c");
    expect(moveFocus(layout, "a", "up")).toBe("a");
  });

  test("clones saved layouts with fresh process identities", () => {
    const source = splitPane(
      paneNode(pane("a")),
      "a",
      "row",
      pane("b"),
      "split-1",
    );
    const ids = ["new-split", "new-a", "new-b"];
    const [copy, paneMap] = cloneLayout(source, () => ids.shift()!);
    expect(copy).toMatchObject({
      type: "split",
      id: "new-split",
      ratio: 0.5,
      first: { pane: { id: "new-a", cwd: "C:\\a" } },
      second: { pane: { id: "new-b", cwd: "C:\\b" } },
    });
    expect(paneMap).toEqual(
      new Map([
        ["a", "new-a"],
        ["b", "new-b"],
      ]),
    );
  });

  test("serializes and restores tabs, splits, focus, profile, cwd and sizes", () => {
    const layout = splitPane(
      paneNode(pane("a")),
      "a",
      "row",
      pane("b"),
      "split-1",
    );
    if (layout.type === "split") layout.ratio = 0.63;
    const state: AppState = {
      version: 6,
      activeWorkspaceId: "workspace",
      sidebar: { collapsed: true, width: 280 },
      profiles: defaultProfiles(),
      settings: defaultSettings(),
      workspaces: [
        {
          id: "workspace",
          name: "Main",
          activeTerminalId: "tab",
          terminals: [
            { id: "tab", title: "PowerShell", layout, activePaneId: "b" },
          ],
        },
      ],
    };
    expect(deserializeState(serializeState(state))).toEqual(state);
  });
});
