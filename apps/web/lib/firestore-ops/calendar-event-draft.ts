import { parseCalendarEventDoc, type CalendarEventDoc } from "../firestore-docs/calendar-doc";

type DraftCalendarEventResult =
  | { ok: true; doc: CalendarEventDoc }
  | { ok: false; reason: "empty_title" | "bad_start" | "bad_now" };

export type UpcomingEventRow = {
  id: string;
  startsAtMs: number;
  deletedAt?: number;
};

export function draftCalendarEvent(
  input: { title: unknown; startsAtMs: unknown },
  now: number
): DraftCalendarEventResult {
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    return { ok: false, reason: "empty_title" };
  }
  if (
    typeof input.startsAtMs !== "number" ||
    !Number.isFinite(input.startsAtMs) ||
    input.startsAtMs < 0
  ) {
    return { ok: false, reason: "bad_start" };
  }
  if (!Number.isFinite(now) || now < 0) return { ok: false, reason: "bad_now" };

  const doc = parseCalendarEventDoc({
    title: input.title.trim().slice(0, 200),
    startsAtMs: input.startsAtMs,
    createdAt: now,
    updatedAt: now,
  });

  return { ok: true, doc };
}

export function pickUpcomingEvents<T extends UpcomingEventRow>(
  rows: readonly T[],
  fromMs: number,
  max = 50
): T[] {
  if (!Number.isFinite(fromMs) || !Number.isFinite(max) || max <= 0) return [];

  return rows
    .filter((row) => row.deletedAt === undefined && row.startsAtMs >= fromMs)
    .sort(
      (left, right) =>
        left.startsAtMs - right.startsAtMs || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    )
    .slice(0, Math.floor(max));
}
