<div align="center">
  <img src="src-tauri/icons/icon.png" width="112" alt="Winmux icon" />

# Winmux

### The command center Windows terminals deserve.

Organize shells by project. Split them into panes. Know when the work is done.

[![CI](https://github.com/byalex33/Winmux/actions/workflows/ci.yml/badge.svg)](https://github.com/byalex33/Winmux/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-35e6a1.svg)](LICENSE)
[![Windows](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d4.svg?logo=windows11)](#requirements)
[![Tauri](https://img.shields.io/badge/Tauri-2-24c8db.svg?logo=tauri&logoColor=white)](https://tauri.app/)
[![Preview](https://img.shields.io/badge/status-public%20preview-f59e0b.svg)](#project-status)

[Get started](#get-started) · [Features](#why-winmux) · [Shortcuts](#keyboard-first) · [Contribute](#contributing)

</div>

<img src="artifacts/winmux-live-terminal.png" alt="Winmux running a PowerShell terminal in a native Windows window" width="100%" />

## One window. Every command line.

Winmux is a native Windows terminal workspace built for people who live in shells. It groups terminals into persistent project folders, gives every tab a resizable split layout, and surfaces meaningful activity without turning your desktop into notification confetti.

No server. No account. No cloud workspace. Your terminals and settings stay on your machine.

> [!IMPORTANT]
> Winmux is in public preview. The core workflow is usable today, but interfaces and saved settings may evolve before 1.0.

## Why Winmux?

| | Capability | What it changes |
| :--: | --- | --- |
| 📁 | **Project folders** | Keep each codebase, environment, or mission in its own terminal workspace. |
| ◫ | **Split layouts** | Run the app, tests, logs, and debugger side by side in one tab. |
| ⚡ | **Command palette** | Fuzzy-find actions without leaving the keyboard. |
| ◉ | **Activity signals** | See completed, failed, waiting, and bell states at a glance. |
| 🔔 | **Native notifications** | Get useful Windows notifications when an unfocused command needs you. |
| >_ | **Real shell profiles** | Use PowerShell, Command Prompt, WSL, Git Bash, or your own executable. |
| ◇ | **Seven built-in themes** | Start with a considered theme, then tune fonts, cursor, accent, and spacing. |
| ↺ | **Persistent workspaces** | Restore folders, tabs, pane trees, ratios, profiles, and settings. |

<table>
  <tr>
    <td width="50%"><img src="artifacts/winmux-command-palette.png" alt="Winmux command palette" /></td>
    <td width="50%"><img src="artifacts/winmux-final-settings.png" alt="Winmux appearance settings" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Everything is a command</strong></td>
    <td align="center"><strong>Make the cockpit yours</strong></td>
  </tr>
</table>

## Get started

### Requirements

- Windows 10 or 11
- [Node.js 22+](https://nodejs.org/)
- [Rust stable](https://www.rust-lang.org/tools/install) with the MSVC toolchain
- Microsoft Edge WebView2 (already included on current Windows installs)

### Run from source

```powershell
git clone https://github.com/byalex33/Winmux.git
cd Winmux
npm install
npm run tauri dev
```

### Build an installer

```powershell
npm run tauri build
```

Tauri writes the Windows installers to `src-tauri/target/release/bundle/`.

## Keyboard first

| Action | Shortcut |
| --- | :---: |
| Command palette | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> |
| New terminal | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> |
| Create folder | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd> |
| Split right / down | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> / <kbd>E</kbd> |
| Close pane | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>W</kbd> |
| Search terminal | <kbd>Ctrl</kbd> + <kbd>F</kbd> |
| Next tab | <kbd>Ctrl</kbd> + <kbd>Tab</kbd> |
| Switch folder | <kbd>Ctrl</kbd> + <kbd>1</kbd>…<kbd>9</kbd> |
| Previous / next folder | <kbd>Ctrl</kbd> + <kbd>PageUp</kbd> / <kbd>PageDown</kbd> |
| Move between panes | <kbd>Alt</kbd> + <kbd>Arrow</kbd> |

## Seven moods. One workflow.

Every theme controls the full interface and terminal palette—not just an accent colour.

<table>
  <tr>
    <td width="33%"><img src="artifacts/themes/designbyte.png" alt="designbyte theme" /></td>
    <td width="33%"><img src="artifacts/themes/2077.png" alt="2077 theme" /></td>
    <td width="33%"><img src="artifacts/themes/sky.png" alt="Sky theme" /></td>
  </tr>
  <tr>
    <td align="center"><strong>designbyte</strong></td>
    <td align="center"><strong>2077</strong></td>
    <td align="center"><strong>Sky</strong></td>
  </tr>
  <tr>
    <td width="33%"><img src="artifacts/themes/shopify-red.png" alt="Shopify Red theme" /></td>
    <td width="33%"><img src="artifacts/themes/openclaw.png" alt="OpenClaw theme" /></td>
    <td width="33%"><img src="artifacts/themes/black-and-pink.png" alt="Black and pink theme" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Shopify Red</strong></td>
    <td align="center"><strong>OpenClaw</strong></td>
    <td align="center"><strong>Black and pink</strong></td>
  </tr>
</table>

## Under the hood

```mermaid
flowchart LR
    UI[React + TypeScript] -->|Tauri commands| CORE[Rust desktop core]
    CORE --> PTY[portable-pty]
    PTY --> SHELLS[PowerShell · CMD · WSL · Git Bash]
    CORE --> WIN[Windows notifications + process state]
```

- **Frontend:** React 19, TypeScript, Vite, xterm.js, Radix UI
- **Desktop shell:** Tauri 2
- **Terminal engine:** Rust and `portable-pty`
- **Quality:** ESLint, Prettier, Vitest, Testing Library, GitHub Actions

The frontend owns workspace state, layouts, themes, commands, and terminal rendering. The small Rust core owns PTY processes, shell detection, foreground-process checks, and native Windows integration.

## Project status

Winmux is an early public preview focused on getting the terminal-workspace loop right.

- [x] Folders, terminal tabs, and nested split panes
- [x] Shell discovery and custom profiles
- [x] Persistent layouts and settings
- [x] Search, context menus, and command palette
- [x] Activity tracking and native notifications
- [x] Theme and terminal customization
- [ ] Signed installers through GitHub Releases
- [ ] Configurable keyboard shortcuts
- [ ] Workspace import and export

Have a stronger next step? [Open an issue](https://github.com/byalex33/Winmux/issues) and make the case.

## Development

```powershell
npm install          # dependencies
npm run tauri dev    # desktop app with hot reload
npm test             # test suite
npm run lint         # lint the codebase
npm run typecheck    # TypeScript checks
npm run build        # production frontend
```

## Contributing

Issues, focused pull requests, theme ideas, and Windows edge cases are welcome.

1. Fork the repository and branch from `main`.
2. Keep each change focused and include the smallest useful test.
3. Run `npm run lint`, `npm test`, and `npm run build`.
4. Open a pull request explaining the user-visible change.

For vulnerabilities, use GitHub's **private security advisory** flow instead of a public issue.

## License

Winmux is released under the [MIT License](LICENSE).

---

<div align="center">
  <strong>Built for Windows. Designed for flow.</strong>
  <br /><br />
  If Winmux makes your terminal life calmer, consider giving the project a ⭐
</div>
