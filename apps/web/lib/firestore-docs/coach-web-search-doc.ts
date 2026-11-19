export type CoachWebSearchDoc = {
  utcDateKey: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

const COACH_WEB_SEARCH_KEYS = new Set<PropertyKey>(["utcDateKey", "createdAt", "updatedAt", "deletedAt"]);
const UTC_DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isUtcDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = UTC_DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function utcDateKeyFor(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function checkCoachWebSearchDoc(
  input: unknown,
): { ok: true; doc: CoachWebSearchDoc } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "Coach web search document must be an object" };
  }

  const record = input as Record<string, unknown>;
  const unknownKey = Reflect.ownKeys(record).find((key) => !COACH_WEB_SEARCH_KEYS.has(key));
  if (unknownKey !== undefined) return { ok: false, reason: `Unknown key: ${String(unknownKey)}` };
  if (!isUtcDateKey(record.utcDateKey)) return { ok: false, reason: "utcDateKey must be a real YYYY-MM-DD UTC date" };
  if (!isTimestamp(record.createdAt)) return { ok: false, reason: "createdAt must be a safe nonnegative integer" };
  if (!isTimestamp(record.updatedAt)) return { ok: false, reason: "updatedAt must be a safe nonnegative integer" };
  if (record.deletedAt !== undefined && !isTimestamp(record.deletedAt)) {
    return { ok: false, reason: "deletedAt must be a safe nonnegative integer" };
  }
  if (record.updatedAt < record.createdAt) return { ok: false, reason: "updatedAt cannot be earlier than createdAt" };

  return {
    ok: true,
    doc: {
      utcDateKey: record.utcDateKey,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.deletedAt === undefined ? {} : { deletedAt: record.deletedAt }),
    },
  };
}

export function softDeleteCoachWebSearch(doc: CoachWebSearchDoc, nowMs: number): CoachWebSearchDoc {
  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}

export function countSearchesOn(docs: readonly CoachWebSearchDoc[], utcDateKey: string): number {
  return docs.filter((doc) => doc.utcDateKey === utcDateKey && doc.deletedAt === undefined).length;
}
