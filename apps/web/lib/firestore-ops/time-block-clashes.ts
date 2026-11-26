import type { TimeBlockDoc } from "../firestore-docs/time-block-doc";

type TimeBlockClash = {
  firstId: string;
  secondId: string;
  overlapMinutes: number;
};

type TimeBlockClashResult = {
  pairs: TimeBlockClash[];
  clashingIds: string[];
  count: number;
};

export function findTimeBlockClashes<T extends TimeBlockDoc & { id: string }>(
  blocks: readonly T[],
  localDate: string
): TimeBlockClashResult {
  const keptBlocks = blocks
    .filter((block) => {
      const endMinute = block.startMinute + block.durationMinutes;
      return (
        block.localDate === localDate &&
        block.deletedAt === undefined &&
        block.status !== "skipped" &&
        Number.isFinite(block.startMinute) &&
        Number.isFinite(block.durationMinutes) &&
        block.durationMinutes > 0 &&
        Number.isFinite(endMinute)
      );
    })
    .sort((a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id));

  const pairs: TimeBlockClash[] = [];
  const clashingIdSet = new Set<string>();

  for (let firstIndex = 0; firstIndex < keptBlocks.length; firstIndex += 1) {
    const first = keptBlocks[firstIndex];
    const firstEnd = first.startMinute + first.durationMinutes;

    for (let secondIndex = firstIndex + 1; secondIndex < keptBlocks.length; secondIndex += 1) {
      const second = keptBlocks[secondIndex];
      if (second.startMinute >= firstEnd) break;

      const secondEnd = second.startMinute + second.durationMinutes;
      const overlapMinutes = Math.min(firstEnd, secondEnd) - second.startMinute;
      if (overlapMinutes <= 0) continue;

      pairs.push({ firstId: first.id, secondId: second.id, overlapMinutes });
      clashingIdSet.add(first.id);
      clashingIdSet.add(second.id);
    }
  }

  const clashingIds = keptBlocks
    .filter((block) => clashingIdSet.has(block.id))
    .map((block) => block.id);

  return { pairs, clashingIds, count: pairs.length };
}
