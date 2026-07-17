import { resolveTheme } from "./registry";
import type { ThemeId } from "./types";

export const validAccent = (value: unknown): value is string =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value);

export interface ThemeSelection {
  themeId: ThemeId;
  useThemeAccent: boolean;
  customAccent: string;
}

export function applyTheme(
  selection: ThemeSelection,
  root: HTMLElement = document.documentElement,
): void {
  const theme = resolveTheme(selection.themeId);
  const { tokens } = theme;
  const resolvedAccent =
    !selection.useThemeAccent && validAccent(selection.customAccent)
      ? selection.customAccent
      : tokens.primary;
  const variables: Record<string, string> = {
    background: tokens.applicationBackground,
    foreground: tokens.foreground,
    card: tokens.dialogBackground,
    "card-foreground": tokens.foreground,
    popover: tokens.popoverBackground,
    "popover-foreground": tokens.foreground,
    primary: resolvedAccent,
    "primary-foreground": tokens.primaryForeground,
    secondary: tokens.secondary,
    "secondary-foreground": tokens.secondaryForeground,
    muted: tokens.hoverBackground,
    "muted-foreground": tokens.mutedText,
    accent: tokens.accent,
    "accent-foreground": tokens.accentForeground,
    destructive: tokens.destructive,
    "destructive-foreground": tokens.destructiveForeground,
    border: tokens.border,
    input: tokens.inputBackground,
    ring: resolvedAccent,
    sidebar: tokens.sidebarBackground,
    toolbar: tokens.toolbarBackground,
    terminal: tokens.terminalSurface,
    active: tokens.activeItemBackground,
    success: tokens.success,
    warning: tokens.warning,
    error: tokens.error,
    selection: tokens.selectionBackground,
    "scrollbar-track": tokens.scrollbarTrack,
    "scrollbar-thumb": tokens.scrollbarThumb,
    "source-radius": tokens.radius,
    shadow: tokens.shadow,
    "resolved-accent": resolvedAccent,
  };
  root.dataset.theme = theme.id;
  for (const [name, value] of Object.entries(variables))
    root.style.setProperty(`--${name}`, value);
}
