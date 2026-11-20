export type ApprovalStatus = "pending" | "approved" | "revoked";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function parseAdminEmails(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map(normalizeEmail)
    .filter((email) => email.includes("@"));
}

export function isAdmin(
  gate: { email?: string | null; role?: string },
  admins: readonly string[]
): boolean {
  if (gate.role === "admin") {
    return true;
  }

  const email = normalizeEmail(gate.email);
  return email !== "" && admins.includes(email);
}

export function initialApproval(email: string, admins: readonly string[]): "pending" | "approved" {
  return admins.includes(normalizeEmail(email)) ? "approved" : "pending";
}

export function approvalFor(
  gate: { email?: string | null; role?: string; approvalStatus?: string },
  admins: readonly string[]
): ApprovalStatus {
  if (isAdmin(gate, admins)) {
    return "approved";
  }

  if (gate.approvalStatus === "approved" || gate.approvalStatus === "revoked") {
    return gate.approvalStatus;
  }

  return "pending";
}
