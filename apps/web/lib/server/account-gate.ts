export type AccountGate = Readonly<{
  deletedAt?: number | null;
  isActive?: boolean;
  approvalStatus?: string;
}>;

export type AccountAccess = "missing" | "inactive" | "pending" | "approved";

export function accountGatePath(uid: string): string {
  if (!uid || uid.includes("/") || uid === "." || uid === ".." || /^__.*__$/.test(uid)) {
    throw new Error("Invalid account id");
  }

  return `private/${uid}/account/gate`;
}

export function isAccountActive(gate: AccountGate): boolean {
  return (gate.deletedAt === undefined || gate.deletedAt === null) && gate.isActive !== false;
}

export function accountAccess(gate: AccountGate | null | undefined): AccountAccess {
  if (gate === null || gate === undefined) {
    return "missing";
  }
  if (!isAccountActive(gate)) {
    return "inactive";
  }
  return gate.approvalStatus === "approved" ? "approved" : "pending";
}

export function canUsePaidRoute(gate: AccountGate | null | undefined): boolean {
  return accountAccess(gate) === "approved";
}
