import { type CalendarEventDoc, parseCalendarEventDoc } from "../firestore-docs/calendar-doc";

export type CalendarEventEdit = {
  title?: string;
  startsAtMs?: number;
};

export type CalendarEventEditPlan =
  | { kind: "patch"; patch: Partial<CalendarEventDoc>; fields: string[] }
  | { kind: "unchanged" }
  | { kind: "refused"; reason: string };

export function planCalendarEventEdit(
  stored: CalendarEventDoc,
  edit: CalendarEventEdit,
  now: number
): CalendarEventEditPlan {
  if (stored.deletedAt !== undefined) {
    return { kind: "refused", reason: "event is deleted" };
  }

  const patch: Partial<CalendarEventDoc> = {};

  if (edit.title !== undefined) {
    const title = edit.title.trim();
    if (title.length === 0) {
      return { kind: "refused", reason: "title must not be empty" };
    }

    const shortenedTitle = title.slice(0, 200).trim();
    if (shortenedTitle !== stored.title) patch.title = shortenedTitle;
  }

  if (edit.startsAtMs !== undefined) {
    if (!Number.isFinite(edit.startsAtMs) || edit.startsAtMs < 0) {
      return { kind: "refused", reason: "start time is invalid" };
    }
    if (edit.startsAtMs !== stored.startsAtMs) patch.startsAtMs = edit.startsAtMs;
  }

  const withStamp = Object.keys(patch).length === 0 ? patch : { ...patch, updatedAt: now };
  try {
    parseCalendarEventDoc({ ...stored, ...withStamp });
  } catch {
    return { kind: "refused", reason: "event could not be checked" };
  }
  if (Object.keys(patch).length === 0) return { kind: "unchanged" };

  return { kind: "patch", patch: withStamp, fields: Object.keys(withStamp).sort() };
}
