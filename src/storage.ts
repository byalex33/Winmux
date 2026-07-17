import { paneIds } from "./layout";
import {
  defaultProfiles,
  legacyProfileId,
  selectDefaultProfile,
  validateProfile,
} from "./profiles";
import { defaultSettings, validateSettings } from "./settings";
import {
  legacyShells,
  type AppState,
  type LayoutNode,
  type LegacyShell,
  type ShellProfile,
  type TerminalTab,
  type Workspace,
} from "./types";

const key = "winmux.workspaces";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function createInitialState(id: string = crypto.randomUUID()): AppState {
  const profiles = defaultProfiles();
  const profile =
    profiles.find(({ id }) => id === "powershell") ?? profiles[0]!;
  const tabId = crypto.randomUUID();
  const paneId = crypto.randomUUID();
  return {
    version: 6,
    activeWorkspaceId: id,
    workspaces: [
      {
        id,
        name: "Folder 1",
        activeTerminalId: tabId,
        terminals: [
          {
            id: tabId,
            title: profile.name,
            activePaneId: paneId,
            layout: {
              type: "pane",
              pane: { id: paneId, profileId: profile.id },
            },
          },
        ],
      },
    ],
    sidebar: { collapsed: false, width: 224 },
    profiles,
    settings: defaultSettings(),
  };
}

const migratedProfileId = (
  value: Record<string, unknown>,
): string | undefined => {
  if (typeof value.profileId === "string" && value.profileId)
    return value.profileId;
  if (legacyShells.includes(value.shell as LegacyShell))
    return legacyProfileId(value.shell as LegacyShell);
};

function parseLayout(value: unknown): LayoutNode | undefined {
  if (!record(value)) return;
  if (
    value.type === "pane" &&
    record(value.pane) &&
    typeof value.pane.id === "string"
  ) {
    const profileId = migratedProfileId(value.pane);
    if (!profileId) return;
    return {
      type: "pane",
      pane: {
        id: value.pane.id,
        profileId,
        ...(typeof value.pane.cwd === "string" && value.pane.cwd
          ? { cwd: value.pane.cwd }
          : {}),
      },
    };
  }
  if (
    value.type === "split" &&
    typeof value.id === "string" &&
    (value.direction === "row" || value.direction === "column") &&
    typeof value.ratio === "number"
  ) {
    const first = parseLayout(value.first);
    const second = parseLayout(value.second);
    if (first && second)
      return {
        type: "split",
        id: value.id,
        direction: value.direction,
        ratio: Math.min(0.85, Math.max(0.15, value.ratio)),
        first,
        second,
      };
  }
}

function parseTab(value: unknown): TerminalTab | undefined {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string"
  )
    return;
  const layout = parseLayout(value.layout);
  if (!layout) return;
  const ids = paneIds(layout);
  return {
    id: value.id,
    title: value.title,
    layout,
    activePaneId:
      typeof value.activePaneId === "string" && ids.includes(value.activePaneId)
        ? value.activePaneId
        : ids[0]!,
  };
}

function parseWorkspace(value: unknown): Workspace | undefined {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !value.name.trim()
  )
    return;
  const terminals = Array.isArray(value.terminals)
    ? value.terminals
        .map(parseTab)
        .filter((tab): tab is TerminalTab => Boolean(tab))
    : [];
  return {
    id: value.id,
    name: value.name,
    ...(typeof value.cwd === "string" && value.cwd ? { cwd: value.cwd } : {}),
    terminals,
    ...(terminals.length
      ? {
          activeTerminalId:
            typeof value.activeTerminalId === "string" &&
            terminals.some(({ id }) => id === value.activeTerminalId)
              ? value.activeTerminalId
              : terminals[0]!.id,
        }
      : {}),
  };
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}

export function deserializeState(value: string | null): AppState {
  try {
    const parsed = JSON.parse(value ?? "null") as unknown;
    if (record(parsed) && Array.isArray(parsed.workspaces)) {
      const workspaces = parsed.workspaces
        .map(parseWorkspace)
        .filter((workspace): workspace is Workspace => Boolean(workspace));
      if (workspaces.length) {
        const storedProfiles = Array.isArray(parsed.profiles)
          ? parsed.profiles
              .map(validateProfile)
              .filter((profile): profile is ShellProfile => Boolean(profile))
          : [];
        const profiles = storedProfiles.length
          ? storedProfiles
          : defaultProfiles();
        const settings = validateSettings(parsed.settings);
        settings.defaultProfileId = selectDefaultProfile(
          profiles,
          settings.defaultProfileId,
        );
        return {
          version: 6,
          workspaces,
          profiles,
          settings,
          sidebar: {
            collapsed:
              record(parsed.sidebar) && parsed.sidebar.collapsed === true,
            width:
              record(parsed.sidebar) && typeof parsed.sidebar.width === "number"
                ? Math.min(360, Math.max(160, parsed.sidebar.width))
                : 224,
          },
          activeWorkspaceId:
            typeof parsed.activeWorkspaceId === "string" &&
            workspaces.some(({ id }) => id === parsed.activeWorkspaceId)
              ? parsed.activeWorkspaceId
              : workspaces[0]!.id,
        };
      }
    }
  } catch {
    // Invalid local preferences should never prevent startup.
  }
  return createInitialState();
}

export function loadState(): AppState {
  const state = deserializeState(localStorage.getItem(key));
  return state.settings.restoreLayouts
    ? state
    : {
        ...state,
        workspaces: state.workspaces.map((workspace) => ({
          ...workspace,
          terminals: [],
          activeTerminalId: undefined,
        })),
      };
}

export const saveState = (state: AppState): void =>
  localStorage.setItem(key, serializeState(state));
