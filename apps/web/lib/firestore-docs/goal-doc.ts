export type GoalDoc = {
  title: string;
  description?: string;
  targetDate?: number;
  progressPercent: number;
  status: "active" | "completed" | "archived";
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

const GOAL_DOC_KEYS = new Set([
  "title",
  "description",
  "targetDate",
  "progressPercent",
  "status",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

type GoalDocCheck = { ok: true; doc: GoalDoc } | { ok: false; reason: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Checks an untrusted Firestore value before it is written. */
export function checkGoalDoc(input: unknown): GoalDocCheck {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return { ok: false, reason: "goal must be an object" };
    }

    const value = input as Record<string, unknown>;
    const unknownKey = Object.keys(value).find(
      (key) => !GOAL_DOC_KEYS.has(key),
    );
    if (unknownKey !== undefined) {
      return { ok: false, reason: `unknown key: ${unknownKey}` };
    }
    if (typeof value.title !== "string" || value.title.trim() === "") {
      return { ok: false, reason: "title must not be blank" };
    }
    if (
      value.description !== undefined &&
      typeof value.description !== "string"
    ) {
      return { ok: false, reason: "description must be a string" };
    }
    if (value.targetDate !== undefined && !isFiniteNumber(value.targetDate)) {
      return { ok: false, reason: "targetDate must be finite" };
    }
    if (
      !isFiniteNumber(value.progressPercent) ||
      value.progressPercent < 0 ||
      value.progressPercent > 100
    ) {
      return { ok: false, reason: "progressPercent must be between 0 and 100" };
    }
    if (
      value.status !== "active" &&
      value.status !== "completed" &&
      value.status !== "archived"
    ) {
      return { ok: false, reason: "status is invalid" };
    }
    if (!isFiniteNumber(value.createdAt)) {
      return { ok: false, reason: "createdAt must be finite" };
    }
    if (!isFiniteNumber(value.updatedAt)) {
      return { ok: false, reason: "updatedAt must be finite" };
    }
    if (value.deletedAt !== undefined && !isFiniteNumber(value.deletedAt)) {
      return { ok: false, reason: "deletedAt must be finite" };
    }

    return { ok: true, doc: value as GoalDoc };
  } catch {
    return { ok: false, reason: "goal could not be checked" };
  }
}

export function softDeleteGoal(doc: GoalDoc, nowMs: number): GoalDoc {
  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}

export function restoreGoal(doc: GoalDoc, nowMs: number): GoalDoc {
  const { deletedAt: _deletedAt, ...restored } = doc;
  return { ...restored, updatedAt: nowMs };
}
