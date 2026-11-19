export type NoteDoc = {
  title: string;
  body: string;
  pinned: boolean;
  periodType: "daily" | "weekly" | "monthly" | "none";
  pageType?: "daily" | "weekly" | "project" | "plain" | "template";
  date?: string;
  aiGenerated?: boolean;
  revision?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

const NOTE_KEYS = new Set<keyof NoteDoc>([
  "title",
  "body",
  "pinned",
  "periodType",
  "pageType",
  "date",
  "aiGenerated",
  "revision",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const PERIOD_TYPES = new Set<NoteDoc["periodType"]>(["daily", "weekly", "monthly", "none"]);

const PAGE_TYPES = new Set<NonNullable<NoteDoc["pageType"]>>([
  "daily",
  "weekly",
  "project",
  "plain",
  "template",
]);

function isEpochMilliseconds(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isCalendarDate(value: unknown): value is string {
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

function validateNoteDoc(
  input: unknown
): { ok: true; doc: NoteDoc } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "note must be an object" };
  }

  const value = input as Record<string, unknown>;
  const unknownKey = Object.keys(value).find((key) => !NOTE_KEYS.has(key as keyof NoteDoc));
  if (unknownKey) return { ok: false, reason: `unknown key: ${unknownKey}` };

  if (typeof value.title !== "string") {
    return { ok: false, reason: "title must be a string" };
  }
  if (typeof value.body !== "string") {
    return { ok: false, reason: "body must be a string" };
  }
  if (typeof value.pinned !== "boolean") {
    return { ok: false, reason: "pinned must be a boolean" };
  }
  if (!PERIOD_TYPES.has(value.periodType as NoteDoc["periodType"])) {
    return { ok: false, reason: "invalid periodType" };
  }
  if (
    value.pageType !== undefined &&
    !PAGE_TYPES.has(value.pageType as NonNullable<NoteDoc["pageType"]>)
  ) {
    return { ok: false, reason: "invalid pageType" };
  }
  if (value.date !== undefined && !isCalendarDate(value.date)) {
    return { ok: false, reason: "date must be a real YYYY-MM-DD calendar date" };
  }
  if (value.aiGenerated !== undefined && typeof value.aiGenerated !== "boolean") {
    return { ok: false, reason: "aiGenerated must be a boolean" };
  }
  if (
    value.revision !== undefined &&
    (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0)
  ) {
    return { ok: false, reason: "revision must be a safe integer >= 0" };
  }
  if (!isEpochMilliseconds(value.createdAt)) {
    return { ok: false, reason: "createdAt must be epoch milliseconds" };
  }
  if (!isEpochMilliseconds(value.updatedAt)) {
    return { ok: false, reason: "updatedAt must be epoch milliseconds" };
  }
  if (value.deletedAt !== undefined && !isEpochMilliseconds(value.deletedAt)) {
    return { ok: false, reason: "deletedAt must be epoch milliseconds" };
  }

  return { ok: true, doc: value as NoteDoc };
}

export function checkNoteDoc(
  input: unknown
): { ok: true; doc: NoteDoc } | { ok: false; reason: string } {
  try {
    return validateNoteDoc(input);
  } catch {
    return { ok: false, reason: "note could not be inspected" };
  }
}

export function softDeleteNote(doc: NoteDoc, nowMs: number): NoteDoc {
  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}
