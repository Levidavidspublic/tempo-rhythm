export type TemplateDoc = {
  name: string;
  description?: string;
  periodType: "daily" | "weekly" | "monthly" | "none";
  body: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckTemplateDocResult =
  | { ok: true; doc: TemplateDoc }
  | { ok: false; reason: string };

const allowedKeys = new Set<keyof TemplateDoc>([
  "name",
  "description",
  "periodType",
  "body",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const periodTypes = new Set<TemplateDoc["periodType"]>([
  "daily",
  "weekly",
  "monthly",
  "none",
]);

export function checkTemplateDoc(input: unknown): CheckTemplateDocResult {
  try {
    if (typeof input !== "object" || input === null) {
      return { ok: false, reason: "Template must be a plain object" };
    }

    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      return { ok: false, reason: "Template must be a plain object" };
    }

    const candidate = input as Record<string, unknown>;
    const unknownKey = Object.keys(candidate).find(
      (key) => !allowedKeys.has(key as keyof TemplateDoc),
    );
    if (unknownKey !== undefined) {
      return { ok: false, reason: `Unexpected field: ${unknownKey}` };
    }

    if (typeof candidate.name !== "string") {
      return { ok: false, reason: "name must be a string" };
    }
    const name = candidate.name.trim();
    if (name.length === 0) {
      return { ok: false, reason: "name must not be empty" };
    }
    if (name.length > 120) {
      return { ok: false, reason: "name must be at most 120 characters" };
    }

    if (
      Object.hasOwn(candidate, "description") &&
      typeof candidate.description !== "string"
    ) {
      return { ok: false, reason: "description must be a string" };
    }
    if (
      typeof candidate.periodType !== "string" ||
      !periodTypes.has(candidate.periodType as TemplateDoc["periodType"])
    ) {
      return { ok: false, reason: "periodType is invalid" };
    }
    if (typeof candidate.body !== "string") {
      return { ok: false, reason: "body must be a string" };
    }
    if (typeof candidate.createdAt !== "number" || !Number.isFinite(candidate.createdAt)) {
      return { ok: false, reason: "createdAt must be a finite number" };
    }
    if (typeof candidate.updatedAt !== "number" || !Number.isFinite(candidate.updatedAt)) {
      return { ok: false, reason: "updatedAt must be a finite number" };
    }
    if (
      Object.hasOwn(candidate, "deletedAt") &&
      (typeof candidate.deletedAt !== "number" || !Number.isFinite(candidate.deletedAt))
    ) {
      return { ok: false, reason: "deletedAt must be a finite number" };
    }

    const doc: TemplateDoc = {
      name,
      periodType: candidate.periodType as TemplateDoc["periodType"],
      body: candidate.body,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };
    if (typeof candidate.description === "string") doc.description = candidate.description;
    if (typeof candidate.deletedAt === "number") doc.deletedAt = candidate.deletedAt;

    return { ok: true, doc };
  } catch {
    return { ok: false, reason: "Template could not be checked" };
  }
}
