import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SearchState } from "../search";
import IconButton from "./IconButton";
import { Input } from "./ui/input";

interface Props {
  state: SearchState;
  onChange: (query: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export default function TerminalSearch({
  state,
  onChange,
  onClose,
  onNext,
  onPrevious,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.open) inputRef.current?.focus();
  }, [state.open]);
  if (!state.open) return null;
  return (
    <div
      className="terminal-search"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Input
        ref={inputRef}
        value={state.query}
        placeholder="Find in terminal"
        aria-label="Find in terminal"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          else if (event.key === "Enter" && event.shiftKey) onPrevious();
          else if (event.key === "Enter") onNext();
          else return;
          event.preventDefault();
        }}
      />
      <span>{state.total ? `${state.current}/${state.total}` : "0/0"}</span>
      <IconButton
        label="Previous match (Shift+Enter)"
        variant="ghost"
        size="icon-xs"
        onClick={onPrevious}
      >
        <ArrowUp />
      </IconButton>
      <IconButton
        label="Next match (Enter)"
        variant="ghost"
        size="icon-xs"
        onClick={onNext}
      >
        <ArrowDown />
      </IconButton>
      <IconButton
        label="Close search (Escape)"
        variant="ghost"
        size="icon-xs"
        onClick={onClose}
      >
        <X />
      </IconButton>
    </div>
  );
}
