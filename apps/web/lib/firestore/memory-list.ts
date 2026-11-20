import type { MemoryDoc, MemorySector } from "../firestore-docs/memory-doc";

const memorySectors: readonly MemorySector[] = [
  "semantic",
  "episodic",
  "procedural",
  "emotional",
  "general",
];

type MemoryRow = { id: string; doc: MemoryDoc };

export function pickMemories(
  rows: readonly MemoryRow[],
  search: string
): {
  rows: MemoryRow[];
  total: number;
  bySector: Record<MemorySector, number>;
} {
  const bySector = Object.fromEntries(
    memorySectors.map((sector) => [sector, 0])
  ) as Record<MemorySector, number>;
  const liveRows = rows.filter(({ doc }) => doc.deletedAt === undefined);

  for (const { doc } of liveRows) {
    bySector[doc.sector] += 1;
  }

  const query = search.trim().toLowerCase();
  const matchingRows =
    query.length === 0
      ? liveRows
      : liveRows.filter(({ doc }) => doc.content.toLowerCase().includes(query));

  return {
    rows: matchingRows.slice().sort((left, right) => {
      const newestFirst = right.doc.updatedAt - left.doc.updatedAt;
      if (newestFirst !== 0) return newestFirst;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    }),
    total: liveRows.length,
    bySector,
  };
}
