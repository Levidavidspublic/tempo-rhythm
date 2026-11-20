export type PagedList<T extends { id: string }> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  requestId: number;
};

export function emptyPagedList<T extends { id: string }>(): PagedList<T> {
  return {
    items: [],
    nextCursor: null,
    hasMore: true,
    loading: false,
    requestId: 0,
  };
}

export function startPage<T extends { id: string }>(
  list: PagedList<T>,
  options: { reset?: boolean } = {}
): PagedList<T> {
  const reset = options.reset === true;
  if (!reset && (list.loading || (!list.hasMore && list.requestId > 0))) {
    return list;
  }

  return {
    ...list,
    items: reset ? [] : list.items,
    nextCursor: reset ? null : list.nextCursor,
    loading: true,
    requestId: list.requestId + 1,
  };
}

export function applyPage<T extends { id: string }>(
  list: PagedList<T>,
  page: {
    requestId: number;
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }
): PagedList<T> {
  if (page.requestId !== list.requestId) return list;

  const ids = new Set(list.items.map((item) => item.id));
  const items = [...list.items];
  for (const item of page.items) {
    if (ids.has(item.id)) continue;
    ids.add(item.id);
    items.push(item);
  }

  return {
    ...list,
    items,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore && page.nextCursor !== null && page.nextCursor.trim().length > 0,
    loading: false,
  };
}

export function failPage<T extends { id: string }>(
  list: PagedList<T>,
  requestId: number
): PagedList<T> {
  if (requestId !== list.requestId) return list;
  return { ...list, loading: false };
}
