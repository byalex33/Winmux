import { listen } from "@tauri-apps/api/event";
import { basename } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { Search, Settings, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  activityStore,
  useActivityVersion,
  type ActivityTarget,
} from "./activity";
import { commandsFor, type CommandContext } from "./commands";
import {
  ConfirmDialog,
  PromptDialog,
  type ConfirmRequest,
  type PromptRequest,
} from "./components/AppDialogs";
import CommandPalette from "./components/CommandPalette";
import IconButton from "./components/IconButton";
import ProfileMenu from "./components/ProfileMenu";
import SettingsDialog from "./components/SettingsDialog";
import SplitLayout from "./components/SplitLayout";
import TitleBar from "./components/TitleBar";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import { Button } from "./components/ui/button";
import { paneIds } from "./layout";
import {
  dispatchNotification,
  notificationAllowed,
  resolveNotificationTarget,
} from "./notifications";
import { applyTheme } from "./themes/apply-theme";
import {
  restoreTerminalFocus as restoreRegisteredTerminalFocus,
  terminalHandle,
} from "./terminalRegistry";
import type { TerminalTab } from "./types";
import { useShortcuts } from "./useShortcuts";
import { useWorkspaceStore } from "./useWorkspaceStore";

export default function App() {
  const store = useWorkspaceStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [promptRequest, setPromptRequest] = useState<PromptRequest>();
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest>();
  const activityVersion = useActivityVersion();
  const activePaneId = store.activeTab?.activePaneId;
  const restoreTerminalFocus = (paneId = activePaneId) =>
    restoreRegisteredTerminalFocus(paneId);

  useEffect(() => applyTheme(store.state.settings), [store.state.settings]);

  const prompt = (request: Omit<PromptRequest, "resolve">) =>
    new Promise<string | undefined>((resolve) =>
      setPromptRequest({ ...request, resolve }),
    );
  const finishPrompt = (value?: string) => {
    const request = promptRequest;
    setPromptRequest(undefined);
    request?.resolve(value);
    restoreTerminalFocus();
  };
  const confirm = (request: Omit<ConfirmRequest, "resolve">) =>
    new Promise<boolean>((resolve) =>
      setConfirmRequest({ ...request, resolve }),
    );
  const finishConfirm = (value: boolean) => {
    const request = confirmRequest;
    setConfirmRequest(undefined);
    request?.resolve(value);
    restoreTerminalFocus();
  };
  const confirmClose = async (ids: string[]): Promise<boolean> => {
    if (!store.state.settings.confirmCloseRunning) return true;
    const running = await Promise.all(
      ids.map(
        (id) =>
          terminalHandle(id)
            ?.hasForegroundProcess()
            .catch(() => false) ?? false,
      ),
    );
    return (
      !running.some(Boolean) ||
      confirm({
        title: "Close running terminal?",
        description:
          "A foreground process is still running and will be stopped.",
        confirmLabel: "Close terminal",
        destructive: true,
      })
    );
  };
  const closePane = async (tabId: string, paneId: string) => {
    if (await confirmClose([paneId])) store.closePane(tabId, paneId);
  };
  const closeActivePane = async () => {
    if (store.activeTab)
      await closePane(store.activeTab.id, store.activeTab.activePaneId);
  };
  const closeTab = async (workspaceId: string, tabId: string) => {
    const tab = store.state.workspaces
      .find(({ id }) => id === workspaceId)
      ?.terminals.find(({ id }) => id === tabId);
    if (tab && (await confirmClose(paneIds(tab.layout))))
      store.closeTerminal(tabId, workspaceId);
  };
  const closeTabs = async (workspaceId: string, tabs: TerminalTab[]) => {
    const ids = tabs.flatMap((tab) => paneIds(tab.layout));
    if (await confirmClose(ids))
      store.closeTerminals(
        tabs.map(({ id }) => id),
        workspaceId,
      );
  };
  const createFolder = async () => {
    const name = await prompt({
      title: "Create folder",
      description: "Folders contain independent terminal tabs and layouts.",
      initial: `Folder ${store.state.workspaces.length + 1}`,
      submitLabel: "Create",
    });
    if (name) {
      store.createWorkspace(name);
      toast.success("Folder created");
    }
  };
  const openFolder = async () => {
    try {
      const path = await open({ directory: true, title: "Open folder" });
      if (!path) return;
      store.createWorkspace((await basename(path)) || path, path);
      toast.success("Folder opened");
    } catch {
      toast.error("Unable to open folder");
    }
  };
  const renameFolder = async (id: string, currentName: string) => {
    const name = await prompt({
      title: "Rename folder",
      description: "Choose a compact display name.",
      initial: currentName,
      submitLabel: "Rename",
    });
    if (name) {
      store.renameWorkspace(id, name);
      toast.success("Folder renamed");
    }
  };
  const duplicateFolder = (id: string) => {
    store.duplicateWorkspace(id);
    toast.success("Folder duplicated");
  };
  const deleteFolder = async (id: string, name: string) => {
    const workspace = store.state.workspaces.find((item) => item.id === id);
    if (!workspace) return;
    if (
      workspace.terminals.length &&
      !(await confirm({
        title: `Delete “${name}”?`,
        description:
          "All terminals in this folder will close. Files on disk are not changed.",
        confirmLabel: "Delete folder",
        destructive: true,
      }))
    )
      return;
    store.deleteWorkspace(id);
  };
  const closeFolderTerminals = async (id: string) => {
    const workspace = store.state.workspaces.find((item) => item.id === id);
    if (
      workspace &&
      (await confirmClose(
        workspace.terminals.flatMap((tab) => paneIds(tab.layout)),
      ))
    )
      store.closeWorkspaceTerminals(id);
  };
  const renameTab = async (workspaceId: string, tab: TerminalTab) => {
    const title = await prompt({
      title: "Rename terminal",
      description: "This changes only the tab label.",
      initial: tab.title,
      submitLabel: "Rename",
    });
    if (title) store.renameTerminal(tab.id, title, workspaceId);
  };
  const restartPane = async (paneId: string) => {
    if (await confirmClose([paneId])) {
      terminalHandle(paneId)?.reload();
      toast.success("Terminal restarted");
    }
  };
  const restartTab = async (tab: TerminalTab) => {
    const ids = paneIds(tab.layout);
    if (await confirmClose(ids)) {
      ids.forEach((id) => terminalHandle(id)?.reload());
      toast.success("Terminal restarted");
    }
  };

  useEffect(() => {
    for (const record of activityStore.all())
      if (
        notificationAllowed(
          record,
          store.state.settings,
          activePaneId,
          document.hasFocus(),
        )
      )
        void dispatchNotification(record, store.state.settings).catch(
          () => undefined,
        );
  }, [activityVersion, activePaneId, store.state.settings]);

  useEffect(() => {
    const navigate = (target: ActivityTarget) => {
      const resolved = resolveNotificationTarget(
        store.state.workspaces,
        target,
      );
      if (!resolved) return;
      store.focusTarget(resolved.workspaceId, resolved.tabId, resolved.paneId);
      restoreRegisteredTerminalFocus(resolved.paneId);
    };
    const unlisten = listen<ActivityTarget>(
      "notification-navigation",
      (event) => navigate(event.payload),
    );
    return () => void unlisten.then((remove) => remove());
  }, [store]);

  const reloadTerminal = () => terminalHandle(activePaneId)?.reload();
  const context: CommandContext = {
    store,
    closeActivePane: () => void closeActivePane(),
    closeActiveTab: () =>
      store.activeTab &&
      void closeTab(store.activeWorkspace.id, store.activeTab.id),
    createFolder: () => void createFolder(),
    deleteActiveFolder: () =>
      void deleteFolder(store.activeWorkspace.id, store.activeWorkspace.name),
    duplicateActiveFolder: () => duplicateFolder(store.activeWorkspace.id),
    openFolder: () => void openFolder(),
    openSettings: () => setSettingsOpen(true),
    reloadTerminal,
    renameActiveFolder: () =>
      void renameFolder(store.activeWorkspace.id, store.activeWorkspace.name),
  };

  useShortcuts({
    closePane: () => void closeActivePane(),
    createFolder: () => void createFolder(),
    cycleFolder: store.cycleWorkspace,
    cycleTab: store.cycleTerminal,
    moveFocus: store.movePaneFocus,
    newTerminal: () => store.createTerminal(),
    openPalette: () => setPaletteOpen(true),
    openSearch: () => terminalHandle(activePaneId)?.openSearch(),
    split: store.splitActivePane,
    switchFolder: (index) => {
      const folder = store.state.workspaces[index];
      if (folder) store.selectWorkspace(folder.id);
    },
  });

  return (
    <main className="app-shell">
      <TitleBar />
      <div className="app-body">
        <WorkspaceSidebar
          store={store}
          onCloseAll={(id) => void closeFolderTerminals(id)}
          onCreate={() => void createFolder()}
          onDelete={(id, name) => void deleteFolder(id, name)}
          onDuplicate={duplicateFolder}
          onOpen={() => void openFolder()}
          onRename={(id, name) => void renameFolder(id, name)}
          onCloseTerminal={(workspaceId, tabId) =>
            void closeTab(workspaceId, tabId)
          }
          onCloseOtherTerminals={(workspaceId, tabId) => {
            const workspace = store.state.workspaces.find(
              ({ id }) => id === workspaceId,
            );
            if (workspace)
              void closeTabs(
                workspaceId,
                workspace.terminals.filter((tab) => tab.id !== tabId),
              );
          }}
          onCloseTerminalsBelow={(workspaceId, tabId) => {
            const workspace = store.state.workspaces.find(
              ({ id }) => id === workspaceId,
            );
            if (workspace) {
              const index = workspace.terminals.findIndex(
                (tab) => tab.id === tabId,
              );
              void closeTabs(workspaceId, workspace.terminals.slice(index + 1));
            }
          }}
          onRenameTerminal={(workspaceId, tab) =>
            void renameTab(workspaceId, tab)
          }
          onRestartTerminal={(tab) => void restartTab(tab)}
        />
        <section className="workspace-shell">
          <header className="workspace-toolbar">
            <span>{store.activeWorkspace.name}</span>
            <div>
              <ProfileMenu
                profiles={store.state.profiles}
                defaultProfileId={store.state.settings.defaultProfileId}
                onCreate={store.createTerminal}
              />
              <IconButton
                label="Search terminal (Ctrl+F)"
                variant="ghost"
                size="icon-sm"
                onClick={() => terminalHandle(activePaneId)?.openSearch()}
              >
                <Search />
              </IconButton>
              <IconButton
                label="Command palette (Ctrl+Shift+P)"
                variant="ghost"
                size="icon-sm"
                onClick={() => setPaletteOpen(true)}
              >
                <SquareTerminal />
              </IconButton>
              <IconButton
                label="Settings"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings />
              </IconButton>
            </div>
          </header>
          <div className="terminal-stage">
            {!store.activeWorkspace.terminals.length && (
              <div className="empty-state">
                <SquareTerminal />
                <p>No terminals in this folder</p>
                <span>Open a shell profile to get started.</span>
                <Button size="sm" onClick={() => store.createTerminal()}>
                  New terminal
                </Button>
              </div>
            )}
            {store.state.workspaces.flatMap((workspace) =>
              workspace.terminals.map((tab) => (
                <SplitLayout
                  key={tab.id}
                  workspaceId={workspace.id}
                  tab={tab}
                  visible={
                    workspace.id === store.state.activeWorkspaceId &&
                    tab.id === store.activeWorkspace.activeTerminalId
                  }
                  profiles={store.state.profiles}
                  settings={store.state.settings}
                  onClearActivity={(id) =>
                    activityStore.dispatch(id, { type: "clear" })
                  }
                  onClose={(tabId, paneId) => void closePane(tabId, paneId)}
                  onFocus={store.focusPane}
                  onResize={store.setSplitRatio}
                  onRestart={(id) => void restartPane(id)}
                  onSplit={store.splitActivePane}
                  onWorkingDirectory={store.updateWorkingDirectory}
                />
              )),
            )}
          </div>
        </section>
      </div>
      {paletteOpen && (
        <CommandPalette
          commands={commandsFor(context)}
          context={context}
          onClose={() => {
            setPaletteOpen(false);
            restoreTerminalFocus();
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          store={store}
          onClose={() => {
            applyTheme(store.state.settings);
            setSettingsOpen(false);
            toast.success("Settings saved");
            restoreTerminalFocus();
          }}
        />
      )}
      {promptRequest && (
        <PromptDialog request={promptRequest} finish={finishPrompt} />
      )}
      {confirmRequest && (
        <ConfirmDialog request={confirmRequest} finish={finishConfirm} />
      )}
    </main>
  );
}
