/** Pick the next item in a rotating queue — skipped items defer to the back. */
export function getNextInQueue<T extends { id: string }>(
  items: T[],
  completedIds: string[],
  skippedIds: string[],
  compare?: (a: T, b: T) => number,
): T | null {
  const sorted = compare ? [...items].sort(compare) : [...items];
  const completed = new Set(completedIds);
  const remaining = sorted.filter((item) => !completed.has(item.id));
  if (remaining.length === 0) return null;

  const remainingIds = new Set(remaining.map((item) => item.id));
  const skippedSet = new Set(skippedIds.filter((id) => remainingIds.has(id)));

  const active = remaining.find((item) => !skippedSet.has(item.id));
  if (active) return active;

  // Everyone deferred — return the front of the skip rotation.
  for (const skippedId of skippedIds) {
    const deferred = remaining.find((item) => item.id === skippedId);
    if (deferred) return deferred;
  }

  return remaining[0];
}

/** Move an id to the back of the skipped list (defer for later in this round). */
export function appendSkippedId(skippedIds: string[], id: string): string[] {
  return [...skippedIds.filter((existing) => existing !== id), id];
}

/** Undo the most recent skip — remove the last deferred item so it becomes current again. */
export function popSkippedId(skippedIds: string[]): string[] | null {
  if (skippedIds.length === 0) return null;
  return skippedIds.slice(0, -1);
}
