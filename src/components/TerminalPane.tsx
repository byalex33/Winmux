import { openUrl } from "@tauri-apps/plugin-opener";
import { Channel, invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon, type ISearchOptions } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { activityStore, bellAllowed } from "../activity";
import { safeHttpUrl } from "../links";
import { initialSearchState, searchReducer } from "../search";
import { profileSetting } from "../settings";
import { integratedLaunch, parseShellEvent } from "../shellIntegration";
import { registerTerminal } from "../terminalRegistry";
import type { Pane, ShellProfile, TerminalSettings } from "../types";
import { conservativeWaitingDetector } from "../waitingDetection";
import TerminalSearch from "./TerminalSearch";

type TerminalEvent = { event: "output"; data: number[] } | { event: "exit" };
interface TerminalCreated {
  id: number;
  cwd?: string;
}

interface ProcessActivity {
  hasForegroundProcess: boolean;
  foregroundPid?: number;
  foregroundProcess?: string;
}

const searchOptions: ISearchOptions = {
  decorations: {
    matchBackground: "#854d0e",
    matchOverviewRuler: "#facc15",
    activeMatchBackground: "#0891b2",
    activeMatchColorOverviewRuler: "#22d3ee",
  },
};

function parseWorkingDirectory(
  value: string,
  isWsl: boolean,
): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "file:") return;
    let path = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:\//.test(path)) path = path.slice(1);
    return isWsl ? path : path.replaceAll("/", "\\");
  } catch {
    return;
  }
}

interface Props {
  active: boolean;
  workspaceId: string;
  tabId: string;
  pane: Pane;
  profile: ShellProfile;
  settings: TerminalSettings;
  onFocus: () => void;
  onWorkingDirectory: (cwd: string) => void;
}

export default function TerminalPane(props: Props) {
  const {
    active,
    workspaceId,
    tabId,
    pane,
    profile,
    settings,
    onFocus,
    onWorkingDirectory,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal>(null);
  const fitRef = useRef<FitAddon>(null);
  const searchAddonRef = useRef<SearchAddon>(null);
  const processIdRef = useRef<number>(undefined);
  const lastBellRef = useRef(0);
  const [generation, setGeneration] = useState(0);
  const [search, dispatchSearch] = useReducer(
    searchReducer,
    initialSearchState,
  );
  const handleFocus = useEffectEvent(onFocus);
  const handleWorkingDirectory = useEffectEvent(onWorkingDirectory);
  const currentSession = useEffectEvent(() => ({ pane, profile, settings }));

  useEffect(
    () =>
      registerTerminal(pane.id, {
        focus: () => terminalRef.current?.focus(),
        openSearch: () => dispatchSearch({ type: "open" }),
        reload: () => setGeneration((value) => value + 1),
        hasForegroundProcess: async () =>
          processIdRef.current === undefined
            ? false
            : invoke<boolean>("terminal_has_foreground_process", {
                id: processIdRef.current,
              }),
      }),
    [pane.id],
  );

  useEffect(() => {
    const session = currentSession();
    const activityEnabled = () => {
      const current = currentSession();
      return profileSetting(current.settings, current.profile.id, "tracking");
    };
    const trackingAtLaunch = activityEnabled();
    const sessionId = crypto.randomUUID();
    activityStore.register({ workspaceId, tabId, paneId: pane.id, sessionId });
    const container = containerRef.current!;
    const terminal = new Terminal({
      cursorBlink: session.settings.cursorBlink,
      cursorStyle: session.settings.cursorStyle,
      fontFamily: session.settings.fontFamily,
      fontSize: session.settings.fontSize,
      lineHeight: session.settings.lineHeight,
      scrollback: session.settings.scrollback,
      theme: {
        background: "#0a0d12",
        foreground: "#d6d9df",
        cursor: "#7dd3fc",
        cursorAccent: "#0a0d12",
        selectionBackground: "#164e6380",
        black: "#151a22",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#d1d5db",
        brightBlack: "#6b7280",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde047",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f9fafb",
      },
    });
    const fit = new FitAddon();
    const searchAddon = new SearchAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(
      new WebLinksAddon((event, value) => {
        const url = event.ctrlKey ? safeHttpUrl(value) : undefined;
        if (url) void openUrl(url).catch(() => undefined);
      }),
    );
    terminal.open(container);
    terminalRef.current = terminal;
    fitRef.current = fit;
    searchAddonRef.current = searchAddon;

    let processId: number | undefined;
    let disposed = false;
    let lastOutputDispatch = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!disposed) callback();
      }, delay);
      timers.add(timer);
    };
    const clearCompletedLater = () =>
      later(() => {
        if (activityStore.get(pane.id)?.state === "completed")
          activityStore.dispatch(pane.id, { type: "clear" });
      }, session.settings.completedClearDelay * 1000);
    const pendingInput: string[] = [];
    const channel = new Channel<TerminalEvent>();
    channel.onmessage = (message) => {
      if (disposed) return;
      if (message.event === "output") {
        terminal.write(new Uint8Array(message.data));
        const now = Date.now();
        if (activityEnabled() && now - lastOutputDispatch >= 500) {
          lastOutputDispatch = now;
          activityStore.dispatch(pane.id, { type: "output" }, now);
        }
      } else {
        terminal.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n");
        if (activityEnabled()) {
          activityStore.dispatch(pane.id, { type: "processExited" });
          clearCompletedLater();
        }
      }
    };
    const osc = terminal.parser.registerOscHandler(7, (value) => {
      const cwd = parseWorkingDirectory(value, session.profile.id === "wsl");
      if (cwd) handleWorkingDirectory(cwd);
      return true;
    });
    const shellOsc = terminal.parser.registerOscHandler(633, (value) => {
      const event = parseShellEvent(value);
      if (!event) return false;
      if (event.type === "started") {
        if (activityEnabled())
          activityStore.dispatch(pane.id, {
            type: "commandStarted",
            command: event.command,
          });
      } else if (event.type === "completed") {
        const before = activityStore.get(pane.id);
        if (activityEnabled() && before?.state === "running")
          activityStore.dispatch(pane.id, {
            type: "commandCompleted",
            exitCode: event.exitCode,
          });
        if (event.cwd) handleWorkingDirectory(event.cwd);
        if (
          activityEnabled() &&
          before?.state === "running" &&
          event.exitCode === 0
        )
          clearCompletedLater();
      } else if (event.cwd) handleWorkingDirectory(event.cwd);
      return true;
    });
    const searchResults = searchAddon.onDidChangeResults(
      ({ resultIndex, resultCount }) =>
        dispatchSearch({
          type: "results",
          current: resultCount && resultIndex >= 0 ? resultIndex + 1 : 0,
          total: resultCount,
        }),
    );
    container.addEventListener("focusin", handleFocus);

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      fit.fit();
      if (processId !== undefined)
        void invoke("resize_terminal", {
          id: processId,
          cols: terminal.cols,
          rows: terminal.rows,
        });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const input = terminal.onData((data) => {
      if (data) activityStore.dispatch(pane.id, { type: "input" });
      if (processId !== undefined)
        void invoke("write_terminal", { id: processId, data });
      else pendingInput.push(data);
    });
    const bell = terminal.onBell(() => {
      const current = currentSession();
      if (current.settings.bellBehavior === "disabled") return;
      const now = Date.now();
      if (!bellAllowed(lastBellRef.current, now)) return;
      lastBellRef.current = now;
      activityStore.dispatch(pane.id, { type: "bell" }, now);
      if (current.settings.bellBehavior === "sound") {
        try {
          const audio = new AudioContext();
          const oscillator = audio.createOscillator();
          oscillator.connect(audio.destination);
          oscillator.frequency.value = 660;
          oscillator.start();
          oscillator.stop(audio.currentTime + 0.08);
          oscillator.addEventListener("ended", () => void audio.close());
        } catch {
          // Audio permission and unavailable devices must not affect the PTY.
        }
      }
      const silenceMs = current.settings.waitingSilenceSeconds * 1000;
      later(
        () => {
          const record = activityStore.get(pane.id);
          if (
            record &&
            profileSetting(
              current.settings,
              current.profile.id,
              "waitingDetection",
            ) &&
            conservativeWaitingDetector.shouldWait(
              {
                kind: "bell",
                foreground: record.foreground,
                lastOutputAt: record.lastOutputAt,
                signaledAt: now,
              },
              Date.now(),
              silenceMs,
            )
          )
            activityStore.dispatch(pane.id, { type: "waiting" });
          else if (record?.state === "bell")
            activityStore.dispatch(pane.id, { type: "clear" });
        },
        Math.max(3000, silenceMs),
      );
    });
    const selection = terminal.onSelectionChange(() => {
      if (currentSession().settings.copyOnSelection && terminal.hasSelection())
        void navigator.clipboard
          .writeText(terminal.getSelection())
          .catch(() => undefined);
    });

    const integration =
      trackingAtLaunch &&
      profileSetting(session.settings, session.profile.id, "shellIntegration")
        ? integratedLaunch(session.profile)
        : { args: session.profile.args, env: session.profile.env };
    void invoke<TerminalCreated>("create_terminal", {
      request: {
        command: session.profile.command,
        args: integration.args,
        env: integration.env,
        cwd: session.pane.cwd ?? session.profile.cwd ?? null,
        cols: terminal.cols,
        rows: terminal.rows,
      },
      onEvent: channel,
    })
      .then(({ id, cwd }) => {
        if (disposed) {
          void invoke("close_terminal", { id });
          return;
        }
        processId = id;
        processIdRef.current = id;
        if (cwd) handleWorkingDirectory(cwd);
        for (const data of pendingInput)
          void invoke("write_terminal", { id, data });
        pendingInput.length = 0;
        resize();
        const poll = async () => {
          if (disposed || processId === undefined) return;
          if (!activityEnabled()) {
            if (activityStore.get(pane.id)?.state !== "idle")
              activityStore.dispatch(pane.id, { type: "clear" });
            later(() => void poll(), 1500);
            return;
          }
          try {
            const activity = await invoke<ProcessActivity>(
              "terminal_process_activity",
              { id: processId },
            );
            const before = activityStore.get(pane.id);
            activityStore.dispatch(pane.id, {
              type: "foreground",
              running: activity.hasForegroundProcess,
              processName: activity.foregroundProcess,
            });
            if (
              before?.foreground &&
              !activity.hasForegroundProcess &&
              activityStore.get(pane.id)?.state === "completed"
            )
              clearCompletedLater();
          } catch {
            // Process enumeration is best-effort; the terminal remains usable.
          }
          later(() => void poll(), 1500);
        };
        void poll();
      })
      .catch((error: unknown) => {
        terminal.write(
          `\r\n\x1b[31mFailed to start ${session.profile.name}: ${String(error)}\x1b[0m\r\n`,
        );
      });

    return () => {
      disposed = true;
      observer.disconnect();
      for (const timer of timers) clearTimeout(timer);
      input.dispose();
      selection.dispose();
      searchResults.dispose();
      container.removeEventListener("focusin", handleFocus);
      osc.dispose();
      shellOsc.dispose();
      bell.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      searchAddonRef.current = null;
      processIdRef.current = undefined;
      activityStore.remove(pane.id);
      if (processId !== undefined)
        void invoke("close_terminal", { id: processId });
    };
  }, [generation, pane.id, tabId, workspaceId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontFamily = settings.fontFamily;
    terminal.options.fontSize = settings.fontSize;
    terminal.options.lineHeight = settings.lineHeight;
    terminal.options.cursorStyle = settings.cursorStyle;
    terminal.options.cursorBlink = settings.cursorBlink;
    terminal.options.scrollback = settings.scrollback;
    fitRef.current?.fit();
  }, [settings]);

  useEffect(() => {
    if (!active) return;
    activityStore.dispatch(pane.id, { type: "focused" });
    requestAnimationFrame(() => {
      fitRef.current?.fit();
      terminalRef.current?.focus();
    });
  }, [active, pane.id]);

  const find = (query: string, previous = false) => {
    dispatchSearch({ type: "query", query });
    if (!query) {
      searchAddonRef.current?.clearDecorations();
      return;
    }
    searchAddonRef.current?.[previous ? "findPrevious" : "findNext"](query, {
      ...searchOptions,
      incremental: !previous,
    });
  };
  const closeSearch = () => {
    searchAddonRef.current?.clearDecorations();
    dispatchSearch({ type: "close" });
    terminalRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="terminal-panel">
      <TerminalSearch
        state={search}
        onChange={find}
        onClose={closeSearch}
        onNext={() => find(search.query)}
        onPrevious={() => find(search.query, true)}
      />
    </div>
  );
}
