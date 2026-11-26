export type SummaryBlock = {
  startMinute: number;
  durationMinutes: number;
  status: "planned" | "done" | "skipped";
};

export type SummaryTopTask = {
  status: "todo" | "in_progress" | "done" | "cancelled";
};

/**
 * The block in progress at `nowMinute` plus upcoming `planned` blocks, by start time.
 * Done and skipped blocks never appear. A planned block that already ended is left out.
 */
export function pickNextBlocks<T extends SummaryBlock>(
  blocks: readonly T[],
  nowMinute: number,
  limit = 3
): T[] {
  return blocks
    .filter(
      (block) =>
        block.status === "planned" && block.startMinute + block.durationMinutes > nowMinute
    )
    .sort((a, b) => a.startMinute - b.startMinute)
    .slice(0, Math.max(limit, 0));
}

export function planProgress(topTasks: readonly SummaryTopTask[]): { done: number; total: number } {
  return {
    done: topTasks.filter((task) => task.status === "done").length,
    total: topTasks.length,
  };
}
