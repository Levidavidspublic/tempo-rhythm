import { checkNoteDoc, type NoteDoc } from "../firestore-docs/note-doc";

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function findDailyPage<T extends { id: string; data: NoteDoc }>(
  notes: readonly T[],
  localDate: string,
  now: number
) {
  if (!isCalendarDate(localDate)) return { ok: false as const, reason: "bad-date" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };

  const matches = notes
    .filter(
      ({ data }) =>
        data.deletedAt === undefined && data.periodType === "daily" && data.date === localDate
    )
    .toSorted(
      (left, right) => left.data.createdAt - right.data.createdAt || left.id.localeCompare(right.id)
    );

  const first = matches[0];
  if (first) {
    return {
      ok: true as const,
      found: true as const,
      id: first.id,
      note: first.data,
      duplicateIds: matches.slice(1).map(({ id }) => id),
    };
  }

  const checked = checkNoteDoc({
    title: localDate,
    body: "",
    pinned: false,
    periodType: "daily",
    pageType: "daily",
    date: localDate,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });

  if (!checked.ok) return { ok: false as const, reason: "bad-time" as const };
  return { ok: true as const, found: false as const, draft: checked.doc };
}
