import type { ShellProfile } from "./types";

export type ShellEvent =
  | { type: "prompt"; cwd?: string }
  | { type: "started"; command?: string }
  | { type: "completed"; exitCode: number; cwd?: string };

const decode = (value?: string): string | undefined => {
  if (!value) return;
  try {
    const bytes = Uint8Array.from(atob(value), (character) =>
      character.charCodeAt(0),
    );
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded.length <= 4096 ? decoded : undefined;
  } catch {
    return;
  }
};

export function parseShellEvent(value: string): ShellEvent | undefined {
  if (value.length > 12_000) return;
  if (value.startsWith("winmux;prompt-raw;")) {
    const cwd = value.slice(18);
    return cwd &&
      [...cwd].every((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      ? { type: "prompt", cwd }
      : undefined;
  }
  const [owner, kind, first, second] = value.split(";");
  if (owner !== "winmux") return;
  if (kind === "prompt") return { type: "prompt", cwd: decode(first) };
  if (kind === "started") return { type: "started", command: decode(first) };
  if (kind === "completed") {
    const exitCode = Number(first);
    if (
      !Number.isSafeInteger(exitCode) ||
      exitCode < -(2 ** 31) ||
      exitCode >= 2 ** 31
    )
      return;
    return { type: "completed", exitCode, cwd: decode(second) };
  }
}

const powershellScript = [
  "function global:__wm_b64([string]$value) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value)) }",
  'function global:__wm_event([string]$value) { [Console]::Write("`e]633;winmux;$value`e\\") }',
  "$global:__wm_original_prompt = (Get-Item Function:\\prompt).ScriptBlock",
  "$global:__wm_started = $false",
  "Import-Module PSReadLine -ErrorAction SilentlyContinue",
  "if (Get-Module PSReadLine) {",
  '  Set-PSReadLineOption -AddToHistoryHandler { param($line) $global:__wm_started = $true; __wm_event "started;$(__wm_b64 $line)"; return $true }',
  "}",
  "function global:prompt {",
  "  $code = if ($null -eq $global:LASTEXITCODE) { 0 } else { $global:LASTEXITCODE }",
  '  if ($global:__wm_started) { __wm_event "completed;$code;$(__wm_b64 $PWD.Path)"; $global:__wm_started = $false }',
  '  __wm_event "prompt;$(__wm_b64 $PWD.Path)"',
  "  & $global:__wm_original_prompt",
  "}",
].join("\n");

const encodedPowerShell = () => {
  let binary = "";
  for (const character of powershellScript) {
    const code = character.charCodeAt(0);
    binary += String.fromCharCode(code & 255, code >> 8);
  }
  return btoa(binary);
};

export function integratedLaunch(profile: ShellProfile): {
  args: string[];
  env: Record<string, string>;
} {
  if (
    profile.id === "powershell" &&
    !profile.args.some((argument) =>
      ["-command", "-encodedcommand", "-file"].includes(argument.toLowerCase()),
    )
  )
    return {
      args: [
        ...profile.args,
        "-NoExit",
        "-EncodedCommand",
        encodedPowerShell(),
      ],
      env: profile.env,
    };
  if (profile.id === "cmd")
    return {
      args: profile.args,
      env: {
        ...profile.env,
        PROMPT: "$E]633;winmux;prompt-raw;$P$E\\$P$G",
      },
    };
  // Bash reads PROMPT_COMMAND from the session environment. User startup files
  // may replace it; process tracking remains the safe fallback when they do.
  if (profile.id === "git-bash" || profile.id === "wsl")
    return {
      args: profile.args,
      env: {
        ...profile.env,
        PROMPT_COMMAND:
          '__wm_ec=$?; printf "\\033]633;winmux;completed;%s;%s\\033\\\\" "$__wm_ec" "$(printf %s "$PWD" | base64 -w0 2>/dev/null || printf %s "$PWD" | base64)"; printf "\\033]633;winmux;prompt;%s\\033\\\\" "$(printf %s "$PWD" | base64 -w0 2>/dev/null || printf %s "$PWD" | base64)"',
      },
    };
  return { args: profile.args, env: profile.env };
}
