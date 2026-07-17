export function moveById<T extends { id: string }>(
  items: readonly T[],
  id: string,
  index: number,
): T[] {
  const from = items.findIndex((item) => item.id === id);
  const to = Math.min(items.length - 1, Math.max(0, index));
  if (from < 0 || from === to) return [...items];
  const moved = [...items];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item!);
  return moved;
}
