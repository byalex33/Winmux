import { Check } from "lucide-react";
import type { ThemeDefinition } from "../../themes/types";

export default function ThemePreview({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const { tokens } = theme;
  return (
    <button
      type="button"
      className="theme-preview"
      data-selected={selected}
      aria-pressed={selected}
      aria-label={`${theme.name}${selected ? ", selected" : ""}`}
      onClick={onSelect}
    >
      <span className="theme-swatches" aria-hidden="true">
        {[
          tokens.applicationBackground,
          tokens.toolbarBackground,
          tokens.primary,
          tokens.foreground,
          tokens.border,
        ].map((color, index) => (
          <i key={index} style={{ background: color }} />
        ))}
      </span>
      <span>{theme.name}</span>
      {selected && <Check aria-hidden="true" />}
    </button>
  );
}
