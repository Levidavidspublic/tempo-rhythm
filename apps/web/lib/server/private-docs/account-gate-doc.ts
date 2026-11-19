export type AccountGateDoc = {
  email: string;
  emailVerificationTime?: number;
  emailVerified?: boolean;
  role?: "admin" | "user";
  userType?: "free" | "paid";
  betaAccess?: "none" | "tester" | "founder";
  entitlementTier?: "none" | "basic" | "pro" | "max" | "god";
  isGodTier?: boolean;
  betaApprovedAt?: number;
  isActive?: boolean;
  approvalStatus?: "pending" | "approved" | "revoked";
  approvalUpdatedAt?: number;
  approvalUpdatedBy?: string;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number;
};

const ACCOUNT_GATE_KEYS = new Set<keyof AccountGateDoc>([
  "email",
  "emailVerificationTime",
  "emailVerified",
  "role",
  "userType",
  "betaAccess",
  "entitlementTier",
  "isGodTier",
  "betaApprovedAt",
  "isActive",
  "approvalStatus",
  "approvalUpdatedAt",
  "approvalUpdatedBy",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const ROLES = new Set<NonNullable<AccountGateDoc["role"]>>(["admin", "user"]);
const USER_TYPES = new Set<NonNullable<AccountGateDoc["userType"]>>(["free", "paid"]);
const BETA_ACCESS = new Set<NonNullable<AccountGateDoc["betaAccess"]>>([
  "none",
  "tester",
  "founder",
]);
const ENTITLEMENT_TIERS = new Set<NonNullable<AccountGateDoc["entitlementTier"]>>([
  "none",
  "basic",
  "pro",
  "max",
  "god",
]);
const APPROVAL_STATUSES = new Set<NonNullable<AccountGateDoc["approvalStatus"]>>([
  "pending",
  "approved",
  "revoked",
]);

const TIME_FIELDS = [
  "emailVerificationTime",
  "betaApprovedAt",
  "approvalUpdatedAt",
  "createdAt",
  "updatedAt",
  "deletedAt",
] as const satisfies readonly (keyof AccountGateDoc)[];

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.includes("@");
}

function isEpochMilliseconds(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validate(input: unknown):
  | { ok: true; doc: AccountGateDoc }
  | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "account gate must be an object" };
  }

  const value = input as Record<string, unknown>;
  const unknownKey = Object.keys(value).find(
    (key) => !ACCOUNT_GATE_KEYS.has(key as keyof AccountGateDoc),
  );
  if (unknownKey) return { ok: false, reason: `unknown key: ${unknownKey}` };

  if (!isValidEmail(value.email)) return { ok: false, reason: "invalid email" };
  if (value.emailVerified !== undefined && typeof value.emailVerified !== "boolean") {
    return { ok: false, reason: "emailVerified must be a boolean" };
  }
  if (value.role !== undefined && !ROLES.has(value.role as NonNullable<AccountGateDoc["role"]>)) {
    return { ok: false, reason: "invalid role" };
  }
  if (
    value.userType !== undefined &&
    !USER_TYPES.has(value.userType as NonNullable<AccountGateDoc["userType"]>)
  ) {
    return { ok: false, reason: "invalid userType" };
  }
  if (
    value.betaAccess !== undefined &&
    !BETA_ACCESS.has(value.betaAccess as NonNullable<AccountGateDoc["betaAccess"]>)
  ) {
    return { ok: false, reason: "invalid betaAccess" };
  }
  if (
    value.entitlementTier !== undefined &&
    !ENTITLEMENT_TIERS.has(
      value.entitlementTier as NonNullable<AccountGateDoc["entitlementTier"]>,
    )
  ) {
    return { ok: false, reason: "invalid entitlementTier" };
  }
  if (value.isGodTier !== undefined && typeof value.isGodTier !== "boolean") {
    return { ok: false, reason: "isGodTier must be a boolean" };
  }
  if (value.isActive !== undefined && typeof value.isActive !== "boolean") {
    return { ok: false, reason: "isActive must be a boolean" };
  }
  if (
    value.approvalStatus !== undefined &&
    !APPROVAL_STATUSES.has(
      value.approvalStatus as NonNullable<AccountGateDoc["approvalStatus"]>,
    )
  ) {
    return { ok: false, reason: "invalid approvalStatus" };
  }
  if (value.approvalUpdatedBy !== undefined && typeof value.approvalUpdatedBy !== "string") {
    return { ok: false, reason: "approvalUpdatedBy must be a string" };
  }
  for (const field of TIME_FIELDS) {
    if (value[field] !== undefined && !isEpochMilliseconds(value[field])) {
      return { ok: false, reason: `${field} must be epoch milliseconds` };
    }
  }

  return { ok: true, doc: value as AccountGateDoc };
}

export function validateAccountGateDoc(
  input: unknown,
): { ok: true; doc: AccountGateDoc } | { ok: false; reason: string } {
  try {
    return validate(input);
  } catch {
    return { ok: false, reason: "account gate could not be inspected" };
  }
}

export function newAccountGate(email: string, now: number): AccountGateDoc {
  const cleanedEmail = email.trim().toLowerCase();
  if (!isValidEmail(cleanedEmail)) throw new Error("Invalid email");

  return {
    email: cleanedEmail,
    role: "user",
    userType: "free",
    betaAccess: "none",
    isActive: true,
    approvalStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };
}
