import type { LayoutNode, Pane, PaneNode, SplitDirection } from "./types";

export type FocusDirection = "left" | "right" | "up" | "down";

export const paneNode = (pane: Pane): PaneNode => ({ type: "pane", pane });

export function paneIds(node: LayoutNode): string[] {
  return node.type === "pane"
    ? [node.pane.id]
    : [...paneIds(node.first), ...paneIds(node.second)];
}

export function findPane(node: LayoutNode, id: string): Pane | undefined {
  if (node.type === "pane") return node.pane.id === id ? node.pane : undefined;
  return findPane(node.first, id) ?? findPane(node.second, id);
}

export function cloneLayout(
  node: LayoutNode,
  nextId: () => string = () => crypto.randomUUID(),
): [LayoutNode, Map<string, string>] {
  const paneMap = new Map<string, string>();
  const clone = (current: LayoutNode): LayoutNode => {
    if (current.type === "pane") {
      const id = nextId();
      paneMap.set(current.pane.id, id);
      return { ...current, pane: { ...current.pane, id } };
    }
    return {
      ...current,
      id: nextId(),
      first: clone(current.first),
      second: clone(current.second),
    };
  };
  return [clone(node), paneMap];
}

export function splitPane(
  node: LayoutNode,
  paneId: string,
  direction: SplitDirection,
  pane: Pane,
  splitId: string,
): LayoutNode {
  if (node.type === "pane") {
    return node.pane.id === paneId
      ? {
          type: "split",
          id: splitId,
          direction,
          ratio: 0.5,
          first: node,
          second: paneNode(pane),
        }
      : node;
  }
  return {
    ...node,
    first: splitPane(node.first, paneId, direction, pane, splitId),
    second: splitPane(node.second, paneId, direction, pane, splitId),
  };
}

export function removePane(
  node: LayoutNode,
  paneId: string,
): LayoutNode | null {
  if (node.type === "pane") return node.pane.id === paneId ? null : node;
  const first = removePane(node.first, paneId);
  const second = removePane(node.second, paneId);
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
}

export function updatePane(
  node: LayoutNode,
  paneId: string,
  update: (pane: Pane) => Pane,
): LayoutNode {
  if (node.type === "pane")
    return node.pane.id === paneId ? paneNode(update(node.pane)) : node;
  return {
    ...node,
    first: updatePane(node.first, paneId, update),
    second: updatePane(node.second, paneId, update),
  };
}

export function resizeSplit(
  node: LayoutNode,
  splitId: string,
  ratio: number,
): LayoutNode {
  if (node.type === "pane") return node;
  if (node.id === splitId)
    return { ...node, ratio: Math.min(0.85, Math.max(0.15, ratio)) };
  return {
    ...node,
    first: resizeSplit(node.first, splitId, ratio),
    second: resizeSplit(node.second, splitId, ratio),
  };
}

interface Rect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function rectangles(
  node: LayoutNode,
  left = 0,
  top = 0,
  right = 1,
  bottom = 1,
): Rect[] {
  if (node.type === "pane")
    return [{ id: node.pane.id, left, top, right, bottom }];
  if (node.direction === "row") {
    const middle = left + (right - left) * node.ratio;
    return [
      ...rectangles(node.first, left, top, middle, bottom),
      ...rectangles(node.second, middle, top, right, bottom),
    ];
  }
  const middle = top + (bottom - top) * node.ratio;
  return [
    ...rectangles(node.first, left, top, right, middle),
    ...rectangles(node.second, left, middle, right, bottom),
  ];
}

export function moveFocus(
  node: LayoutNode,
  paneId: string,
  direction: FocusDirection,
): string {
  const rects = rectangles(node);
  const current = rects.find(({ id }) => id === paneId);
  if (!current) return paneId;
  const horizontal = direction === "left" || direction === "right";
  const forward = direction === "right" || direction === "down";
  const center = (rect: Rect) =>
    horizontal ? (rect.top + rect.bottom) / 2 : (rect.left + rect.right) / 2;
  const candidates = rects
    .filter((rect) => {
      const overlaps = horizontal
        ? rect.bottom > current.top && rect.top < current.bottom
        : rect.right > current.left && rect.left < current.right;
      if (!overlaps) return false;
      if (direction === "right")
        return rect.left >= current.right - Number.EPSILON;
      if (direction === "left")
        return rect.right <= current.left + Number.EPSILON;
      if (direction === "down")
        return rect.top >= current.bottom - Number.EPSILON;
      return rect.bottom <= current.top + Number.EPSILON;
    })
    .map((rect) => {
      const edge = horizontal
        ? forward
          ? rect.left - current.right
          : current.left - rect.right
        : forward
          ? rect.top - current.bottom
          : current.top - rect.bottom;
      return {
        id: rect.id,
        score: edge * 10 + Math.abs(center(rect) - center(current)),
      };
    })
    .sort((a, b) => a.score - b.score);
  return candidates[0]?.id ?? paneId;
}

export function minimumSize(
  node: LayoutNode,
  direction: SplitDirection,
): number {
  const paneMinimum = direction === "row" ? 160 : 100;
  if (node.type === "pane") return paneMinimum;
  const first = minimumSize(node.first, direction);
  const second = minimumSize(node.second, direction);
  return node.direction === direction
    ? first + second + 4
    : Math.max(first, second);
}
