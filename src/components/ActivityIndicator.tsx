import { Bell, Check, CircleDotDashed, Hourglass, X } from "lucide-react";
import { activityLabel } from "../activity";
import type { ActivityState } from "../types";

const icons = {
  running: CircleDotDashed,
  waiting: Hourglass,
  completed: Check,
  failed: X,
  bell: Bell,
};

export default function ActivityIndicator({ state }: { state: ActivityState }) {
  if (state === "idle") return null;
  const label = activityLabel[state];
  const Indicator = icons[state];
  return (
    <span
      className={`activity-indicator activity-${state}`}
      data-activity-state={state}
      role="status"
      title={label}
      aria-label={label}
    >
      <Indicator aria-hidden="true" />
    </span>
  );
}
