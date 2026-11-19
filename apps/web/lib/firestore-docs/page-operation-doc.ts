export const PAGE_OPERATION_METADATA_TTL_MS = 48 * 60 * 60 * 1_000;

type PageOperationDelta = {
  startUtf16: number;
  removedLengthUtf16: number;
  insertedLengthUtf16: number;
};

export type PageOperationDoc = {
  noteId: string;
  requestId: string;
  requestDigest: string;
  kind: "save" | "patch_block" | "add_task" | "undo";
  source: "ui" | "coach" | "mcp" | "legacy";
  result: "applied" | "noop";
  affectsBody: boolean;
  baseRevision: number;
  resultRevision: number;
  baseBodyDigest: string;
  resultBodyDigest: string;
  delta: PageOperationDelta[];
  appliedAtMs: number;
  undoUntilMs?: number;
  undoneAtMs?: number;
  undoneByOperationId?: string;
  undoOfOperationId?: string;
  proposalId?: string;
  metadataExpiresAtMs: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckResult = { ok: true; doc: PageOperationDoc } | { ok: false; reason: string };

const REQUIRED_KEYS = [
  "noteId",
  "requestId",
  "requestDigest",
  "kind",
  "source",
  "result",
  "affectsBody",
  "baseRevision",
  "resultRevision",
  "baseBodyDigest",
  "resultBodyDigest",
  "delta",
  "appliedAtMs",
  "metadataExpiresAtMs",
  "createdAt",
  "updatedAt",
] as const;

const OPTIONAL_KEYS = [
  "undoUntilMs",
  "undoneAtMs",
  "undoneByOperationId",
  "undoOfOperationId",
  "proposalId",
  "deletedAt",
] as const;

const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const REQUEST_ID = /^req_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const KINDS = new Set(["save", "patch_block", "add_task", "undo"]);
const SOURCES = new Set(["ui", "coach", "mcp", "legacy"]);
const RESULTS = new Set(["applied", "noop"]);

function fail(reason: string): CheckResult {
  return { ok: false, reason };
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isRevision(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) < Number.MAX_SAFE_INTEGER
  );
}

function isDocumentId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("/");
}

/** Checks an untrusted, content-free Firestore page-operation receipt. */
export function checkPageOperationDoc(input: unknown): CheckResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail("page operation must be an object");
  }

  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) return fail(`unknown key: ${key}`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(record, key)) return fail(`missing key: ${key}`);
  }

  if (!isDocumentId(record.noteId)) return fail("noteId must be a document id");
  for (const key of ["undoneByOperationId", "undoOfOperationId", "proposalId"] as const) {
    if (record[key] !== undefined && !isDocumentId(record[key])) {
      return fail(`${key} must be a document id`);
    }
  }
  if (typeof record.requestId !== "string" || !REQUEST_ID.test(record.requestId)) {
    return fail("requestId must contain a valid req_ ULID");
  }
  for (const key of ["requestDigest", "baseBodyDigest", "resultBodyDigest"] as const) {
    if (typeof record[key] !== "string" || !DIGEST.test(record[key])) {
      return fail(`${key} must be a lowercase SHA-256 digest`);
    }
  }
  if (!KINDS.has(record.kind as string)) return fail("invalid kind");
  if (!SOURCES.has(record.source as string)) return fail("invalid source");
  if (!RESULTS.has(record.result as string)) return fail("invalid result");
  if (typeof record.affectsBody !== "boolean") return fail("affectsBody must be boolean");
  if (!isRevision(record.baseRevision) || !isRevision(record.resultRevision)) {
    return fail("revisions must be safe nonnegative integers below MAX_SAFE_INTEGER");
  }
  if (!Array.isArray(record.delta)) return fail("delta must be an array");
  for (const entry of record.delta) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return fail("delta entry must be an object");
    }
    const delta = entry as Record<string, unknown>;
    const keys = Object.keys(delta);
    if (
      keys.length !== 3 ||
      !keys.every((key) =>
        ["startUtf16", "removedLengthUtf16", "insertedLengthUtf16"].includes(key)
      )
    ) {
      return fail("delta entry has an invalid shape");
    }
    if (
      !isTimestamp(delta.startUtf16) ||
      !isTimestamp(delta.removedLengthUtf16) ||
      !isTimestamp(delta.insertedLengthUtf16)
    ) {
      return fail("delta values must be nonnegative safe integers");
    }
  }

  for (const key of [
    "appliedAtMs",
    "undoUntilMs",
    "undoneAtMs",
    "metadataExpiresAtMs",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ] as const) {
    if (record[key] !== undefined && !isTimestamp(record[key])) {
      return fail(`${key} must be a safe nonnegative integer timestamp`);
    }
  }

  const has = (key: string) => Object.hasOwn(record, key) && record[key] !== undefined;
  if (record.result === "applied") {
    if (!record.affectsBody || record.resultRevision !== record.baseRevision + 1) {
      return fail("an applied write must affect the body and advance one revision");
    }
    if (record.delta.length === 0) return fail("an applied write must have a nonempty delta");
  } else {
    if (
      record.affectsBody ||
      record.resultRevision !== record.baseRevision ||
      record.resultBodyDigest !== record.baseBodyDigest ||
      record.delta.length !== 0
    ) {
      return fail("a noop must leave the body, revision, digest, and delta unchanged");
    }
    if (
      has("undoUntilMs") ||
      has("undoneAtMs") ||
      has("undoneByOperationId") ||
      has("undoOfOperationId")
    ) {
      return fail("a noop cannot carry undo fields");
    }
  }

  if (has("undoUntilMs") && (record.result !== "applied" || record.kind === "undo")) {
    return fail("undoUntilMs is only valid on an applied non-undo operation");
  }
  if (has("undoneAtMs") !== has("undoneByOperationId")) {
    return fail("undoneAtMs and undoneByOperationId must be present together");
  }
  if ((record.kind === "undo") !== has("undoOfOperationId")) {
    return fail("undoOfOperationId must be present exactly when kind is undo");
  }
  const appliedAtMs = record.appliedAtMs as number;
  if (record.metadataExpiresAtMs !== appliedAtMs + PAGE_OPERATION_METADATA_TTL_MS) {
    return fail("metadataExpiresAtMs must be 48 hours after appliedAtMs");
  }

  return { ok: true, doc: input as PageOperationDoc };
}
