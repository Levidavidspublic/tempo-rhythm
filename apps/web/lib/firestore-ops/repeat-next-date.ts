import type { TaskRepeatDoc } from "../firestore-docs/task-repeat-doc";

type NextRepeatDateResult =
  | { kind: "date"; date: string }
  | { kind: "none"; reason: "paused" | "deleted" | "bad_date" | "no_date_found" }
  | { kind: "unsupported"; cycle: "MONTHLY" | "YEARLY" };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRIES = 400;

function parseDate(date: string): Date | undefined {
  const match = DATE_PATTERN.exec(date);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextRepeatDate(rule: TaskRepeatDoc, afterDate: string): NextRepeatDateResult {
  if (rule.isPaused) return { kind: "none", reason: "paused" };
  if (rule.deletedAt !== undefined) return { kind: "none", reason: "deleted" };

  const after = parseDate(afterDate);
  if (!after) return { kind: "none", reason: "bad_date" };

  if (rule.repeatCycle === "MONTHLY" || rule.repeatCycle === "YEARLY") {
    return { kind: "unsupported", cycle: rule.repeatCycle };
  }

  const deletedDates = new Set(rule.deletedInstanceDates);

  if (rule.repeatCycle === "DAILY") {
    for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
      const date = formatDate(addDays(after, attempt * rule.repeatEvery));
      if (!deletedDates.has(date)) return { kind: "date", date };
    }
    return { kind: "none", reason: "no_date_found" };
  }

  if (rule.weekdays.length === 0) {
    for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
      const date = formatDate(addDays(after, attempt * 7 * rule.repeatEvery));
      if (!deletedDates.has(date)) return { kind: "date", date };
    }
    return { kind: "none", reason: "no_date_found" };
  }

  const weekdays = new Set(rule.weekdays);
  const afterWeekStart = addDays(after, -after.getUTCDay());
  let matchesTried = 0;

  for (let offset = 1; matchesTried < MAX_TRIES; offset += 1) {
    const candidate = addDays(after, offset);
    const weekOffset = Math.floor((candidate.getTime() - afterWeekStart.getTime()) / (7 * DAY_MS));
    if (weekOffset % rule.repeatEvery !== 0 || !weekdays.has(candidate.getUTCDay())) continue;

    matchesTried += 1;
    const date = formatDate(candidate);
    if (!deletedDates.has(date)) return { kind: "date", date };
  }

  return { kind: "none", reason: "no_date_found" };
}
