import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { WorkspaceStore } from "../../useWorkspaceStore";
import { applyTheme, validAccent } from "../../themes/apply-theme";
import { defaultThemeId } from "../../themes/registry";
import type { ThemeId } from "../../themes/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import ThemeSelector from "./ThemeSelector";

export default function AppearanceSettings({
  store,
}: {
  store: WorkspaceStore;
}) {
  const applied = store.state.settings;
  const [themeId, setThemeId] = useState<ThemeId>(applied.themeId);
  const [useThemeAccent, setUseThemeAccent] = useState(applied.useThemeAccent);
  const [customAccent, setCustomAccent] = useState(applied.customAccent);
  const selection = { themeId, useThemeAccent, customAccent };

  useEffect(() => {
    applyTheme({ themeId, useThemeAccent, customAccent });
  }, [themeId, useThemeAccent, customAccent]);

  const cancel = () => {
    setThemeId(applied.themeId);
    setUseThemeAccent(applied.useThemeAccent);
    setCustomAccent(applied.customAccent);
    applyTheme(applied);
  };
  const apply = () => {
    if (!useThemeAccent && !validAccent(customAccent)) return;
    store.updateSettings(selection);
    toast.success("Theme applied");
  };
  const reset = () => {
    const next = {
      ...selection,
      themeId: defaultThemeId,
      useThemeAccent: true,
    };
    setThemeId(next.themeId);
    setUseThemeAccent(true);
    store.updateSettings(next);
    applyTheme(next);
    toast.success("Theme reset");
  };
  const invalid = !useThemeAccent && !validAccent(customAccent);
  return (
    <div className="settings-section">
      <div>
        <h3>Theme</h3>
        <p>Preview locally, then apply to persist the selection.</p>
      </div>
      <ThemeSelector value={themeId} onChange={setThemeId} />
      <div className="setting-row">
        <div>
          <label htmlFor="theme-accent">Use theme accent</label>
          <p>Use the selected theme’s intentional primary colour.</p>
        </div>
        <Switch
          id="theme-accent"
          checked={useThemeAccent}
          onCheckedChange={setUseThemeAccent}
        />
      </div>
      <div className="setting-field">
        <label htmlFor="custom-accent">Custom accent</label>
        <div className="accent-input">
          <Input
            id="custom-accent"
            value={customAccent}
            disabled={useThemeAccent}
            aria-invalid={invalid}
            onChange={(event) => setCustomAccent(event.target.value)}
          />
          <span
            style={{
              background: validAccent(customAccent)
                ? customAccent
                : "transparent",
            }}
          />
        </div>
        {invalid && (
          <p className="field-error">
            Enter a six-digit hex colour, for example #22d3ee.
          </p>
        )}
      </div>
      <div className="settings-actions">
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw /> Reset to default
        </Button>
        <span />
        <Button variant="outline" size="sm" onClick={cancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={invalid} onClick={apply}>
          Apply
        </Button>
      </div>
    </div>
  );
}
