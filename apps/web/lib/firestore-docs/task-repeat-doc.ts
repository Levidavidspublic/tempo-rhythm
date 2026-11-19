export const REPEAT_CYCLES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;

export type TaskRepeatDoc = {
  repeatCycle: (typeof REPEAT_CYCLES)[number];
  repeatEvery: number;
  weekdays: number[];
  monthlyWeekOfMonth?: 1 | 2 | 3 | 4 | -1;
  monthlyWeekday?: number;
  monthlyLastDay?: boolean;
  deletedInstanceDates: string[];
  skipOverdue: boolean;
  waitForCompletion: boolean;
  repeatFromCompletionDate: boolean;
  isPaused: boolean;
  defaultEstimate?: number;
  lastTaskCreationDay?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export class TaskRepeatDocError extends Error {
  constructor(field: string) {
    super(`Invalid field: ${field}`);
    this.name = "TaskRepeatDocError";
  }
}

const REQUIRED_KEYS = [
  "repeatCycle",
  "repeatEvery",
  "weekdays",
  "deletedInstanceDates",
  "skipOverdue",
  "waitForCompletion",
  "repeatFromCompletionDate",
  "isPaused",
  "createdAt",
  "updatedAt",
] as const;

const OPTIONAL_KEYS = [
  "monthlyWeekOfMonth",
  "monthlyWeekday",
  "monthlyLastDay",
  "defaultEstimate",
  "lastTaskCreationDay",
  "deletedAt",
] as const;

const LEGACY_KEYS = new Set(["userId", "_id", "_creationTime"]);
const KNOWN_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function invalid(field: string): never {
  throw new TaskRepeatDocError(field);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWeekday(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    typeof value === "number" &&
    value >= 0 &&
    value <= 6
  );
}

export function parseTaskRepeatDoc(input: unknown): TaskRepeatDoc {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    invalid("document");

  const source = input as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!KNOWN_KEYS.has(key) && !LEGACY_KEYS.has(key)) invalid(key);
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in source)) invalid(key);
  }

  if (
    !REPEAT_CYCLES.includes(
      source.repeatCycle as (typeof REPEAT_CYCLES)[number],
    )
  )
    invalid("repeatCycle");
  if (
    !Number.isInteger(source.repeatEvery) ||
    (source.repeatEvery as number) < 1
  )
    invalid("repeatEvery");
  if (
    !Array.isArray(source.weekdays) ||
    !source.weekdays.every(isWeekday) ||
    new Set(source.weekdays).size !== source.weekdays.length
  )
    invalid("weekdays");
  if (
    !Array.isArray(source.deletedInstanceDates) ||
    !source.deletedInstanceDates.every(
      (date) => typeof date === "string" && DATE_PATTERN.test(date),
    )
  )
    invalid("deletedInstanceDates");

  for (const field of [
    "skipOverdue",
    "waitForCompletion",
    "repeatFromCompletionDate",
    "isPaused",
  ] as const) {
    if (typeof source[field] !== "boolean") invalid(field);
  }
  for (const field of ["createdAt", "updatedAt"] as const) {
    if (!isFiniteNumber(source[field])) invalid(field);
  }

  if (
    source.monthlyWeekOfMonth !== undefined &&
    ![1, 2, 3, 4, -1].includes(source.monthlyWeekOfMonth as number)
  )
    invalid("monthlyWeekOfMonth");
  if (source.monthlyWeekday !== undefined && !isWeekday(source.monthlyWeekday))
    invalid("monthlyWeekday");
  if (
    source.monthlyLastDay !== undefined &&
    typeof source.monthlyLastDay !== "boolean"
  )
    invalid("monthlyLastDay");
  if (
    source.defaultEstimate !== undefined &&
    (!isFiniteNumber(source.defaultEstimate) || source.defaultEstimate < 0)
  )
    invalid("defaultEstimate");
  if (
    source.lastTaskCreationDay !== undefined &&
    (typeof source.lastTaskCreationDay !== "string" ||
      !DATE_PATTERN.test(source.lastTaskCreationDay))
  )
    invalid("lastTaskCreationDay");
  if (source.deletedAt !== undefined && !isFiniteNumber(source.deletedAt))
    invalid("deletedAt");

  const result: Record<string, unknown> = {};
  for (const key of [...REQUIRED_KEYS, ...OPTIONAL_KEYS]) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result as TaskRepeatDoc;
}

export function softDeleteTaskRepeatDoc(
  doc: TaskRepeatDoc,
  now: number,
): TaskRepeatDoc {
  return { ...doc, deletedAt: now, updatedAt: now };
}
