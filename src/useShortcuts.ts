import { useEffect } from "react";
import type { FocusDirection } from "./layout";
import type { SplitDirection } from "./types";

interface Actions {
  closePane: () => void;
  createFolder: () => void;
  cycleTab: () => void;
  cycleFolder: (delta: number) => void;
  moveFocus: (direction: FocusDirection) => void;
  newTerminal: () => void;
  openPalette: () => void;
  openSearch: () => void;
  split: (direction: SplitDirection) => void;
  switchFolder: (index: number) => void;
}

export function useShortcuts(actions: Actions): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey && event.code.startsWith("Arrow")) {
        event.preventDefault();
        actions.moveFocus(event.code.slice(5).toLowerCase() as FocusDirection);
        return;
      }
      if (!event.ctrlKey) return;
      if (event.shiftKey && event.code === "KeyN") actions.createFolder();
      else if (!event.shiftKey && /^Digit[1-9]$/.test(event.code))
        actions.switchFolder(Number(event.code.at(-1)) - 1);
      else if (!event.shiftKey && event.code === "PageUp")
        actions.cycleFolder(-1);
      else if (!event.shiftKey && event.code === "PageDown")
        actions.cycleFolder(1);
      else if (!event.shiftKey && event.code === "KeyF") actions.openSearch();
      else if (event.shiftKey && event.code === "KeyP") actions.openPalette();
      else if (event.shiftKey && event.code === "KeyT") actions.newTerminal();
      else if (event.shiftKey && event.code === "KeyW") actions.closePane();
      else if (event.shiftKey && event.code === "KeyD") actions.split("row");
      else if (event.shiftKey && event.code === "KeyE") actions.split("column");
      else if (!event.shiftKey && event.code === "Tab") actions.cycleTab();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [actions]);
}
