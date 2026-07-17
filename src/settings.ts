import type { TerminalSettings } from "./types";
import { validAccent } from "./themes/apply-theme";
import { defaultThemeId, isThemeId } from "./themes/registry";

export const defaultSettings = (): TerminalSettings => ({
  themeId: defaultThemeId,
  useThemeAccent: true,
  customAccent: "#22d3ee",
  defaultProfileId: "powershell",
  fontFamily: '"Cascadia Mono", "Cascadia Code", Consolas, monospace',
  fontSize: 14,
  lineHeight: 1.2,
  cursorStyle: "bar",
  cursorBlink: true,
  scrollback: 10_000,
  copyOnSelection: false,
  confirmCloseRunning: true,
  restoreLayouts: true,
  activityTracking: true,
  shellIntegration: false,
  waitingDetection: true,
  notificationsEnabled: true,
  completionNotifications: true,
  failureNotifications: true,
  waitingNotifications: true,
  bellBehavior: "visual",
  minimumCommandDuration: 10,
  completedClearDelay: 30,
  notificationCommandName: true,
  waitingSilenceSeconds: 3,
  profileActivityOverrides: {},
});

const number = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export function validateSettings(value: unknown): TerminalSettings {
  const defaults = defaultSettings();
  if (typeof value !== "object" || value === null) return defaults;
  const input = value as Record<string, unknown>;
  const legacyAccent = validAccent(input.accentColor)
    ? input.accentColor
    : validAccent(input.accentColour)
      ? input.accentColour
      : undefined;
  const boolean = (key: keyof TerminalSettings): boolean =>
    typeof input[key] === "boolean"
      ? (input[key] as boolean)
      : Boolean(defaults[key]);
  const overrides: TerminalSettings["profileActivityOverrides"] = {};
  if (
    typeof input.profileActivityOverrides === "object" &&
    input.profileActivityOverrides !== null
  ) {
    for (const [id, value] of Object.entries(
      input.profileActivityOverrides as Record<string, unknown>,
    )) {
      if (!id || typeof value !== "object" || value === null) continue;
      const record = value as Record<string, unknown>;
      const setting = (key: string) =>
        record[key] === "enabled" || record[key] === "disabled"
          ? record[key]
          : "inherit";
      overrides[id] = {
        tracking: setting("tracking"),
        shellIntegration: setting("shellIntegration"),
        waitingDetection: setting("waitingDetection"),
      };
    }
  }
  return {
    themeId: isThemeId(input.themeId) ? input.themeId : defaultThemeId,
    useThemeAccent:
      typeof input.useThemeAccent === "boolean"
        ? input.useThemeAccent
        : legacyAccent
          ? false
          : defaults.useThemeAccent,
    customAccent: validAccent(input.customAccent)
      ? input.customAccent
      : (legacyAccent ?? defaults.customAccent),
    defaultProfileId:
      typeof input.defaultProfileId === "string"
        ? input.defaultProfileId
        : defaults.defaultProfileId,
    fontFamily:
      typeof input.fontFamily === "string" && input.fontFamily.trim()
        ? input.fontFamily
        : defaults.fontFamily,
    fontSize: number(input.fontSize, defaults.fontSize, 8, 32),
    lineHeight: number(input.lineHeight, defaults.lineHeight, 0.8, 2),
    cursorStyle:
      input.cursorStyle === "block" ||
      input.cursorStyle === "underline" ||
      input.cursorStyle === "bar"
        ? input.cursorStyle
        : defaults.cursorStyle,
    cursorBlink: boolean("cursorBlink"),
    scrollback: Math.round(
      number(input.scrollback, defaults.scrollback, 100, 100_000),
    ),
    copyOnSelection: boolean("copyOnSelection"),
    confirmCloseRunning: boolean("confirmCloseRunning"),
    restoreLayouts: boolean("restoreLayouts"),
    activityTracking: boolean("activityTracking"),
    shellIntegration: boolean("shellIntegration"),
    waitingDetection: boolean("waitingDetection"),
    notificationsEnabled: boolean("notificationsEnabled"),
    completionNotifications: boolean("completionNotifications"),
    failureNotifications: boolean("failureNotifications"),
    waitingNotifications: boolean("waitingNotifications"),
    bellBehavior:
      input.bellBehavior === "disabled" ||
      input.bellBehavior === "visual" ||
      input.bellBehavior === "notify" ||
      input.bellBehavior === "sound"
        ? input.bellBehavior
        : defaults.bellBehavior,
    minimumCommandDuration: number(
      input.minimumCommandDuration,
      defaults.minimumCommandDuration,
      0,
      3600,
    ),
    completedClearDelay: number(
      input.completedClearDelay,
      defaults.completedClearDelay,
      0,
      3600,
    ),
    notificationCommandName: boolean("notificationCommandName"),
    waitingSilenceSeconds: number(
      input.waitingSilenceSeconds,
      defaults.waitingSilenceSeconds,
      1,
      300,
    ),
    profileActivityOverrides: overrides,
  };
}

export function profileSetting(
  settings: TerminalSettings,
  profileId: string,
  key: "tracking" | "shellIntegration" | "waitingDetection",
): boolean {
  const override = settings.profileActivityOverrides[profileId]?.[key];
  return override === "inherit" || override === undefined
    ? settings[
        key === "tracking"
          ? "activityTracking"
          : key === "shellIntegration"
            ? "shellIntegration"
            : "waitingDetection"
      ]
    : override === "enabled";
}

export const serializeSettings = (settings: TerminalSettings): string =>
  JSON.stringify(settings);
