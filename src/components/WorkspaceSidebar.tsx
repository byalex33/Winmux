import {
  AppWindow,
  Boxes,
  Copy,
  Folder,
  FolderOpen,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  SquareTerminal,
  Trash2,
  X,
  XCircle,
  XSquare,
} from "lucide-react";
import type {
  DragEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  tabActivity,
  useActivityVersion,
  workspaceActivity,
} from "../activity";
import { findPane } from "../layout";
import type { TerminalTab } from "../types";
import type { WorkspaceStore } from "../useWorkspaceStore";
import ActivityIndicator from "./ActivityIndicator";
import IconButton from "./IconButton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ui/context-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface Props {
  store: WorkspaceStore;
  onCloseAll: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onOpen: () => void;
  onRename: (id: string, name: string) => void;
  onCloseTerminal: (workspaceId: string, tabId: string) => void;
  onCloseOtherTerminals: (workspaceId: string, tabId: string) => void;
  onCloseTerminalsBelow: (workspaceId: string, tabId: string) => void;
  onRenameTerminal: (workspaceId: string, tab: TerminalTab) => void;
  onRestartTerminal: (tab: TerminalTab) => void;
}

export default function WorkspaceSidebar({
  store,
  onCloseAll,
  onCreate,
  onDelete,
  onDuplicate,
  onOpen,
  onRename,
  onCloseTerminal,
  onCloseOtherTerminals,
  onCloseTerminalsBelow,
  onRenameTerminal,
  onRestartTerminal,
}: Props) {
  useActivityVersion();
  const { collapsed, width } = store.state.sidebar;
  const startResize = (event: ReactPointerEvent) => {
    event.preventDefault();
    const move = (pointer: PointerEvent) =>
      store.setSidebar({ width: pointer.clientX });
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };
  const dropWorkspace = (event: DragEvent, index: number) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (id) store.moveWorkspace(id, index);
  };
  const dropTerminal = (
    event: DragEvent,
    workspaceId: string,
    index: number,
  ) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-winmux-tab");
    if (id) store.moveTerminal(id, index, workspaceId);
  };
  const middleClose = (
    event: MouseEvent,
    workspaceId: string,
    tabId: string,
  ) => {
    if (event.button === 1) {
      event.preventDefault();
      onCloseTerminal(workspaceId, tabId);
    }
  };

  return (
    <aside
      className="folder-sidebar"
      data-collapsed={collapsed}
      style={{ width: collapsed ? 44 : width }}
    >
      <div className="folder-sidebar-toolbar">
        {!collapsed && <span>Folders</span>}
        <div>
          <IconButton
            label="Open folder"
            variant="ghost"
            size="icon-xs"
            onClick={onOpen}
          >
            <FolderOpen />
          </IconButton>
          <IconButton
            label="Create folder (Ctrl+Shift+N)"
            variant="ghost"
            size="icon-xs"
            onClick={onCreate}
          >
            <Plus />
          </IconButton>
          <IconButton
            label={
              collapsed ? "Expand folder sidebar" : "Collapse folder sidebar"
            }
            variant="ghost"
            size="icon-xs"
            onClick={() => store.setSidebar({ collapsed: !collapsed })}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </IconButton>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Folders" className="folder-list">
          {store.state.workspaces.map((workspace, workspaceIndex) => {
            const selected = workspace.id === store.state.activeWorkspaceId;
            const content = (
              <button
                className="folder-button"
                aria-current={selected ? "page" : undefined}
                aria-label={workspace.name}
                onClick={() => store.selectWorkspace(workspace.id)}
              >
                {collapsed ? (
                  <span className="folder-initials" aria-hidden="true">
                    {workspace.name.trim().slice(0, 2).toUpperCase() || "F"}
                  </span>
                ) : (
                  <Folder aria-hidden="true" />
                )}
                {!collapsed && (
                  <span className="folder-name">{workspace.name}</span>
                )}
                <ActivityIndicator state={workspaceActivity(workspace)} />
              </button>
            );
            return (
              <div className="folder-group" key={workspace.id}>
                <ContextMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ContextMenuTrigger asChild>
                        <div
                          className="folder-row"
                          data-active={selected}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(
                              "text/plain",
                              workspace.id,
                            );
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) =>
                            dropWorkspace(event, workspaceIndex)
                          }
                        >
                          {content}
                        </div>
                      </ContextMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {workspace.name}
                    </TooltipContent>
                  </Tooltip>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onSelect={() => onRename(workspace.id, workspace.name)}
                    >
                      <Pencil /> Rename
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => onDuplicate(workspace.id)}>
                      <Copy /> Duplicate
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!workspace.terminals.length}
                      onSelect={() => onCloseAll(workspace.id)}
                    >
                      <XSquare /> Close all terminals
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() => onDelete(workspace.id, workspace.name)}
                    >
                      <Trash2 /> Delete folder
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {!collapsed && (
                  <div className="sidebar-terminal-list">
                    {workspace.terminals.map((tab, tabIndex) => {
                      const active =
                        selected && tab.id === workspace.activeTerminalId;
                      const profile = store.state.profiles.find(
                        ({ id }) =>
                          id ===
                          findPane(tab.layout, tab.activePaneId)?.profileId,
                      );
                      const ShellIcon =
                        profile?.icon === "powershell"
                          ? Boxes
                          : profile?.icon === "terminal"
                            ? AppWindow
                            : profile?.icon === "git"
                              ? GitBranch
                              : SquareTerminal;
                      return (
                        <ContextMenu key={tab.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              className="sidebar-terminal-row"
                              data-active={active}
                              draggable
                              onAuxClick={(event) =>
                                middleClose(event, workspace.id, tab.id)
                              }
                              onDoubleClick={(event) => {
                                if (
                                  !(event.target as HTMLElement).closest(
                                    ".sidebar-terminal-close",
                                  )
                                )
                                  onRenameTerminal(workspace.id, tab);
                              }}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData(
                                  "application/x-winmux-tab",
                                  tab.id,
                                );
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) =>
                                dropTerminal(event, workspace.id, tabIndex)
                              }
                            >
                              <button
                                className="sidebar-terminal-select"
                                onClick={() =>
                                  store.selectTerminal(tab.id, workspace.id)
                                }
                                aria-current={active ? "page" : undefined}
                              >
                                <ShellIcon aria-hidden="true" />
                                <span>{tab.title}</span>
                                <ActivityIndicator state={tabActivity(tab)} />
                              </button>
                              <IconButton
                                label={`Close ${tab.title}`}
                                className="sidebar-terminal-close"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() =>
                                  onCloseTerminal(workspace.id, tab.id)
                                }
                              >
                                <X />
                              </IconButton>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onSelect={() =>
                                onRenameTerminal(workspace.id, tab)
                              }
                            >
                              <Pencil /> Rename
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() =>
                                store.duplicateTerminal(tab.id, workspace.id)
                              }
                            >
                              <Copy /> Duplicate layout
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => onRestartTerminal(tab)}
                            >
                              <RefreshCw /> Restart all panes
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onSelect={() =>
                                onCloseTerminal(workspace.id, tab.id)
                              }
                            >
                              <X /> Close
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={workspace.terminals.length < 2}
                              onSelect={() =>
                                onCloseOtherTerminals(workspace.id, tab.id)
                              }
                            >
                              <XCircle /> Close other terminals
                            </ContextMenuItem>
                            <ContextMenuItem
                              disabled={
                                tabIndex === workspace.terminals.length - 1
                              }
                              onSelect={() =>
                                onCloseTerminalsBelow(workspace.id, tab.id)
                              }
                            >
                              <XCircle /> Close terminals below
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
      {!collapsed && (
        <div
          className="sidebar-resizer"
          role="separator"
          tabIndex={0}
          aria-label="Resize folder sidebar"
          aria-orientation="vertical"
          onPointerDown={startResize}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft")
              store.setSidebar({ width: width - 8 });
            else if (event.key === "ArrowRight")
              store.setSidebar({ width: width + 8 });
            else return;
            event.preventDefault();
          }}
        />
      )}
    </aside>
  );
}
