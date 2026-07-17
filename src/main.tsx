import { createRoot } from "react-dom/client";
import App from "./App";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { loadState } from "./storage";
import { applyTheme } from "./themes/apply-theme";
import "./styles.css";
import "@xterm/xterm/css/xterm.css";

applyTheme(loadState().settings);

createRoot(document.getElementById("root")!).render(
  <TooltipProvider delayDuration={350}>
    <App />
    <Toaster position="bottom-right" />
  </TooltipProvider>,
);
