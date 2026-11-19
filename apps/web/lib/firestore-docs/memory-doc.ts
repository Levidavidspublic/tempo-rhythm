export type MemorySector = "semantic" | "episodic" | "procedural" | "emotional" | "general";

export type MemoryDoc = {
  content: string;
  sector: MemorySector;
  salience: number;
  decayRate: number;
  lastAccessed: number;
  accessCount: number;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckMemoryDocResult = { ok: true; doc: MemoryDoc } | { ok: false; reason: string };

const allowedKeys = new Set<keyof MemoryDoc>([
  "content",
  "sector",
  "salience",
  "decayRate",
  "lastAccessed",
  "accessCount",
  "metadata",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const sectors = new Set<MemorySector>([
  "semantic",
  "episodic",
  "procedural",
  "emotional",
  "general",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function checkMemoryDoc(input: unknown): CheckMemoryDocResult {
  if (!isPlainObject(input)) {
    return { ok: false, reason: "memory must be a plain object" };
  }

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key as keyof MemoryDoc)) {
      return { ok: false, reason: `unknown field: ${key}` };
    }
  }

  if (typeof input.content !== "string" || input.content.trim().length === 0) {
    return { ok: false, reason: "content must be a non-empty string" };
  }
  if (typeof input.sector !== "string" || !sectors.has(input.sector as MemorySector)) {
    return { ok: false, reason: "sector is invalid" };
  }
  if (!isFiniteNumber(input.salience) || input.salience < 0) {
    return {
      ok: false,
      reason: "salience must be a nonnegative finite number",
    };
  }
  if (!isFiniteNumber(input.decayRate) || input.decayRate < 0) {
    return {
      ok: false,
      reason: "decayRate must be a nonnegative finite number",
    };
  }
  if (!isFiniteNumber(input.lastAccessed)) {
    return { ok: false, reason: "lastAccessed must be a finite number" };
  }
  if (!Number.isSafeInteger(input.accessCount) || (input.accessCount as number) < 0) {
    return {
      ok: false,
      reason: "accessCount must be a nonnegative safe integer",
    };
  }
  if (input.metadata !== undefined && !isPlainObject(input.metadata)) {
    return { ok: false, reason: "metadata must be a plain object" };
  }
  if (!isFiniteNumber(input.createdAt)) {
    return { ok: false, reason: "createdAt must be a finite number" };
  }
  if (!isFiniteNumber(input.updatedAt)) {
    return { ok: false, reason: "updatedAt must be a finite number" };
  }
  if (input.deletedAt !== undefined && !isFiniteNumber(input.deletedAt)) {
    return { ok: false, reason: "deletedAt must be a finite number" };
  }

  return { ok: true, doc: input as MemoryDoc };
}
