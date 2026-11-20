import { accountAccess, type AccountAccess, type AccountGate } from "./account-gate";

export const ACCESS_COPY_KEYS = ["access.missing", "access.inactive", "access.pending"] as const;

export type AccessRefusal = Readonly<{
  httpStatus: 403;
  code: "ACCOUNT_NOT_FOUND" | "ACCOUNT_INACTIVE" | "ACCOUNT_PENDING_APPROVAL";
  copyKey: (typeof ACCESS_COPY_KEYS)[number];
}>;

export function accessRefusal(
  access: AccountAccess,
  need: "active" | "approved"
): AccessRefusal | null {
  switch (access) {
    case "missing":
      return { httpStatus: 403, code: "ACCOUNT_NOT_FOUND", copyKey: "access.missing" };
    case "inactive":
      return { httpStatus: 403, code: "ACCOUNT_INACTIVE", copyKey: "access.inactive" };
    case "pending":
      return need === "approved"
        ? {
            httpStatus: 403,
            code: "ACCOUNT_PENDING_APPROVAL",
            copyKey: "access.pending",
          }
        : null;
    case "approved":
      return null;
  }
}

export function gateRefusal(
  gate: AccountGate | null | undefined,
  need: "active" | "approved"
): AccessRefusal | null {
  return accessRefusal(accountAccess(gate), need);
}

export function refusalBody(refusal: AccessRefusal): { error: string; copyKey: string } {
  return { error: refusal.code, copyKey: refusal.copyKey };
}
