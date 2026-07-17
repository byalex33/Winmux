import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import {
  findPane,
  cloneLayout,
  moveFocus,
  paneIds,
  paneNode,
  removePane,
  resizeSplit,
  splitPane,
  updatePane,
  type FocusDirection,
} from "./layout";
import {
  mergeDetectedProfiles,
  selectDefaultProfile,
  type DetectedProfile,
} from "./profiles";
import { loadState, saveState } from "./storage";
import { moveById } from "./ordering";
import { validateSettings } from "./settings";
import type {
  AppState,
  ShellProfile,
  SplitDirection,
  TerminalSettings,
  TerminalTab,
  Workspace,
} from "./types";

const newTab = (
  profile: ShellProfile,
  terminals: TerminalTab[] = [],
  cwd = profile.cwd,
): TerminalTab => {
  const id = crypto.randomUUID();
  const paneId = crypto.randomUUID();
  const count = terminals.filter(({ title }) =>
    title.startsWith(profile.name),
  ).length;
  return {
    id,
    title: count ? `${profile.name} ${count + 1}` : profile.name,
    layout: paneNode({
      id: paneId,
      profileId: profile.id,
      ...(cwd ? { cwd } : {}),
    }),
    activePaneId: paneId,
  };
};

export function useWorkspaceStore() {
  const [state, setState] = useState(loadState);
  const activeWorkspace = state.workspaces.find(
    ({ id }) => id === state.activeWorkspaceId,
  )!;
  const activeTab = activeWorkspace.terminals.find(
    ({ id }) => id === activeWorkspace.activeTerminalId,
  );

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    void invoke<DetectedProfile[]>("detect_shell_profiles")
      .then((detected) =>
        setState((current) => {
          const profiles = mergeDetectedProfiles(current.profiles, detected);
          return {
            ...current,
            profiles,
            settings: {
              ...current.settings,
              defaultProfileId: selectDefaultProfile(
                profiles,
                current.settings.defaultProfileId,
              ),
            },
          };
        }),
      )
      .catch(() => undefined);
  }, []);

  const resolveProfile = (id?: string): ShellProfile =>
    state.profiles.find(
      (profile) => profile.id === id && profile.enabled && profile.available,
    ) ??
    state.profiles.find(
      (profile) =>
        profile.id === state.settings.defaultProfileId &&
        profile.enabled &&
        profile.available,
    ) ??
    state.profiles.find((profile) => profile.enabled && profile.available) ??
    state.profiles[0]!;

  const createWorkspace = (name: string, cwd?: string) => {
    const id = crypto.randomUUID();
    setState((current) => {
      const profile =
        current.profiles.find(
          ({ id, enabled, available }) =>
            id === current.settings.defaultProfileId && enabled && available,
        ) ??
        current.profiles.find(({ enabled, available }) => enabled && available);
      if (!profile) return current;
      const tab = newTab(profile, [], cwd);
      return {
        ...current,
        activeWorkspaceId: id,
        workspaces: [
          ...current.workspaces,
          {
            id,
            name,
            ...(cwd ? { cwd } : {}),
            terminals: [tab],
            activeTerminalId: tab.id,
          },
        ],
      };
    });
  };

  const renameWorkspace = (id: string, name: string) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === id ? { ...workspace, name } : workspace,
      ),
    }));

  const deleteWorkspace = (id: string) =>
    setState((current) => {
      if (current.workspaces.length === 1) {
        const profile =
          current.profiles.find(
            ({ id, enabled, available }) =>
              id === current.settings.defaultProfileId && enabled && available,
          ) ??
          current.profiles.find(
            ({ enabled, available }) => enabled && available,
          );
        if (!profile) return current;
        const folderId = crypto.randomUUID();
        const tab = newTab(profile);
        return {
          ...current,
          workspaces: [
            {
              id: folderId,
              name: "Folder 1",
              terminals: [tab],
              activeTerminalId: tab.id,
            },
          ],
          activeWorkspaceId: folderId,
        };
      }
      const index = current.workspaces.findIndex(
        (workspace) => workspace.id === id,
      );
      const workspaces = current.workspaces.filter(
        (workspace) => workspace.id !== id,
      );
      return {
        ...current,
        workspaces,
        activeWorkspaceId:
          current.activeWorkspaceId === id
            ? workspaces[Math.min(index, workspaces.length - 1)]!.id
            : current.activeWorkspaceId,
      };
    });

  const selectWorkspace = (id: string) =>
    setState((current) =>
      current.workspaces.some((workspace) => workspace.id === id)
        ? { ...current, activeWorkspaceId: id }
        : current,
    );

  const duplicateWorkspace = (id: string) =>
    setState((current) => {
      const source = current.workspaces.find(
        (workspace) => workspace.id === id,
      );
      if (!source) return current;
      const tabMap = new Map<string, string>();
      const terminals = source.terminals.map((tab) => {
        const tabId = crypto.randomUUID();
        const [layout, paneMap] = cloneLayout(tab.layout);
        tabMap.set(tab.id, tabId);
        return {
          ...tab,
          id: tabId,
          layout,
          activePaneId: paneMap.get(tab.activePaneId) ?? paneIds(layout)[0]!,
        };
      });
      const copy: Workspace = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} Copy`,
        terminals,
        ...(source.activeTerminalId
          ? { activeTerminalId: tabMap.get(source.activeTerminalId) }
          : {}),
      };
      const index = current.workspaces.indexOf(source) + 1;
      const workspaces = [...current.workspaces];
      workspaces.splice(index, 0, copy);
      return { ...current, workspaces, activeWorkspaceId: copy.id };
    });

  const closeWorkspaceTerminals = (id: string) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === id
          ? { ...workspace, terminals: [], activeTerminalId: undefined }
          : workspace,
      ),
    }));

  const moveWorkspace = (id: string, index: number) =>
    setState((current) => {
      const workspaces = moveById(current.workspaces, id, index);
      return workspaces.every(
        (workspace, i) => workspace === current.workspaces[i],
      )
        ? current
        : { ...current, workspaces };
    });

  const moveActiveWorkspace = (delta: number) => {
    const index = state.workspaces.findIndex(
      ({ id }) => id === state.activeWorkspaceId,
    );
    moveWorkspace(state.activeWorkspaceId, index + delta);
  };

  const cycleWorkspace = (delta: number) => {
    const index = state.workspaces.findIndex(
      ({ id }) => id === state.activeWorkspaceId,
    );
    selectWorkspace(
      state.workspaces[
        (index + delta + state.workspaces.length) % state.workspaces.length
      ]!.id,
    );
  };

  const setSidebar = (patch: Partial<AppState["sidebar"]>) =>
    setState((current) => ({
      ...current,
      sidebar: {
        ...current.sidebar,
        ...patch,
        width:
          patch.width === undefined
            ? current.sidebar.width
            : Math.min(360, Math.max(160, patch.width)),
      },
    }));

  const createTerminal = (profileId?: string) => {
    setState((current) => {
      const profile =
        current.profiles.find(
          ({ id, enabled, available }) =>
            id === (profileId ?? current.settings.defaultProfileId) &&
            enabled &&
            available,
        ) ??
        current.profiles.find(({ enabled, available }) => enabled && available);
      if (!profile) return current;
      return {
        ...current,
        workspaces: current.workspaces.map((workspace) => {
          if (workspace.id !== current.activeWorkspaceId) return workspace;
          const activeTab = workspace.terminals.find(
            ({ id }) => id === workspace.activeTerminalId,
          );
          const tab = newTab(
            profile,
            workspace.terminals,
            (activeTab &&
              findPane(activeTab.layout, activeTab.activePaneId)?.cwd) ??
              workspace.cwd,
          );
          return {
            ...workspace,
            terminals: [...workspace.terminals, tab],
            activeTerminalId: tab.id,
          };
        }),
      };
    });
  };

  const closeTerminal = (
    tabId: string,
    workspaceId = state.activeWorkspaceId,
  ) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace;
        const index = workspace.terminals.findIndex(({ id }) => id === tabId);
        const terminals = workspace.terminals.filter(({ id }) => id !== tabId);
        return {
          ...workspace,
          terminals,
          activeTerminalId:
            workspace.activeTerminalId === tabId
              ? terminals[Math.min(index, terminals.length - 1)]?.id
              : workspace.activeTerminalId,
        };
      }),
    }));

  const closeTerminals = (
    tabIds: readonly string[],
    workspaceId = state.activeWorkspaceId,
  ) => {
    const ids = new Set(tabIds);
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace;
        const activeIndex = workspace.terminals.findIndex(
          ({ id }) => id === workspace.activeTerminalId,
        );
        const terminals = workspace.terminals.filter(({ id }) => !ids.has(id));
        return {
          ...workspace,
          terminals,
          activeTerminalId: terminals.some(
            ({ id }) => id === workspace.activeTerminalId,
          )
            ? workspace.activeTerminalId
            : terminals[Math.min(activeIndex, terminals.length - 1)]?.id,
        };
      }),
    }));
  };

  const renameTerminal = (
    tabId: string,
    title: string,
    workspaceId = state.activeWorkspaceId,
  ) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              terminals: workspace.terminals.map((tab) =>
                tab.id === tabId ? { ...tab, title } : tab,
              ),
            }
          : workspace,
      ),
    }));

  const duplicateTerminal = (
    tabId: string,
    workspaceId = state.activeWorkspaceId,
  ) =>
    setState((current) => ({
      ...current,
      activeWorkspaceId: workspaceId,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace;
        const index = workspace.terminals.findIndex(({ id }) => id === tabId);
        const source = workspace.terminals[index];
        if (!source) return workspace;
        const [layout, paneMap] = cloneLayout(source.layout);
        const copy: TerminalTab = {
          ...source,
          id: crypto.randomUUID(),
          title: `${source.title} Copy`,
          layout,
          activePaneId: paneMap.get(source.activePaneId) ?? paneIds(layout)[0]!,
        };
        const terminals = [...workspace.terminals];
        terminals.splice(index + 1, 0, copy);
        return { ...workspace, terminals, activeTerminalId: copy.id };
      }),
    }));

  const moveTerminal = (
    tabId: string,
    index: number,
    workspaceId = state.activeWorkspaceId,
  ) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== workspaceId) return workspace;
        const terminals = moveById(workspace.terminals, tabId, index);
        return terminals.every((tab, i) => tab === workspace.terminals[i])
          ? workspace
          : { ...workspace, terminals };
      }),
    }));

  const selectTerminal = (
    tabId: string,
    workspaceId = state.activeWorkspaceId,
  ) =>
    setState((current) => ({
      ...current,
      activeWorkspaceId: workspaceId,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId &&
        workspace.terminals.some(({ id }) => id === tabId)
          ? { ...workspace, activeTerminalId: tabId }
          : workspace,
      ),
    }));

  const splitActivePane = (direction: SplitDirection) => {
    const paneId = crypto.randomUUID();
    const splitId = crypto.randomUUID();
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== current.activeWorkspaceId) return workspace;
        return {
          ...workspace,
          terminals: workspace.terminals.map((tab) => {
            if (tab.id !== workspace.activeTerminalId) return tab;
            const source = findPane(tab.layout, tab.activePaneId);
            if (!source) return tab;
            return {
              ...tab,
              layout: splitPane(
                tab.layout,
                source.id,
                direction,
                {
                  id: paneId,
                  profileId: source.profileId,
                  ...(source.cwd ? { cwd: source.cwd } : {}),
                },
                splitId,
              ),
              activePaneId: paneId,
            };
          }),
        };
      }),
    }));
  };

  const closePane = (tabId: string, paneId: string) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) => {
        if (workspace.id !== current.activeWorkspaceId) return workspace;
        const tabIndex = workspace.terminals.findIndex(
          ({ id }) => id === tabId,
        );
        const tab = workspace.terminals[tabIndex];
        if (!tab) return workspace;
        const oldIds = paneIds(tab.layout);
        const layout = removePane(tab.layout, paneId);
        if (!layout) {
          const terminals = workspace.terminals.filter(
            ({ id }) => id !== tabId,
          );
          return {
            ...workspace,
            terminals,
            activeTerminalId:
              terminals[Math.min(tabIndex, terminals.length - 1)]?.id,
          };
        }
        const remaining = paneIds(layout);
        const nextPaneId =
          remaining[Math.min(oldIds.indexOf(paneId), remaining.length - 1)]!;
        return {
          ...workspace,
          terminals: workspace.terminals.map((item) =>
            item.id === tabId
              ? {
                  ...item,
                  layout,
                  activePaneId:
                    item.activePaneId === paneId
                      ? nextPaneId
                      : item.activePaneId,
                }
              : item,
          ),
        };
      }),
    }));

  const closeActivePane = () => {
    if (activeTab) closePane(activeTab.id, activeTab.activePaneId);
  };

  const focusPane = (tabId: string, paneId: string) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId
          ? {
              ...workspace,
              activeTerminalId: tabId,
              terminals: workspace.terminals.map((tab) =>
                tab.id === tabId ? { ...tab, activePaneId: paneId } : tab,
              ),
            }
          : workspace,
      ),
    }));

  const focusTarget = (workspaceId: string, tabId: string, paneId: string) =>
    setState((current) => ({
      ...current,
      activeWorkspaceId: workspaceId,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              activeTerminalId: tabId,
              terminals: workspace.terminals.map((tab) =>
                tab.id === tabId ? { ...tab, activePaneId: paneId } : tab,
              ),
            }
          : workspace,
      ),
    }));

  const movePaneFocus = (direction: FocusDirection) => {
    if (activeTab)
      focusPane(
        activeTab.id,
        moveFocus(activeTab.layout, activeTab.activePaneId, direction),
      );
  };

  const cyclePane = (delta: number) => {
    if (!activeTab) return;
    const ids = paneIds(activeTab.layout);
    const index = ids.indexOf(activeTab.activePaneId);
    focusPane(activeTab.id, ids[(index + delta + ids.length) % ids.length]!);
  };

  const setSplitRatio = (tabId: string, splitId: string, ratio: number) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId
          ? {
              ...workspace,
              terminals: workspace.terminals.map((tab) =>
                tab.id === tabId
                  ? { ...tab, layout: resizeSplit(tab.layout, splitId, ratio) }
                  : tab,
              ),
            }
          : workspace,
      ),
    }));

  const updateWorkingDirectory = (
    workspaceId: string,
    tabId: string,
    paneId: string,
    cwd: string,
  ) =>
    setState((current) => ({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === workspaceId
          ? {
              ...workspace,
              terminals: workspace.terminals.map((tab) =>
                tab.id === tabId
                  ? {
                      ...tab,
                      layout: updatePane(tab.layout, paneId, (pane) => ({
                        ...pane,
                        cwd,
                      })),
                    }
                  : tab,
              ),
            }
          : workspace,
      ),
    }));

  const cycleTerminal = () => {
    if (activeWorkspace.terminals.length < 2) return;
    const index = activeWorkspace.terminals.findIndex(
      ({ id }) => id === activeWorkspace.activeTerminalId,
    );
    selectTerminal(
      activeWorkspace.terminals[(index + 1) % activeWorkspace.terminals.length]!
        .id,
    );
  };

  const updateSettings = (patch: Partial<TerminalSettings>) =>
    setState((current) => {
      const settings = validateSettings({ ...current.settings, ...patch });
      settings.defaultProfileId = selectDefaultProfile(
        current.profiles,
        settings.defaultProfileId,
      );
      return { ...current, settings };
    });

  const updateProfile = (id: string, patch: Partial<ShellProfile>) =>
    setState((current) => {
      const profiles = current.profiles.map((profile) =>
        profile.id === id ? { ...profile, ...patch, id } : profile,
      );
      return {
        ...current,
        profiles,
        settings: {
          ...current.settings,
          defaultProfileId: selectDefaultProfile(
            profiles,
            current.settings.defaultProfileId,
          ),
        },
      };
    });

  const createProfile = (): string => {
    const id = crypto.randomUUID();
    setState((current) => ({
      ...current,
      profiles: [
        ...current.profiles,
        {
          id,
          name: "Custom shell",
          command: "powershell.exe",
          args: ["-NoLogo"],
          env: {},
          showInMenu: true,
          enabled: true,
          available: true,
        },
      ],
    }));
    return id;
  };

  const duplicateProfile = (sourceId: string): string => {
    const id = crypto.randomUUID();
    setState((current) => {
      const source = current.profiles.find(
        (profile) => profile.id === sourceId,
      );
      return source
        ? {
            ...current,
            profiles: [
              ...current.profiles,
              {
                ...source,
                id,
                name: `${source.name} Copy`,
                builtIn: undefined,
                available: true,
              },
            ],
          }
        : current;
    });
    return id;
  };

  const deleteProfile = (id: string) =>
    setState((current) => {
      const target = current.profiles.find((profile) => profile.id === id);
      if (!target || target.builtIn) return current;
      const profiles = current.profiles.filter((profile) => profile.id !== id);
      return {
        ...current,
        profiles,
        settings: {
          ...current.settings,
          defaultProfileId: selectDefaultProfile(
            profiles,
            current.settings.defaultProfileId,
          ),
        },
      };
    });

  return {
    state,
    activeWorkspace,
    activeTab,
    resolveProfile,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    selectWorkspace,
    duplicateWorkspace,
    closeWorkspaceTerminals,
    moveWorkspace,
    moveActiveWorkspace,
    cycleWorkspace,
    setSidebar,
    createTerminal,
    closeTerminal,
    closeTerminals,
    renameTerminal,
    duplicateTerminal,
    moveTerminal,
    selectTerminal,
    splitActivePane,
    closePane,
    closeActivePane,
    focusPane,
    focusTarget,
    movePaneFocus,
    cyclePane,
    setSplitRatio,
    updateWorkingDirectory,
    cycleTerminal,
    updateSettings,
    updateProfile,
    createProfile,
    duplicateProfile,
    deleteProfile,
  };
}

export type WorkspaceStore = ReturnType<typeof useWorkspaceStore>;
