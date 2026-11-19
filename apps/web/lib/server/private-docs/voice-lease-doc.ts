export type VoiceLeaseDoc = {
  conversationId: string;
  clientKey: string;
  status: "active" | "ended";
  language: "en" | "he";
  startedAt: number;
  lastRenewalAt: number;
  endedAt?: number;
  durationMs?: number;
  endReason?: "stopped" | "replaced" | "expired" | "exhausted" | "revoked";
  dateKey: string;
  utcDateKey: string;
  grants: number;
  sentences: number;
  ttsChars: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

const VOICE_LEASE_KEYS = new Set<keyof VoiceLeaseDoc>([
  "conversationId",
  "clientKey",
  "status",
  "language",
  "startedAt",
  "lastRenewalAt",
  "endedAt",
  "durationMs",
  "endReason",
  "dateKey",
  "utcDateKey",
  "grants",
  "sentences",
  "ttsChars",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const END_REASONS = new Set<NonNullable<VoiceLeaseDoc["endReason"]>>([
  "stopped",
  "replaced",
  "expired",
  "exhausted",
  "revoked",
]);

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function inspectVoiceLeaseDoc(
  input: unknown
): { ok: true; doc: VoiceLeaseDoc } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "voice lease must be an object" };
  }

  const value = input as Record<string, unknown>;
  const unknownKey = Object.keys(value).find(
    (key) => !VOICE_LEASE_KEYS.has(key as keyof VoiceLeaseDoc)
  );
  if (unknownKey) return { ok: false, reason: `unknown key: ${unknownKey}` };

  if (typeof value.conversationId !== "string" || value.conversationId.length === 0) {
    return { ok: false, reason: "conversationId must be a non-empty string" };
  }
  if (typeof value.clientKey !== "string" || value.clientKey.length === 0) {
    return { ok: false, reason: "clientKey must be a non-empty string" };
  }
  if (value.status !== "active" && value.status !== "ended") {
    return { ok: false, reason: "invalid status" };
  }
  if (value.language !== "en" && value.language !== "he") {
    return { ok: false, reason: "invalid language" };
  }
  if (!isCalendarDate(value.dateKey)) {
    return { ok: false, reason: "dateKey must be a real YYYY-MM-DD calendar date" };
  }
  if (!isCalendarDate(value.utcDateKey)) {
    return { ok: false, reason: "utcDateKey must be a real YYYY-MM-DD calendar date" };
  }

  for (const key of [
    "startedAt",
    "lastRenewalAt",
    "grants",
    "sentences",
    "ttsChars",
    "createdAt",
    "updatedAt",
  ] as const) {
    if (!isNonNegativeSafeInteger(value[key])) {
      return { ok: false, reason: `${key} must be a safe integer >= 0` };
    }
  }
  if ((value.lastRenewalAt as number) < (value.startedAt as number)) {
    return { ok: false, reason: "lastRenewalAt must not be earlier than startedAt" };
  }

  const hasOwn = (key: keyof VoiceLeaseDoc) => Object.hasOwn(value, key);
  if (hasOwn("deletedAt") && !isNonNegativeSafeInteger(value.deletedAt)) {
    return { ok: false, reason: "deletedAt must be a safe integer >= 0" };
  }

  const hasEndedAt = hasOwn("endedAt");
  const hasDurationMs = hasOwn("durationMs");
  const hasEndReason = hasOwn("endReason");
  if (value.status === "active") {
    if (hasEndedAt || hasDurationMs || hasEndReason) {
      return { ok: false, reason: "active lease must not have end fields" };
    }
  } else {
    if (!hasEndedAt || !isNonNegativeSafeInteger(value.endedAt)) {
      return { ok: false, reason: "ended lease must have a valid endedAt" };
    }
    if (!hasDurationMs || !isNonNegativeSafeInteger(value.durationMs)) {
      return { ok: false, reason: "ended lease must have a valid durationMs" };
    }
    if (
      !hasEndReason ||
      !END_REASONS.has(value.endReason as NonNullable<VoiceLeaseDoc["endReason"]>)
    ) {
      return { ok: false, reason: "ended lease must have a valid endReason" };
    }
  }

  return { ok: true, doc: value as VoiceLeaseDoc };
}

export function validateVoiceLeaseDoc(
  input: unknown
): { ok: true; doc: VoiceLeaseDoc } | { ok: false; reason: string } {
  try {
    return inspectVoiceLeaseDoc(input);
  } catch {
    return { ok: false, reason: "voice lease could not be inspected" };
  }
}

export function leaseUsedMs(doc: VoiceLeaseDoc): number {
  return doc.status === "ended"
    ? (doc.durationMs as number)
    : Math.max(0, doc.lastRenewalAt - doc.startedAt);
}

export function usedMsOnUtcDay(leases: readonly VoiceLeaseDoc[], utcDateKey: string): number {
  return leases
    .filter((lease) => lease.utcDateKey === utcDateKey && lease.deletedAt === undefined)
    .reduce((total, lease) => total + leaseUsedMs(lease), 0);
}
