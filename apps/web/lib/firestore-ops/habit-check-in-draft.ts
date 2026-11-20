import {
  checkHabitCheckInDoc,
  type HabitCheckInDoc,
} from "../firestore-docs/habit-doc";

const NOTE_LIMIT = 500;
const NEW_CHECK_IN_SOURCES = new Set(["habits", "today", "suggestion"]);

type HabitCheckInDraftInput = {
  habitId: string;
  localDate: string;
  source: "habits" | "today" | "suggestion";
  note?: string;
};

type HabitCheckInDraftResult =
  | { ok: true; doc: HabitCheckInDoc }
  | { ok: false; reason: "empty-habit" | "bad-date" | "bad-time" | "bad-source" | "invalid" };

function isRealLocalDate(value: string): boolean {
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

export function draftHabitCheckIn(
  input: HabitCheckInDraftInput,
  now: number
): HabitCheckInDraftResult {
  const habitId = input.habitId.trim();
  if (habitId === "") return { ok: false, reason: "empty-habit" };
  if (!isRealLocalDate(input.localDate)) return { ok: false, reason: "bad-date" };
  if (!Number.isFinite(now)) return { ok: false, reason: "bad-time" };
  if (!NEW_CHECK_IN_SOURCES.has(input.source)) return { ok: false, reason: "bad-source" };

  const note = input.note?.trim().slice(0, NOTE_LIMIT);
  const draft: HabitCheckInDoc = {
    habitId,
    localDate: input.localDate,
    checkedAt: now,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    ...(note ? { note } : {}),
  };
  const checked = checkHabitCheckInDoc(draft);
  return checked.ok ? { ok: true, doc: checked.doc } : { ok: false, reason: "invalid" };
}
