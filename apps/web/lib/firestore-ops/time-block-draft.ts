import type { TimeBlockDoc } from "../firestore-docs/time-block-doc";

type DraftTimeBlockInput = {
  localDate: string;
  title: string;
  startMinute: number;
  durationMinutes: number;
  startsAtMs: number;
  endsAtMs: number;
  kind: "focus" | "task" | "habit" | "break" | "other";
  taskId?: string;
  habitId?: string;
  dayPlanId?: string;
};

type DraftTimeBlockResult =
  | { ok: true; doc: TimeBlockDoc }
  | {
      ok: false;
      reason: "bad-date" | "empty-title" | "bad-start" | "bad-length" | "bad-range" | "bad-time";
    };

function isRealLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function draftTimeBlock(input: DraftTimeBlockInput, now: number): DraftTimeBlockResult {
  if (!isRealLocalDate(input.localDate)) return { ok: false, reason: "bad-date" };

  const title = input.title.trim();
  if (!title) return { ok: false, reason: "empty-title" };
  if (!Number.isInteger(input.startMinute) || input.startMinute < 0 || input.startMinute > 1439) {
    return { ok: false, reason: "bad-start" };
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 5 ||
    input.durationMinutes > 720
  ) {
    return { ok: false, reason: "bad-length" };
  }
  if (![input.startsAtMs, input.endsAtMs, now].every(Number.isFinite)) {
    return { ok: false, reason: "bad-time" };
  }
  if (input.endsAtMs <= input.startsAtMs) return { ok: false, reason: "bad-range" };

  const doc: TimeBlockDoc = {
    localDate: input.localDate,
    title,
    startMinute: input.startMinute,
    durationMinutes: input.durationMinutes,
    startsAtMs: input.startsAtMs,
    endsAtMs: input.endsAtMs,
    kind: input.kind,
    ...(input.taskId?.trim() ? { taskId: input.taskId } : {}),
    ...(input.habitId?.trim() ? { habitId: input.habitId } : {}),
    ...(input.dayPlanId?.trim() ? { dayPlanId: input.dayPlanId } : {}),
    status: "planned",
    source: "user",
    createdAt: now,
    updatedAt: now,
  };

  return { ok: true, doc };
}

export function sortTimeBlocksForDay(
  rows: readonly TimeBlockDoc[],
  localDate: string,
): TimeBlockDoc[] {
  return rows
    .filter((row) => row.localDate === localDate && row.deletedAt === undefined)
    .sort((a, b) => a.startMinute - b.startMinute || a.startsAtMs - b.startsAtMs);
}
