export type CoachSettingsDoc = {
  dial: number;
  taskLoad: number;
  acceptedStreak: number;
  updatedAt: number;
  panicUntil?: number;
  deletedAt?: number;
};

/** Mirrors convex/coach.ts DEFAULT_DIAL and ensureSettings (dial 5, load 2, streak 0). */
export const COACH_SETTINGS_DEFAULTS = {
  dial: 5,
  taskLoad: 2,
  acceptedStreak: 0,
} as const satisfies Omit<CoachSettingsDoc, "updatedAt">;

export class CoachSettingsDocError extends Error {
  constructor(field: string) {
    super(`Invalid field: ${field}`);
    this.name = "CoachSettingsDocError";
  }
}

const LEGACY_KEYS = new Set(["userId", "_id", "_creationTime"]);
const DOCUMENT_KEYS = new Set([
  "dial",
  "taskLoad",
  "acceptedStreak",
  "updatedAt",
  "panicUntil",
  "deletedAt",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function invalid(field: string): never {
  throw new CoachSettingsDocError(field);
}

export function parseCoachSettingsDoc(input: unknown): CoachSettingsDoc {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return invalid("document");
  }

  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!DOCUMENT_KEYS.has(key) && !LEGACY_KEYS.has(key)) invalid(key);
  }

  if (
    !Number.isInteger(record.dial) ||
    (record.dial as number) < 0 ||
    (record.dial as number) > 10
  ) {
    invalid("dial");
  }
  if (
    !Number.isInteger(record.taskLoad) ||
    (record.taskLoad as number) < 2 ||
    (record.taskLoad as number) > 4
  ) {
    invalid("taskLoad");
  }
  if (
    !Number.isInteger(record.acceptedStreak) ||
    (record.acceptedStreak as number) < 0
  ) {
    invalid("acceptedStreak");
  }
  if (!isFiniteNumber(record.updatedAt)) invalid("updatedAt");
  if (record.panicUntil !== undefined && !isFiniteNumber(record.panicUntil))
    invalid("panicUntil");
  if (record.deletedAt !== undefined && !isFiniteNumber(record.deletedAt))
    invalid("deletedAt");

  return {
    dial: record.dial as number,
    taskLoad: record.taskLoad as number,
    acceptedStreak: record.acceptedStreak as number,
    updatedAt: record.updatedAt,
    ...(record.panicUntil === undefined
      ? {}
      : { panicUntil: record.panicUntil }),
    ...(record.deletedAt === undefined ? {} : { deletedAt: record.deletedAt }),
  };
}

export function readCoachSettings(
  input: unknown | null | undefined,
  now: number
): CoachSettingsDoc {
  if (
    input == null ||
    (typeof input === "object" &&
      !Array.isArray(input) &&
      (input as Record<string, unknown>).deletedAt !== undefined)
  ) {
    return { ...COACH_SETTINGS_DEFAULTS, updatedAt: now };
  }

  return parseCoachSettingsDoc(input);
}

export function isPanicActive(doc: CoachSettingsDoc, now: number): boolean {
  return doc.panicUntil !== undefined && doc.panicUntil > now;
}
