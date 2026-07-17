import type { WorkspaceStore } from "./useWorkspaceStore";
import { activityStore, findActivityTarget } from "./activity";
import { paneIds } from "./layout";

export interface CommandContext {
  store: WorkspaceStore;
  closeActivePane: () => void;
  closeActiveTab: () => void;
  createFolder: () => void;
  deleteActiveFolder: () => void;
  duplicateActiveFolder: () => void;
  openFolder: () => void;
  openSettings: () => void;
  reloadTerminal: () => void;
  renameActiveFolder: () => void;
}

export interface Command<C = CommandContext> {
  id: string;
  title: string;
  shortcut?: string;
  keywords?: string[];
  enabled?: (context: C) => boolean;
  run: (context: C) => void;
}

export function registerCommands<C>(
  ...commands: Command<C>[]
): readonly Command<C>[] {
  const ids = new Set<string>();
  for (const command of commands) {
    if (ids.has(command.id))
      throw new Error(`Duplicate command: ${command.id}`);
    ids.add(command.id);
  }
  return commands;
}

const registry = registerCommands<CommandContext>(
  {
    id: "folder.create",
    title: "Create folder",
    shortcut: "Ctrl+Shift+N",
    run: ({ createFolder }) => createFolder(),
  },
  {
    id: "folder.open",
    title: "Open folder",
    run: ({ openFolder }) => openFolder(),
  },
  {
    id: "folder.rename",
    title: "Rename active folder",
    run: ({ renameActiveFolder }) => renameActiveFolder(),
  },
  {
    id: "folder.duplicate",
    title: "Duplicate active folder",
    run: ({ duplicateActiveFolder }) => duplicateActiveFolder(),
  },
  {
    id: "folder.delete",
    title: "Delete active folder",
    run: ({ deleteActiveFolder }) => deleteActiveFolder(),
  },
  {
    id: "folder.moveUp",
    title: "Move folder up",
    run: ({ store }) => store.moveActiveWorkspace(-1),
  },
  {
    id: "folder.moveDown",
    title: "Move folder down",
    run: ({ store }) => store.moveActiveWorkspace(1),
  },
  {
    id: "terminal.create",
    title: "Create terminal tab",
    shortcut: "Ctrl+Shift+T",
    run: ({ store }) => store.createTerminal(),
  },
  {
    id: "terminal.close",
    title: "Close terminal tab",
    enabled: ({ store }) => Boolean(store.activeTab),
    run: ({ closeActiveTab }) => closeActiveTab(),
  },
  {
    id: "pane.splitRight",
    title: "Split right",
    shortcut: "Ctrl+Shift+D",
    run: ({ store }) => store.splitActivePane("row"),
  },
  {
    id: "pane.splitDown",
    title: "Split down",
    shortcut: "Ctrl+Shift+E",
    run: ({ store }) => store.splitActivePane("column"),
  },
  {
    id: "pane.close",
    title: "Close active pane",
    shortcut: "Ctrl+Shift+W",
    run: ({ closeActivePane }) => closeActivePane(),
  },
  {
    id: "pane.next",
    title: "Focus next pane",
    run: ({ store }) => store.cyclePane(1),
  },
  {
    id: "pane.previous",
    title: "Focus previous pane",
    run: ({ store }) => store.cyclePane(-1),
  },
  {
    id: "settings.open",
    title: "Open settings",
    run: ({ openSettings }) => openSettings(),
  },
  {
    id: "terminal.reload",
    title: "Reload terminal session",
    run: ({ reloadTerminal }) => reloadTerminal(),
  },
  {
    id: "activity.clearPane",
    title: "Clear active pane activity state",
    enabled: ({ store }) => Boolean(store.activeTab),
    run: ({ store }) => {
      if (store.activeTab)
        activityStore.dispatch(store.activeTab.activePaneId, { type: "clear" });
    },
  },
  {
    id: "activity.markWaiting",
    title: "Mark active pane as requiring attention",
    enabled: ({ store }) => Boolean(store.activeTab),
    run: ({ store }) => {
      if (store.activeTab)
        activityStore.dispatch(store.activeTab.activePaneId, {
          type: "waiting",
        });
    },
  },
  {
    id: "notifications.toggle",
    title: "Enable or disable notifications",
    run: ({ store }) =>
      store.updateSettings({
        notificationsEnabled: !store.state.settings.notificationsEnabled,
      }),
  },
  {
    id: "activity.nextAttention",
    title: "Focus next pane requiring attention",
    run: ({ store }) => {
      const target = findActivityTarget(
        store.state.workspaces,
        new Set(["waiting", "bell"]),
        store.activeTab?.activePaneId,
      );
      if (target)
        store.focusTarget(target.workspaceId, target.tabId, target.paneId);
    },
  },
  {
    id: "activity.nextFailed",
    title: "Focus next failed pane",
    run: ({ store }) => {
      const target = findActivityTarget(
        store.state.workspaces,
        new Set(["failed"]),
        store.activeTab?.activePaneId,
      );
      if (target)
        store.focusTarget(target.workspaceId, target.tabId, target.paneId);
    },
  },
  {
    id: "activity.clearFolderCompleted",
    title: "Clear completed states in active folder",
    run: ({ store }) =>
      activityStore.clearCompleted(
        new Set(
          store.activeWorkspace.terminals.flatMap((tab) => paneIds(tab.layout)),
        ),
      ),
  },
  {
    id: "activity.clearAllCompleted",
    title: "Clear all completed states",
    run: () => activityStore.clearCompleted(),
  },
);

export function commandsFor(context: CommandContext): Command[] {
  return [
    ...registry.filter((command) => command.enabled?.(context) !== false),
    ...context.store.state.workspaces.map<Command>((workspace) => ({
      id: `folder.switch.${workspace.id}`,
      title: `Switch folder: ${workspace.name}`,
      keywords: ["switch folder"],
      run: ({ store }) => store.selectWorkspace(workspace.id),
    })),
    ...context.store.activeWorkspace.terminals.map<Command>((tab) => ({
      id: `terminal.switch.${tab.id}`,
      title: `Switch terminal tab: ${tab.title}`,
      keywords: ["switch tab"],
      run: ({ store }) => store.selectTerminal(tab.id),
    })),
  ];
}

function fuzzyScore(text: string, query: string): number | undefined {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle) return 0;
  const exact = haystack.indexOf(needle);
  if (exact >= 0) return exact;
  let position = -1;
  let score = 0;
  for (const character of needle) {
    const next = haystack.indexOf(character, position + 1);
    if (next < 0) return;
    score += next - position - 1;
    position = next;
  }
  return score + 20;
}

export function filterCommands<C>(
  commands: readonly Command<C>[],
  query: string,
): Command<C>[] {
  return commands
    .map((command) => ({
      command,
      score: fuzzyScore(
        [command.title, ...(command.keywords ?? [])].join(" "),
        query,
      ),
    }))
    .filter(
      (entry): entry is { command: Command<C>; score: number } =>
        entry.score !== undefined,
    )
    .sort(
      (a, b) =>
        a.score - b.score || a.command.title.localeCompare(b.command.title),
    )
    .map(({ command }) => command);
}
