// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { activityStore } from "./activity";
import { ConfirmDialog } from "./components/AppDialogs";
import CommandPalette from "./components/CommandPalette";
import IconButton from "./components/IconButton";
import SplitLayout from "./components/SplitLayout";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { defaultProfiles } from "./profiles";
import { defaultSettings } from "./settings";
import { registerTerminal, restoreTerminalFocus } from "./terminalRegistry";
import type { AppState, TerminalTab, Workspace } from "./types";
import type { WorkspaceStore } from "./useWorkspaceStore";

vi.mock("./components/TerminalPane", () => ({ default: () => null }));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  globalThis.requestAnimationFrame = (callback) => {
    callback(0);
    return 1;
  };
});

afterEach(() => {
  activityStore.remove("pane");
  document.body.innerHTML = "";
});

const tab: TerminalTab = {
  id: "tab",
  title: "PowerShell",
  activePaneId: "pane",
  layout: { type: "pane", pane: { id: "pane", profileId: "powershell" } },
};
const workspace: Workspace = {
  id: "folder",
  name: "A very long folder name",
  terminals: [tab],
  activeTerminalId: tab.id,
};

function fakeStore(collapsed = false): WorkspaceStore {
  const state: AppState = {
    version: 6,
    activeWorkspaceId: workspace.id,
    workspaces: [workspace],
    sidebar: { collapsed, width: 220 },
    profiles: defaultProfiles(),
    settings: defaultSettings(),
  };
  return {
    state,
    activeWorkspace: workspace,
    activeTab: tab,
    setSidebar: vi.fn(),
    selectWorkspace: vi.fn(),
    moveWorkspace: vi.fn(),
    duplicateWorkspace: vi.fn(),
    selectTerminal: vi.fn(),
    moveTerminal: vi.fn(),
    duplicateTerminal: vi.fn(),
    createTerminal: vi.fn(),
  } as unknown as WorkspaceStore;
}

const wrapped = (node: React.ReactNode) => (
  <TooltipProvider delayDuration={0}>{node}</TooltipProvider>
);

const sidebarActions = {
  onCloseAll: vi.fn(),
  onCreate: vi.fn(),
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  onOpen: vi.fn(),
  onRename: vi.fn(),
  onCloseTerminal: vi.fn(),
  onCloseOtherTerminals: vi.fn(),
  onCloseTerminalsBelow: vi.fn(),
  onRenameTerminal: vi.fn(),
  onRestartTerminal: vi.fn(),
};

describe("desktop interface actions", () => {
  test("keeps collapsed folder activity visible with readable metadata", () => {
    activityStore.register({
      workspaceId: "folder",
      tabId: "tab",
      paneId: "pane",
      sessionId: "session",
    });
    activityStore.dispatch("pane", { type: "foreground", running: true });
    render(
      wrapped(<WorkspaceSidebar {...sidebarActions} store={fakeStore(true)} />),
    );
    expect(screen.getByRole("status", { name: "Running" })).toHaveAttribute(
      "data-activity-state",
      "running",
    );
    expect(screen.getByRole("button", { name: workspace.name })).toBeVisible();
  });

  test("exposes folder context actions", async () => {
    const onOpen = vi.fn();
    const onRename = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    render(
      wrapped(
        <WorkspaceSidebar
          {...sidebarActions}
          store={fakeStore()}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onOpen={onOpen}
          onRename={onRename}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(onOpen).toHaveBeenCalledOnce();
    fireEvent.contextMenu(screen.getByRole("button", { name: workspace.name }));
    fireEvent.click(await screen.findByText("Rename"));
    expect(onRename).toHaveBeenCalledWith(workspace.id, workspace.name);
  });

  test("nests terminals under folders with tab actions", async () => {
    const onClose = vi.fn();
    const onRestart = vi.fn();
    const store = fakeStore();
    render(
      wrapped(
        <WorkspaceSidebar
          {...sidebarActions}
          store={store}
          onCloseTerminal={onClose}
          onRestartTerminal={onRestart}
        />,
      ),
    );
    const selector = screen.getByRole("button", { name: "PowerShell" });
    fireEvent.click(selector);
    expect(store.selectTerminal).toHaveBeenCalledWith(tab.id, workspace.id);
    fireEvent(
      selector.parentElement!,
      new MouseEvent("auxclick", { bubbles: true, button: 1 }),
    );
    expect(onClose).toHaveBeenCalledWith(workspace.id, tab.id);
    fireEvent.contextMenu(selector);
    fireEvent.click(await screen.findByText("Restart all panes"));
    expect(onRestart).toHaveBeenCalledWith(tab);
  });

  test("requires destructive confirmation", () => {
    const finish = vi.fn();
    render(
      <ConfirmDialog
        request={{
          title: "Delete folder?",
          description: "Active terminals will close.",
          confirmLabel: "Delete folder",
          destructive: true,
          resolve: vi.fn(),
        }}
        finish={finish}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
    expect(finish).toHaveBeenCalledWith(true);
  });

  test("terminal toolbar exposes labelled split, restart, clear, and close actions", async () => {
    render(
      wrapped(
        <SplitLayout
          workspaceId="folder"
          tab={tab}
          visible
          profiles={defaultProfiles()}
          settings={defaultSettings()}
          onClearActivity={vi.fn()}
          onClose={vi.fn()}
          onFocus={vi.fn()}
          onResize={vi.fn()}
          onRestart={vi.fn()}
          onSplit={vi.fn()}
          onWorkingDirectory={vi.fn()}
        />,
      ),
    );
    for (const label of [
      "Split right (Ctrl+Shift+D)",
      "Split down (Ctrl+Shift+E)",
      "Restart pane",
      "Clear activity state",
      "Close pane (Ctrl+Shift+W)",
    ])
      expect(await screen.findByRole("button", { name: label })).toBeVisible();
  });

  test("icon-only controls have labels and terminal focus can be restored", async () => {
    render(wrapped(<IconButton label="Accessible action">+</IconButton>));
    expect(
      screen.getByRole("button", { name: "Accessible action" }),
    ).toHaveAttribute("title", "Accessible action");
    const focus = vi.fn();
    const unregister = registerTerminal("focus-pane", {
      focus,
      hasForegroundProcess: async () => false,
      openSearch: vi.fn(),
      reload: vi.fn(),
    });
    restoreTerminalFocus("focus-pane");
    await waitFor(() => expect(focus).toHaveBeenCalled());
    unregister();
  });

  test("command selection closes the palette before running the registry action", async () => {
    const onClose = vi.fn();
    const run = vi.fn();
    const store = fakeStore();
    render(
      <CommandPalette
        commands={[{ id: "settings.open", title: "Open settings", run }]}
        context={{ store } as never}
        onClose={onClose}
      />,
    );
    fireEvent.click(await screen.findByText("Open settings"));
    expect(onClose).toHaveBeenCalledBefore(run);
  });
});
