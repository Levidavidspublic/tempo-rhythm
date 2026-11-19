export const NAG_PHRASE_SOURCES = ["user", "derived"] as const;
export const NAG_PHRASE_STATUSES = [
  "proposed",
  "accepted",
  "rejected",
] as const;

export type NagPhrase = {
  id: string;
  text: string;
  source: (typeof NAG_PHRASE_SOURCES)[number];
  status: (typeof NAG_PHRASE_STATUSES)[number];
};

export type NagDoc = {
  label: string;
  enabled: boolean;
  phrases: NagPhrase[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export class NagDocError extends Error {
  constructor(field: string) {
    super(`Invalid field: ${field}`);
    this.name = "NagDocError";
  }
}

const TOP_LEVEL_KEYS = new Set([
  "label",
  "enabled",
  "phrases",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "userId",
  "_id",
  "_creationTime",
]);
const PHRASE_KEYS = new Set(["id", "text", "source", "status"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NagDocError(field);
  }
  return value;
}

export function parseNagDoc(input: unknown): NagDoc {
  if (!isRecord(input)) {
    throw new NagDocError("document");
  }

  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      throw new NagDocError(key);
    }
  }

  if (typeof input.label !== "string") {
    throw new NagDocError("label");
  }
  const label = input.label.trim();
  if (label.length < 1 || label.length > 120) {
    throw new NagDocError("label");
  }
  if (typeof input.enabled !== "boolean") {
    throw new NagDocError("enabled");
  }
  if (!Array.isArray(input.phrases) || input.phrases.length > 50) {
    throw new NagDocError("phrases");
  }

  const phraseIds = new Set<string>();
  const phrases = input.phrases.map((phrase, index): NagPhrase => {
    const prefix = `phrases[${index}]`;
    if (!isRecord(phrase)) {
      throw new NagDocError(prefix);
    }
    for (const key of Object.keys(phrase)) {
      if (!PHRASE_KEYS.has(key)) {
        throw new NagDocError(`${prefix}.${key}`);
      }
    }
    if (typeof phrase.id !== "string" || phrase.id.length === 0) {
      throw new NagDocError(`${prefix}.id`);
    }
    if (phraseIds.has(phrase.id)) {
      throw new NagDocError(`${prefix}.id`);
    }
    phraseIds.add(phrase.id);

    if (typeof phrase.text !== "string") {
      throw new NagDocError(`${prefix}.text`);
    }
    const text = phrase.text.trim();
    if (text.length < 1 || text.length > 500) {
      throw new NagDocError(`${prefix}.text`);
    }
    if (!NAG_PHRASE_SOURCES.includes(phrase.source as NagPhrase["source"])) {
      throw new NagDocError(`${prefix}.source`);
    }
    if (!NAG_PHRASE_STATUSES.includes(phrase.status as NagPhrase["status"])) {
      throw new NagDocError(`${prefix}.status`);
    }

    return {
      id: phrase.id,
      text,
      source: phrase.source as NagPhrase["source"],
      status: phrase.status as NagPhrase["status"],
    };
  });

  const result: NagDoc = {
    label,
    enabled: input.enabled,
    phrases,
    createdAt: finiteNumber(input.createdAt, "createdAt"),
    updatedAt: finiteNumber(input.updatedAt, "updatedAt"),
  };
  if (input.deletedAt !== undefined) {
    result.deletedAt = finiteNumber(input.deletedAt, "deletedAt");
  }
  return result;
}

export function softDeleteNagDoc(doc: NagDoc, now: number): NagDoc {
  if (!Number.isFinite(now)) {
    throw new NagDocError("now");
  }
  return { ...doc, phrases: [...doc.phrases], deletedAt: now, updatedAt: now };
}
