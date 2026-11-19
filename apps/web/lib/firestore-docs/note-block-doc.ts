type PageType = "daily" | "weekly" | "project" | "plain" | "template";

type CommonFields = {
  noteId: string;
  position: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type StoredBlock<Kind extends string, Data> = CommonFields & {
  type: Kind;
  blockId: string;
  v: 1;
  data: Data;
};

export type NoteBlockDoc =
  | StoredBlock<"page-meta", { pageType: PageType; date?: string; tags: string[] }>
  | StoredBlock<
      "task",
      {
        title: string;
        durationMin: number;
        status: "now" | "later" | "done";
        order: number;
        inelastic: boolean;
        reason?: string;
        scheduledAt?: string | null;
        doneAt?: string | null;
      }
    >
  | StoredBlock<
      "template",
      {
        name: string;
        forPageType: PageType;
        isDefault: boolean;
        tokens: string[];
        origin: "builtin" | "user";
        status: "draft" | "live";
        enabled: boolean;
      }
    >
  | (CommonFields & {
      type: "broken";
      blockId?: string;
      errorCode:
        | "body_too_large"
        | "too_many_blocks"
        | "block_too_large"
        | "unclosed_fence"
        | "malformed_json"
        | "invalid_envelope"
        | "unsupported_type"
        | "unsupported_version"
        | "invalid_data"
        | "duplicate_id"
        | "duplicate_page_meta"
        | "nesting_too_deep";
    });

type CheckResult = { ok: true; doc: NoteBlockDoc } | { ok: false; reason: string };
type RecordValue = Record<string, unknown>;

const PAGE_TYPES = new Set(["daily", "weekly", "project", "plain", "template"]);
const ERROR_CODES = new Set([
  "body_too_large",
  "too_many_blocks",
  "block_too_large",
  "unclosed_fence",
  "malformed_json",
  "invalid_envelope",
  "unsupported_type",
  "unsupported_version",
  "invalid_data",
  "duplicate_id",
  "duplicate_page_meta",
  "nesting_too_deep",
]);
const COMMON_KEYS = ["type", "noteId", "position", "createdAt", "updatedAt", "deletedAt"];

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: RecordValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function stringsOnly(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validCommon(input: RecordValue): string | undefined {
  if (typeof input.noteId !== "string" || input.noteId.trim() === "" || input.noteId.includes("/"))
    return "invalid noteId";
  if (!isTimestamp(input.position)) return "invalid position";
  if (
    !isTimestamp(input.createdAt) ||
    !isTimestamp(input.updatedAt) ||
    (input.deletedAt !== undefined && !isTimestamp(input.deletedAt))
  )
    return "invalid timestamp";
  if ((input.updatedAt as number) < (input.createdAt as number))
    return "updatedAt precedes createdAt";
  return undefined;
}

function validStoredEnvelope(input: RecordValue): string | undefined {
  if (typeof input.blockId !== "string" || input.blockId.trim() === "") return "invalid blockId";
  if (input.v !== 1) return "invalid version";
  if (!isRecord(input.data)) return "invalid data";
  return undefined;
}

export function checkNoteBlockDoc(input: unknown): CheckResult {
  if (!isRecord(input)) return { ok: false, reason: "document must be an object" };
  if (!["page-meta", "task", "template", "broken"].includes(input.type as string)) {
    return { ok: false, reason: "unknown type" };
  }

  const commonError = validCommon(input);
  if (commonError) return { ok: false, reason: commonError };

  if (input.type === "broken") {
    const allowed = [...COMMON_KEYS, "blockId", "errorCode"];
    if (!hasOnlyKeys(input, allowed)) return { ok: false, reason: "unknown top-level key" };
    if (input.blockId !== undefined && typeof input.blockId !== "string")
      return { ok: false, reason: "invalid blockId" };
    if (typeof input.errorCode !== "string" || !ERROR_CODES.has(input.errorCode))
      return { ok: false, reason: "invalid errorCode" };
    return { ok: true, doc: input as NoteBlockDoc };
  }

  if (!hasOnlyKeys(input, [...COMMON_KEYS, "blockId", "v", "data"]))
    return { ok: false, reason: "unknown top-level key" };
  const envelopeError = validStoredEnvelope(input);
  if (envelopeError) return { ok: false, reason: envelopeError };
  const data = input.data as RecordValue;

  if (input.type === "page-meta") {
    if (
      !hasOnlyKeys(data, ["pageType", "date", "tags"]) ||
      !PAGE_TYPES.has(data.pageType as string) ||
      !isOptionalString(data.date) ||
      !stringsOnly(data.tags)
    )
      return { ok: false, reason: "invalid page-meta data" };
  } else if (input.type === "task") {
    if (
      !hasOnlyKeys(data, [
        "title",
        "durationMin",
        "status",
        "order",
        "inelastic",
        "reason",
        "scheduledAt",
        "doneAt",
      ]) ||
      typeof data.title !== "string" ||
      !Number.isInteger(data.durationMin) ||
      (data.durationMin as number) < 1 ||
      (data.durationMin as number) > 1_440 ||
      !["now", "later", "done"].includes(data.status as string) ||
      !isTimestamp(data.order) ||
      typeof data.inelastic !== "boolean" ||
      !isOptionalString(data.reason) ||
      !isOptionalNullableString(data.scheduledAt) ||
      !isOptionalNullableString(data.doneAt)
    ) {
      return { ok: false, reason: "invalid task data" };
    }
  } else {
    if (
      !hasOnlyKeys(data, [
        "name",
        "forPageType",
        "isDefault",
        "tokens",
        "origin",
        "status",
        "enabled",
      ]) ||
      typeof data.name !== "string" ||
      !PAGE_TYPES.has(data.forPageType as string) ||
      typeof data.isDefault !== "boolean" ||
      !stringsOnly(data.tokens) ||
      !["builtin", "user"].includes(data.origin as string) ||
      !["draft", "live"].includes(data.status as string) ||
      typeof data.enabled !== "boolean"
    ) {
      return { ok: false, reason: "invalid template data" };
    }
  }

  return { ok: true, doc: input as NoteBlockDoc };
}

export function softDeleteNoteBlock(doc: NoteBlockDoc, nowMs: number): NoteBlockDoc {
  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}
