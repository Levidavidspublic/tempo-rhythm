export type LiveChange<T> = {
  type: "added" | "modified" | "removed";
  id: string;
  data?: T;
};

export type LiveList<T> = {
  byId: Record<string, T>;
  items: Array<{ id: string; data: T }>;
};

type LiveItem<T> = LiveList<T>["items"][number];
type SortableDocument = { createdAt?: unknown; deletedAt?: unknown };

export function emptyLiveList<T>(): LiveList<T> {
  return { byId: {}, items: [] };
}

function defaultCompare<T>(left: LiveItem<T>, right: LiveItem<T>): number {
  const leftCreatedAt = (left.data as SortableDocument).createdAt;
  const rightCreatedAt = (right.data as SortableDocument).createdAt;
  const leftTime = typeof leftCreatedAt === "number" ? leftCreatedAt : 0;
  const rightTime = typeof rightCreatedAt === "number" ? rightCreatedAt : 0;

  return leftTime - rightTime || left.id.localeCompare(right.id);
}

export function applyLiveChanges<T>(
  list: LiveList<T>,
  changes: readonly LiveChange<T>[],
  compare?: (left: LiveItem<T>, right: LiveItem<T>) => number
): LiveList<T> {
  let byId: Record<string, T> | undefined;

  for (const change of changes) {
    if (change.id.length === 0) continue;
    if (change.type !== "removed" && change.data === undefined) continue;

    const currentById = byId ?? list.byId;
    if (change.type === "removed") {
      if (!Object.hasOwn(currentById, change.id)) continue;
      byId ??= { ...list.byId };
      delete byId[change.id];
    } else {
      if (Object.hasOwn(currentById, change.id) && currentById[change.id] === change.data) continue;
      byId ??= { ...list.byId };
      byId[change.id] = change.data as T;
    }
  }

  if (byId === undefined) return list;

  const items = Object.entries(byId)
    .filter(([, data]) => typeof (data as SortableDocument).deletedAt !== "number")
    .map(([id, data]) => ({ id, data }))
    .sort(compare ?? defaultCompare);

  return { byId, items };
}
