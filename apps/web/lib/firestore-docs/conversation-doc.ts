export type ConversationDoc = {
  title: string;
  technique?: string;
  agentThreadId?: string;
  nextChatSequence?: number;
  chatGenerationEpoch?: number;
  activeChatRequestId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type MessageDoc = {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelUsed?: string;
  councilResponse?: unknown;
  toolCalls?: unknown;
  sources?: { title: string; site: string; url: string }[];
  createdAt: number;
  deletedAt?: number;
};

type CheckResult<T> = { ok: true; doc: T } | { ok: false; reason: string };

const conversationKeys = new Set([
  "title",
  "technique",
  "agentThreadId",
  "nextChatSequence",
  "chatGenerationEpoch",
  "activeChatRequestId",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const messageKeys = new Set([
  "conversationId",
  "role",
  "content",
  "modelUsed",
  "councilResponse",
  "toolCalls",
  "sources",
  "createdAt",
  "deletedAt",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(input).every((key) => allowed.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value);
}

function isOptionalTimestamp(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isOptionalNonnegativeSafeInteger(value: unknown): value is number | undefined {
  return value === undefined || (Number.isSafeInteger(value) && (value as number) >= 0);
}

function isFirestoreValue(value: unknown, insideArray = false): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value)
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return (
      !insideArray && value.every((item) => item !== undefined && isFirestoreValue(item, true))
    );
  }
  if (isPlainObject(value)) {
    return Object.values(value).every((item) => item === undefined || isFirestoreValue(item));
  }
  return false;
}

function checkConversation(input: unknown): CheckResult<ConversationDoc> {
  if (!isPlainObject(input)) return { ok: false, reason: "Conversation must be a plain object" };
  if (!hasOnlyKeys(input, conversationKeys)) {
    return { ok: false, reason: "Conversation contains an unknown field" };
  }
  if (!isNonEmptyString(input.title) || input.title.length > 200) {
    return {
      ok: false,
      reason: "title must be non-empty and at most 200 characters",
    };
  }
  if (!isFiniteNumber(input.createdAt) || !isFiniteNumber(input.updatedAt)) {
    return {
      ok: false,
      reason: "createdAt and updatedAt must be finite numbers",
    };
  }
  if (!isOptionalTimestamp(input.deletedAt)) {
    return { ok: false, reason: "deletedAt must be a finite number" };
  }
  for (const key of ["technique", "agentThreadId", "activeChatRequestId"] as const) {
    if (!isOptionalNonEmptyString(input[key])) {
      return { ok: false, reason: `${key} must be a non-empty string` };
    }
  }
  for (const key of ["nextChatSequence", "chatGenerationEpoch"] as const) {
    if (!isOptionalNonnegativeSafeInteger(input[key])) {
      return { ok: false, reason: `${key} must be a nonnegative safe integer` };
    }
  }
  return { ok: true, doc: { ...input } as ConversationDoc };
}

export function checkConversationDoc(input: unknown): CheckResult<ConversationDoc> {
  try {
    return checkConversation(input);
  } catch {
    return { ok: false, reason: "Conversation could not be checked" };
  }
}

function checkMessage(input: unknown): CheckResult<MessageDoc> {
  if (!isPlainObject(input)) return { ok: false, reason: "Message must be a plain object" };
  if (!hasOnlyKeys(input, messageKeys))
    return { ok: false, reason: "Message contains an unknown field" };
  if (!isNonEmptyString(input.conversationId)) {
    return { ok: false, reason: "conversationId must be a non-empty string" };
  }
  if (input.role !== "user" && input.role !== "assistant" && input.role !== "system") {
    return { ok: false, reason: "role must be user, assistant, or system" };
  }
  if (typeof input.content !== "string") return { ok: false, reason: "content must be a string" };
  if (!isOptionalNonEmptyString(input.modelUsed)) {
    return { ok: false, reason: "modelUsed must be a non-empty string" };
  }
  if (!isFiniteNumber(input.createdAt) || !isOptionalTimestamp(input.deletedAt)) {
    return { ok: false, reason: "timestamps must be finite numbers" };
  }
  for (const key of ["councilResponse", "toolCalls"] as const) {
    const value = input[key];
    if (
      value !== undefined &&
      ((!Array.isArray(value) && !isPlainObject(value)) || !isFirestoreValue(value))
    ) {
      return { ok: false, reason: `${key} must be an encodable Firestore object or array` };
    }
  }
  if (input.sources !== undefined) {
    if (!Array.isArray(input.sources)) return { ok: false, reason: "sources must be an array" };
    for (const source of input.sources) {
      if (
        !isPlainObject(source) ||
        Object.keys(source).length !== 3 ||
        !hasOnlyKeys(source, new Set(["title", "site", "url"])) ||
        typeof source.title !== "string" ||
        typeof source.site !== "string" ||
        typeof source.url !== "string" ||
        !/^https?:\/\//.test(source.url)
      ) {
        return {
          ok: false,
          reason: "Each source must have title, site, and an HTTP(S) url",
        };
      }
    }
  }
  return { ok: true, doc: { ...input } as MessageDoc };
}

export function checkMessageDoc(input: unknown): CheckResult<MessageDoc> {
  try {
    return checkMessage(input);
  } catch {
    return { ok: false, reason: "Message could not be checked" };
  }
}
