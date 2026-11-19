export type HabitDoc = {
  name: string;
  cadence: "daily" | "weekly";
  currentStreak: number;
  longestStreak: number;
  lastCompletedAt?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type HabitCheckInDoc = {
  habitId: string;
  localDate: string;
  checkedAt: number;
  source: "habits" | "today" | "suggestion" | "legacy";
  note?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckResult<T> = { ok: true; doc: T } | { ok: false; reason: string };

const habitKeys = new Set([
  "name",
  "cadence",
  "currentStreak",
  "longestStreak",
  "lastCompletedAt",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const checkInKeys = new Set([
  "habitId",
  "localDate",
  "checkedAt",
  "source",
  "note",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(input).every((key) => allowed.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalFiniteNumber(value: unknown, present: boolean): boolean {
  return !present || isFiniteNumber(value);
}

function isStreak(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isRealLocalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
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

export function checkHabitDoc(input: unknown): CheckResult<HabitDoc> {
  try {
    if (!isRecord(input)) return { ok: false, reason: "habit must be an object" };
    if (!hasOnlyKeys(input, habitKeys)) return { ok: false, reason: "habit has an unknown key" };
    if (typeof input.name !== "string" || input.name.trim() === "") {
      return { ok: false, reason: "name must not be blank" };
    }
    if (input.cadence !== "daily" && input.cadence !== "weekly") {
      return { ok: false, reason: "cadence is invalid" };
    }
    if (!isStreak(input.currentStreak) || !isStreak(input.longestStreak)) {
      return { ok: false, reason: "streaks must be non-negative integers" };
    }
    if (
      !isFiniteNumber(input.createdAt) ||
      !isFiniteNumber(input.updatedAt) ||
      !isOptionalFiniteNumber(input.lastCompletedAt, "lastCompletedAt" in input) ||
      !isOptionalFiniteNumber(input.deletedAt, "deletedAt" in input)
    ) {
      return { ok: false, reason: "timestamps must be finite numbers" };
    }
    return { ok: true, doc: input as HabitDoc };
  } catch {
    return { ok: false, reason: "habit could not be checked" };
  }
}

export function checkHabitCheckInDoc(input: unknown): CheckResult<HabitCheckInDoc> {
  try {
    if (!isRecord(input)) return { ok: false, reason: "check-in must be an object" };
    if (!hasOnlyKeys(input, checkInKeys))
      return { ok: false, reason: "check-in has an unknown key" };
    if (typeof input.habitId !== "string" || input.habitId.trim() === "") {
      return { ok: false, reason: "habitId must not be empty" };
    }
    if (!isRealLocalDate(input.localDate)) return { ok: false, reason: "localDate is invalid" };
    if (
      input.source !== "habits" &&
      input.source !== "today" &&
      input.source !== "suggestion" &&
      input.source !== "legacy"
    ) {
      return { ok: false, reason: "source is invalid" };
    }
    if ("note" in input && typeof input.note !== "string") {
      return { ok: false, reason: "note must be a string" };
    }
    if (
      !isFiniteNumber(input.checkedAt) ||
      !isFiniteNumber(input.createdAt) ||
      !isFiniteNumber(input.updatedAt) ||
      !isOptionalFiniteNumber(input.deletedAt, "deletedAt" in input)
    ) {
      return { ok: false, reason: "timestamps must be finite numbers" };
    }
    return { ok: true, doc: input as HabitCheckInDoc };
  } catch {
    return { ok: false, reason: "check-in could not be checked" };
  }
}

export function softDeleteHabit(doc: HabitDoc, nowMs: number): HabitDoc {
  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}
