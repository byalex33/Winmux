export const legacyShells = ["powershell", "cmd", "wsl"] as const;
export type LegacyShell = (typeof legacyShells)[number];
export type SplitDirection = "row" | "column";
export type CursorStyle = "block" | "underline" | "bar";
export type ActivityState =
  "idle" | "running" | "waiting" | "completed" | "failed" | "bell";
export type BellBehavior = "disabled" | "visual" | "notify" | "sound";
export type OverrideSetting = "inherit" | "enabled" | "disabled";
import type { ThemeId } from "./themes/types";

export interface ProfileActivityOverride {
  tracking: OverrideSetting;
  shellIntegration: OverrideSetting;
  waitingDetection: OverrideSetting;
}

export interface ShellProfile {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  icon?: string;
  showInMenu: boolean;
  enabled: boolean;
  available: boolean;
  builtIn?: boolean;
}

export interface TerminalSettings {
  themeId: ThemeId;
  useThemeAccent: boolean;
  customAccent: string;
  defaultProfileId: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelection: boolean;
  confirmCloseRunning: boolean;
  restoreLayouts: boolean;
  activityTracking: boolean;
  shellIntegration: boolean;
  waitingDetection: boolean;
  notificationsEnabled: boolean;
  completionNotifications: boolean;
  failureNotifications: boolean;
  waitingNotifications: boolean;
  bellBehavior: BellBehavior;
  minimumCommandDuration: number;
  completedClearDelay: number;
  notificationCommandName: boolean;
  waitingSilenceSeconds: number;
  profileActivityOverrides: Record<string, ProfileActivityOverride>;
}

export interface Pane {
  id: string;
  profileId: string;
  cwd?: string;
}

export interface PaneNode {
  type: "pane";
  pane: Pane;
}

export interface SplitNode {
  type: "split";
  id: string;
  direction: SplitDirection;
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
}

export type LayoutNode = PaneNode | SplitNode;

export interface TerminalTab {
  id: string;
  title: string;
  layout: LayoutNode;
  activePaneId: string;
}

export interface Workspace {
  id: string;
  name: string;
  cwd?: string;
  terminals: TerminalTab[];
  activeTerminalId?: string;
}

export interface AppState {
  version: 6;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  sidebar: {
    collapsed: boolean;
    width: number;
  };
  profiles: ShellProfile[];
  settings: TerminalSettings;
}
