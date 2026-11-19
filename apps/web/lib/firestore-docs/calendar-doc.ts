const LEGACY_KEYS = new Set(["userId", "_id", "_creationTime"]);

const CALENDAR_EVENT_KEYS = new Set(["title", "startsAtMs", "createdAt", "updatedAt", "deletedAt"]);

const FOCUS_BLOCK_KEYS = new Set([
  "startedAtMs",
  "durationMs",
  "createdAt",
  "updatedAt",
  "label",
  "taskId",
  "deletedAt",
]);

const MAX_FOCUS_DURATION_MS = 24 * 60 * 60 * 1000;

export type CalendarEventDoc = {
  title: string;
  startsAtMs: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type FocusBlockDoc = {
  startedAtMs: number;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
  label?: string;
  taskId?: string;
  deletedAt?: number;
};

export class CalendarDocError extends Error {
  constructor(field: string) {
    super(`Invalid field: ${field}`);
    this.name = "CalendarDocError";
  }
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new CalendarDocError("input");
  }

  return input as Record<string, unknown>;
}

function refuseUnknownKeys(input: Record<string, unknown>, allowedKeys: Set<string>): void {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key) && !LEGACY_KEYS.has(key)) {
      throw new CalendarDocError(key);
    }
  }
}

function finiteNonNegative(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CalendarDocError(field);
  }

  return value;
}

function optionalFinite(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CalendarDocError(field);
  }

  return value;
}

function trimmedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new CalendarDocError(field);
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new CalendarDocError(field);
  }

  return trimmed;
}

export function parseCalendarEventDoc(input: unknown): CalendarEventDoc {
  const value = asRecord(input);
  refuseUnknownKeys(value, CALENDAR_EVENT_KEYS);

  const parsed: CalendarEventDoc = {
    title: trimmedString(value.title, "title", 200),
    startsAtMs: finiteNonNegative(value.startsAtMs, "startsAtMs"),
    createdAt: finiteNonNegative(value.createdAt, "createdAt"),
    updatedAt: finiteNonNegative(value.updatedAt, "updatedAt"),
  };
  const deletedAt = optionalFinite(value.deletedAt, "deletedAt");
  if (deletedAt !== undefined) parsed.deletedAt = deletedAt;
  return parsed;
}

export function parseFocusBlockDoc(input: unknown): FocusBlockDoc {
  const value = asRecord(input);
  refuseUnknownKeys(value, FOCUS_BLOCK_KEYS);

  const durationMs = finiteNonNegative(value.durationMs, "durationMs");
  if (durationMs === 0 || durationMs > MAX_FOCUS_DURATION_MS) {
    throw new CalendarDocError("durationMs");
  }

  const parsed: FocusBlockDoc = {
    startedAtMs: finiteNonNegative(value.startedAtMs, "startedAtMs"),
    durationMs,
    createdAt: finiteNonNegative(value.createdAt, "createdAt"),
    updatedAt: finiteNonNegative(value.updatedAt, "updatedAt"),
  };

  if (value.label !== undefined) parsed.label = trimmedString(value.label, "label", 120);
  if (value.taskId !== undefined) {
    if (
      typeof value.taskId !== "string" ||
      value.taskId.length === 0 ||
      value.taskId.includes("/")
    ) {
      throw new CalendarDocError("taskId");
    }
    parsed.taskId = value.taskId;
  }
  const deletedAt = optionalFinite(value.deletedAt, "deletedAt");
  if (deletedAt !== undefined) parsed.deletedAt = deletedAt;
  return parsed;
}

export function softDeleteCalendarEventDoc(doc: CalendarEventDoc, now: number): CalendarEventDoc {
  return { ...doc, deletedAt: now, updatedAt: now };
}

export function softDeleteFocusBlockDoc(doc: FocusBlockDoc, now: number): FocusBlockDoc {
  return { ...doc, deletedAt: now, updatedAt: now };
}
