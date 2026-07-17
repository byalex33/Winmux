import type { LegacyShell, ShellProfile } from "./types";

export interface DetectedProfile {
  id: string;
  command: string;
}

export const legacyProfileId = (shell: LegacyShell): string => shell;

export const defaultProfiles = (): ShellProfile[] => [
  {
    id: "powershell",
    name: "PowerShell",
    command: "powershell.exe",
    args: ["-NoLogo"],
    env: {},
    icon: "powershell",
    showInMenu: true,
    enabled: true,
    available: true,
    builtIn: true,
  },
  {
    id: "cmd",
    name: "Command Prompt",
    command: "cmd.exe",
    args: [],
    env: {},
    icon: "terminal",
    showInMenu: true,
    enabled: true,
    available: true,
    builtIn: true,
  },
  {
    id: "wsl",
    name: "WSL",
    command: "wsl.exe",
    args: [],
    env: {},
    icon: "linux",
    showInMenu: true,
    enabled: true,
    available: false,
    builtIn: true,
  },
];

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function validateProfile(value: unknown): ShellProfile | undefined {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    typeof value.command !== "string" ||
    !value.command.trim() ||
    !Array.isArray(value.args) ||
    !value.args.every((arg) => typeof arg === "string") ||
    !record(value.env) ||
    !Object.values(value.env).every((entry) => typeof entry === "string")
  )
    return;
  return {
    id: value.id,
    name: value.name.trim(),
    command: value.command.trim(),
    args: value.args,
    env: value.env as Record<string, string>,
    ...(typeof value.cwd === "string" && value.cwd ? { cwd: value.cwd } : {}),
    ...(typeof value.icon === "string" && value.icon
      ? { icon: value.icon }
      : {}),
    showInMenu: value.showInMenu !== false,
    enabled: value.enabled !== false,
    available: value.available !== false,
    ...(value.builtIn === true ? { builtIn: true } : {}),
  };
}

export function mergeDetectedProfiles(
  profiles: ShellProfile[],
  detected: DetectedProfile[],
): ShellProfile[] {
  const found = new Map(
    detected.map((profile) => [profile.id, profile.command]),
  );
  const merged = profiles.map((profile) =>
    profile.builtIn
      ? {
          ...profile,
          available: found.has(profile.id),
          command: found.get(profile.id) ?? profile.command,
        }
      : profile,
  );
  const gitBash = found.get("git-bash");
  if (gitBash && !merged.some(({ id }) => id === "git-bash"))
    merged.push({
      id: "git-bash",
      name: "Git Bash",
      command: gitBash,
      args: ["--login", "-i"],
      env: {},
      icon: "git",
      showInMenu: true,
      enabled: true,
      available: true,
      builtIn: true,
    });
  return merged;
}

export function selectDefaultProfile(
  profiles: ShellProfile[],
  requested: string,
): string {
  const usable = (profile: ShellProfile) =>
    profile.enabled && profile.available;
  return (
    profiles.find((profile) => profile.id === requested && usable(profile))
      ?.id ??
    profiles.find(usable)?.id ??
    profiles[0]?.id ??
    "powershell"
  );
}
