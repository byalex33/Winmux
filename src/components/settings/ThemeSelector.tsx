import type { ThemeId } from "../../themes/types";
import { themes } from "../../themes/registry";
import ThemePreview from "./ThemePreview";

export default function ThemeSelector({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (value: ThemeId) => void;
}) {
  return (
    <div className="theme-grid" role="group" aria-label="Bundled themes">
      {themes.map((theme) => (
        <ThemePreview
          key={theme.id}
          theme={theme}
          selected={theme.id === value}
          onSelect={() => onChange(theme.id)}
        />
      ))}
    </div>
  );
}
