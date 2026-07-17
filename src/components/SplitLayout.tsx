import {
  Eraser,
  RefreshCw,
  SplitSquareHorizontal,
  SplitSquareVertical,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { paneActivity, useActivityVersion } from "../activity";
import { minimumSize } from "../layout";
import type {
  LayoutNode,
  ShellProfile,
  SplitDirection,
  TerminalSettings,
  TerminalTab,
} from "../types";
import ActivityIndicator from "./ActivityIndicator";
import IconButton from "./IconButton";

const TerminalPane = lazy(() => import("./TerminalPane"));

interface Props {
  workspaceId: string;
  tab: TerminalTab;
  visible: boolean;
  profiles: ShellProfile[];
  settings: TerminalSettings;
  onClose: (tabId: string, paneId: string) => void;
  onFocus: (tabId: string, paneId: string) => void;
  onResize: (tabId: string, splitId: string, ratio: number) => void;
  onRestart: (paneId: string) => void;
  onClearActivity: (paneId: string) => void;
  onSplit: (direction: SplitDirection) => void;
  onWorkingDirectory: (
    workspaceId: string,
    tabId: string,
    paneId: string,
    cwd: string,
  ) => void;
}

export default function SplitLayout(props: Props) {
  return (
    <div className={`layout-root ${props.visible ? "" : "hidden"}`}>
      <Suspense>
        <Layout node={props.tab.layout} {...props} />
      </Suspense>
    </div>
  );
}

function Layout({ node, ...props }: Props & { node: LayoutNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useActivityVersion();
  if (node.type === "pane") {
    const focused = props.visible && props.tab.activePaneId === node.pane.id;
    const profile =
      props.profiles.find(({ id }) => id === node.pane.profileId) ??
      props.profiles.find(({ id }) => id === props.settings.defaultProfileId) ??
      props.profiles[0]!;
    const activity = paneActivity(node.pane.id)?.state ?? "idle";
    return (
      <section
        className={`layout-pane layout-pane-${activity} ${focused ? "layout-pane-focused" : ""}`}
        onPointerDown={() => props.onFocus(props.tab.id, node.pane.id)}
      >
        <div className="pane-activity">
          <ActivityIndicator state={activity} />
        </div>
        <div className="pane-controls">
          <IconButton
            label="Split right (Ctrl+Shift+D)"
            variant="ghost"
            size="icon-xs"
            onClick={() => props.onSplit("row")}
          >
            <SplitSquareVertical />
          </IconButton>
          <IconButton
            label="Split down (Ctrl+Shift+E)"
            variant="ghost"
            size="icon-xs"
            onClick={() => props.onSplit("column")}
          >
            <SplitSquareHorizontal />
          </IconButton>
          <IconButton
            label="Restart pane"
            variant="ghost"
            size="icon-xs"
            onClick={() => props.onRestart(node.pane.id)}
          >
            <RefreshCw />
          </IconButton>
          <IconButton
            label="Clear activity state"
            variant="ghost"
            size="icon-xs"
            onClick={() => props.onClearActivity(node.pane.id)}
          >
            <Eraser />
          </IconButton>
          <IconButton
            label="Close pane (Ctrl+Shift+W)"
            variant="ghost"
            size="icon-xs"
            onClick={() => props.onClose(props.tab.id, node.pane.id)}
          >
            <X />
          </IconButton>
        </div>
        <TerminalPane
          active={focused}
          workspaceId={props.workspaceId}
          tabId={props.tab.id}
          pane={node.pane}
          profile={profile}
          settings={props.settings}
          onFocus={() => props.onFocus(props.tab.id, node.pane.id)}
          onWorkingDirectory={(cwd) =>
            props.onWorkingDirectory(
              props.workspaceId,
              props.tab.id,
              node.pane.id,
              cwd,
            )
          }
        />
      </section>
    );
  }

  const axisSize = (rect: DOMRect) =>
    node.direction === "row" ? rect.width : rect.height;
  const startDrag = (event: ReactPointerEvent) => {
    event.preventDefault();
    const container = containerRef.current!;
    const move = (pointer: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const size = axisSize(rect);
      const position =
        node.direction === "row"
          ? pointer.clientX - rect.left
          : pointer.clientY - rect.top;
      const minimum = Math.min(
        0.45,
        minimumSize(node.first, node.direction) / size,
      );
      const maximum = Math.max(
        0.55,
        1 - minimumSize(node.second, node.direction) / size,
      );
      props.onResize(
        props.tab.id,
        node.id,
        Math.min(maximum, Math.max(minimum, position / size)),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };
  const adjust = (amount: number) =>
    props.onResize(props.tab.id, node.id, node.ratio + amount);
  const firstStyle: CSSProperties = {
    flex: `0 0 calc(${node.ratio * 100}% - 2px)`,
    minWidth: minimumSize(node.first, "row"),
    minHeight: minimumSize(node.first, "column"),
  };
  const secondStyle: CSSProperties = {
    flex: "1 0 auto",
    minWidth: minimumSize(node.second, "row"),
    minHeight: minimumSize(node.second, "column"),
  };
  return (
    <div ref={containerRef} className={`split-layout split-${node.direction}`}>
      <div className="split-child" style={firstStyle}>
        <Layout node={node.first} {...props} />
      </div>
      <div
        className="split-divider"
        role="separator"
        tabIndex={0}
        aria-orientation={node.direction === "row" ? "vertical" : "horizontal"}
        onPointerDown={startDrag}
        onKeyDown={(event) => {
          if (event.code === "ArrowLeft" || event.code === "ArrowUp")
            adjust(-0.05);
          else if (event.code === "ArrowRight" || event.code === "ArrowDown")
            adjust(0.05);
          else return;
          event.preventDefault();
        }}
      />
      <div className="split-child" style={secondStyle}>
        <Layout node={node.second} {...props} />
      </div>
    </div>
  );
}
