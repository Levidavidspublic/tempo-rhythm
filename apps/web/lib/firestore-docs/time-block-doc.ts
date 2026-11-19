export type TimeBlockDoc = {
  localDate: string;
  dayPlanId?: string;
  title: string;
  startMinute: number;
  durationMinutes: number;
  startsAtMs: number;
  endsAtMs: number;
  kind: "focus" | "task" | "habit" | "break" | "other";
  taskId?: string;
  habitId?: string;
  status: "planned" | "done" | "skipped";
  source: "user" | "coach";
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type CheckTimeBlockDocResult =
  | { ok: true; doc: TimeBlockDoc }
  | { ok: false; reason: string };

const allowedKeys = new Set<keyof TimeBlockDoc>([
  "localDate",
  "dayPlanId",
  "title",
  "startMinute",
  "durationMinutes",
  "startsAtMs",
  "endsAtMs",
  "kind",
  "taskId",
  "habitId",
  "status",
  "source",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function isRealLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isOptionalNonEmptyString(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.trim().length > 0);
}

function checkTimeBlockDocValue(input: unknown): CheckTimeBlockDocResult {
  if (!isPlainObject(input)) return { ok: false, reason: "Time block must be a plain object" };

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key as keyof TimeBlockDoc)) {
      return { ok: false, reason: `Unexpected field: ${key}` };
    }
  }

  if (!isRealLocalDate(input.localDate)) return { ok: false, reason: "localDate must be a real YYYY-MM-DD date" };
  if (typeof input.title !== "string" || input.title.trim().length === 0) {
    return { ok: false, reason: "title must be a non-empty string" };
  }
  if (!Number.isInteger(input.startMinute) || (input.startMinute as number) < 0 || (input.startMinute as number) > 1439) {
    return { ok: false, reason: "startMinute must be an integer from 0 to 1439" };
  }
  if (!Number.isInteger(input.durationMinutes) || (input.durationMinutes as number) < 5 || (input.durationMinutes as number) > 720) {
    return { ok: false, reason: "durationMinutes must be an integer from 5 to 720" };
  }
  if (typeof input.startsAtMs !== "number" || !Number.isFinite(input.startsAtMs)) {
    return { ok: false, reason: "startsAtMs must be a finite number" };
  }
  if (typeof input.endsAtMs !== "number" || !Number.isFinite(input.endsAtMs)) {
    return { ok: false, reason: "endsAtMs must be a finite number" };
  }
  if (input.endsAtMs - input.startsAtMs !== (input.durationMinutes as number) * 60_000) {
    return { ok: false, reason: "endsAtMs must match startsAtMs plus durationMinutes" };
  }
  if (!["focus", "task", "habit", "break", "other"].includes(input.kind as string)) {
    return { ok: false, reason: "kind is invalid" };
  }
  if (!["planned", "done", "skipped"].includes(input.status as string)) {
    return { ok: false, reason: "status is invalid" };
  }
  if (!["user", "coach"].includes(input.source as string)) {
    return { ok: false, reason: "source is invalid" };
  }
  for (const field of ["dayPlanId", "taskId", "habitId"] as const) {
    if (!isOptionalNonEmptyString(input[field])) {
      return { ok: false, reason: `${field} must be a non-empty string when present` };
    }
  }
  for (const field of ["createdAt", "updatedAt"] as const) {
    if (typeof input[field] !== "number" || !Number.isFinite(input[field])) {
      return { ok: false, reason: `${field} must be a finite number` };
    }
  }
  if (input.deletedAt !== undefined && (typeof input.deletedAt !== "number" || !Number.isFinite(input.deletedAt))) {
    return { ok: false, reason: "deletedAt must be a finite number when present" };
  }

  return { ok: true, doc: { ...input } as TimeBlockDoc };
}

export function checkTimeBlockDoc(input: unknown): CheckTimeBlockDocResult {
  try {
    return checkTimeBlockDocValue(input);
  } catch {
    return { ok: false, reason: "Time block could not be read safely" };
  }
}
