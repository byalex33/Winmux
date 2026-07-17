import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { useEffect, useState } from "react";
import IconButton from "./IconButton";

const window = getCurrentWindow();

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const update = () => void window.isMaximized().then(setMaximized);
    update();
    const unlisten = window.onResized(update);
    return () => void unlisten.then((remove) => remove());
  }, []);
  const toggle = () => void window.toggleMaximize();
  return (
    <header
      className="titlebar"
      data-tauri-drag-region
      onDoubleClick={(event) => {
        if (!(event.target as HTMLElement).closest("button")) toggle();
      }}
    >
      <div className="titlebar-brand" data-tauri-drag-region>
        <span aria-hidden="true">›_</span> Winmux
      </div>
      <div className="titlebar-controls">
        <IconButton
          label="Minimize"
          variant="ghost"
          size="icon-sm"
          onClick={() => void window.minimize()}
        >
          <Minus />
        </IconButton>
        <IconButton
          label={maximized ? "Restore" : "Maximize"}
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
        >
          {maximized ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
        <IconButton
          label="Close"
          className="titlebar-close"
          variant="ghost"
          size="icon-sm"
          onClick={() => void window.close()}
        >
          <X />
        </IconButton>
      </div>
    </header>
  );
}
