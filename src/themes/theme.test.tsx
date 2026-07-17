// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, test, vi } from "vitest";
import { defaultSettings, validateSettings } from "../settings";
import {
  createInitialState,
  deserializeState,
  serializeState,
} from "../storage";
import { applyTheme, validAccent } from "./apply-theme";
import { defaultThemeId, resolveTheme, themes } from "./registry";

const requiredTokens = [
  "applicationBackground",
  "sidebarBackground",
  "toolbarBackground",
  "terminalSurface",
  "popoverBackground",
  "dialogBackground",
  "inputBackground",
  "activeItemBackground",
  "hoverBackground",
  "border",
  "mutedText",
  "foreground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "accent",
  "accentForeground",
  "destructive",
  "success",
  "warning",
  "error",
  "focusRing",
  "selectionBackground",
  "scrollbarTrack",
  "scrollbarThumb",
  "radius",
  "shadow",
] as const;

describe("bundled themes", () => {
  test("registers all seven unique themes with every required token", () => {
    expect(themes).toHaveLength(7);
    expect(new Set(themes.map(({ id }) => id)).size).toBe(7);
    for (const theme of themes) {
      expect(theme.source).toMatch(/^https:\/\/tweakcn\.com\/themes\//);
      for (const token of requiredTokens)
        expect(theme.tokens[token]).toBeTruthy();
    }
  });

  test("uses designbyte by default and falls back from invalid identifiers", () => {
    expect(defaultSettings().themeId).toBe("designbyte");
    expect(defaultThemeId).toBe("designbyte");
    expect(resolveTheme("missing").id).toBe("designbyte");
  });

  test("applies, previews, and cancels themes through one root attribute", () => {
    const root = document.createElement("div");
    const applied = {
      themeId: "designbyte" as const,
      useThemeAccent: true,
      customAccent: "#22d3ee",
    };
    applyTheme(applied, root);
    expect(root.dataset.theme).toBe("designbyte");
    applyTheme({ ...applied, themeId: "sky" }, root);
    expect(root.dataset.theme).toBe("sky");
    applyTheme(applied, root);
    expect(root.dataset.theme).toBe("designbyte");
  });

  test("resolves theme and custom accents without deleting the saved override", () => {
    const root = document.createElement("div");
    applyTheme(
      { themeId: "sky", useThemeAccent: true, customAccent: "#123456" },
      root,
    );
    expect(root.style.getPropertyValue("--primary")).toBe(
      resolveTheme("sky").tokens.primary,
    );
    applyTheme(
      { themeId: "sky", useThemeAccent: false, customAccent: "#123456" },
      root,
    );
    expect(root.style.getPropertyValue("--primary")).toBe("#123456");
    expect(validAccent("#aBc123")).toBe(true);
    expect(validAccent("red")).toBe(false);
    expect(validAccent("#12345")).toBe(false);
  });

  test("persists theme selection and migrates legacy accents at version 6", () => {
    const state = createInitialState("folder");
    state.settings = {
      ...state.settings,
      themeId: "openclaw",
      useThemeAccent: false,
      customAccent: "#123456",
    };
    const restored = deserializeState(serializeState(state));
    expect(restored.version).toBe(6);
    expect(restored.settings).toMatchObject({
      themeId: "openclaw",
      useThemeAccent: false,
      customAccent: "#123456",
    });
    expect(validateSettings({ accentColor: "#654321" })).toMatchObject({
      themeId: "designbyte",
      useThemeAccent: false,
      customAccent: "#654321",
    });
    expect(validateSettings({ themeId: "invalid" }).themeId).toBe("designbyte");
  });

  test("theme changes do not remount terminal-pane children", () => {
    const mounted = vi.fn();
    function TerminalSentinel() {
      useEffect(mounted, []);
      return <div data-testid="terminal-pane" />;
    }
    render(<TerminalSentinel />);
    applyTheme({
      themeId: "autoblog",
      useThemeAccent: true,
      customAccent: "#22d3ee",
    });
    applyTheme({
      themeId: "2077",
      useThemeAccent: true,
      customAccent: "#22d3ee",
    });
    expect(mounted).toHaveBeenCalledTimes(1);
  });
});
