export type SubscriptionStateDoc = {
  plan: "none" | "trial" | "basic" | "pro" | "max";
  billingCycle: "none" | "monthly" | "annual" | "lifetime";
  status: "inactive" | "active" | "grace" | "cancelled";
  trialUsed: boolean;
  source?: string;
  createdAt: number;
  updatedAt: number;
};

type ValidationResult =
  | { ok: true; doc: SubscriptionStateDoc }
  | { ok: false; reason: string };

const SUBSCRIPTION_STATE_KEYS = new Set<keyof SubscriptionStateDoc>([
  "plan",
  "billingCycle",
  "status",
  "trialUsed",
  "source",
  "createdAt",
  "updatedAt",
]);

const PLANS = new Set<SubscriptionStateDoc["plan"]>([
  "none",
  "trial",
  "basic",
  "pro",
  "max",
]);
const BILLING_CYCLES = new Set<SubscriptionStateDoc["billingCycle"]>([
  "none",
  "monthly",
  "annual",
  "lifetime",
]);
const STATUSES = new Set<SubscriptionStateDoc["status"]>([
  "inactive",
  "active",
  "grace",
  "cancelled",
]);

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function inspectSubscriptionState(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "subscription state must be an object" };
  }

  const value = input as Record<string, unknown>;
  const unknownKey = Object.keys(value).find(
    (key) => !SUBSCRIPTION_STATE_KEYS.has(key as keyof SubscriptionStateDoc),
  );
  if (unknownKey) return { ok: false, reason: `unknown key: ${unknownKey}` };

  if (!PLANS.has(value.plan as SubscriptionStateDoc["plan"])) {
    return { ok: false, reason: "invalid plan" };
  }
  if (!BILLING_CYCLES.has(value.billingCycle as SubscriptionStateDoc["billingCycle"])) {
    return { ok: false, reason: "invalid billingCycle" };
  }
  if (!STATUSES.has(value.status as SubscriptionStateDoc["status"])) {
    return { ok: false, reason: "invalid status" };
  }
  if (typeof value.trialUsed !== "boolean") {
    return { ok: false, reason: "trialUsed must be a boolean" };
  }
  if (
    value.source !== undefined &&
    (typeof value.source !== "string" || value.source.length < 1 || value.source.length > 64)
  ) {
    return { ok: false, reason: "source must be a string of 1 to 64 characters" };
  }
  if (!isTimestamp(value.createdAt)) {
    return { ok: false, reason: "createdAt must be a safe integer >= 0" };
  }
  if (!isTimestamp(value.updatedAt)) {
    return { ok: false, reason: "updatedAt must be a safe integer >= 0" };
  }
  if (value.updatedAt < value.createdAt) {
    return { ok: false, reason: "updatedAt must not be earlier than createdAt" };
  }

  return { ok: true, doc: value as SubscriptionStateDoc };
}

export function validateSubscriptionStateDoc(input: unknown): ValidationResult {
  try {
    return inspectSubscriptionState(input);
  } catch {
    return { ok: false, reason: "subscription state could not be inspected" };
  }
}

export function newSubscriptionState(now: number): SubscriptionStateDoc {
  return {
    plan: "none",
    billingCycle: "none",
    status: "inactive",
    trialUsed: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function hasPaidAccess(doc: SubscriptionStateDoc): boolean {
  return doc.plan !== "none" && (doc.status === "active" || doc.status === "grace");
}
