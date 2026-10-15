import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "./requireUser";

/**
 * Sign-up approval gate (TEMPO-GATE-01).
 *
 * Every NEW account starts `pending`. Amit (an admin) approves or revokes it.
 * Pending and revoked accounts can hold a session, but the app only shows them
 * the "waiting for approval" screen, and every Convex function that spends
 * money on a model (LLM, STT, TTS) or writes coach chat rejects them here,
 * server-side.
 *
 * Admins: `role === "admin"` on the users row, or an email listed in the Convex
 * env var `TEMPO_ADMIN_EMAILS` (comma separated). Admins are always approved.
 */
export type ApprovalStatus = "pending" | "approved" | "revoked";

/**
 * Accounts created before this instant by the pre-gate code have no
 * `approvalStatus` field. They count as approved ("existing users stay
 * approved"). Rows created after it with no field count as pending (fail
 * closed). New rows always get an explicit status from `newUserFields`.
 * 7 Oct 2026 00:00 IDT.
 */
export const APPROVAL_GATE_EPOCH_MS = Date.UTC(2026, 9, 6, 21, 0, 0);

/** Error text the client matches to show the waiting screen. */
export const PENDING_APPROVAL_ERROR = "ACCOUNT_PENDING_APPROVAL";
export const PENDING_APPROVAL_MESSAGE = `${PENDING_APPROVAL_ERROR}: your account is waiting for approval.`;

type ApprovalUser = Pick<Doc<"users">, "email" | "role" | "approvalStatus"> & {
	_creationTime?: number;
};

export function normalizeEmail(email: string | undefined | null): string {
	return (email ?? "").trim().toLowerCase();
}

export function parseEmailList(raw: string | undefined | null): string[] {
	return (raw ?? "")
		.split(/[,\s]+/)
		.map((e) => normalizeEmail(e))
		.filter((e) => e.includes("@"));
}

/** Emails from the Convex env var TEMPO_ADMIN_EMAILS. */
export function adminEmails(): string[] {
	return parseEmailList(process.env.TEMPO_ADMIN_EMAILS);
}

export function isAdminUser(
	user: Pick<ApprovalUser, "email" | "role">,
	admins: string[] = adminEmails(),
): boolean {
	if (user.role === "admin") {
		return true;
	}
	const email = normalizeEmail(user.email);
	return email !== "" && admins.includes(email);
}

/** Status for a brand-new account: admins are approved, everyone else waits. */
export function initialApprovalStatus(
	email: string,
	admins: string[] = adminEmails(),
): "pending" | "approved" {
	return admins.includes(normalizeEmail(email)) ? "approved" : "pending";
}

export function approvalStatusOf(
	user: ApprovalUser,
	admins: string[] = adminEmails(),
): ApprovalStatus {
	if (isAdminUser(user, admins)) {
		return "approved";
	}
	if (user.approvalStatus) {
		return user.approvalStatus;
	}
	return (user._creationTime ?? 0) < APPROVAL_GATE_EPOCH_MS
		? "approved"
		: "pending";
}

export type ReleaseApprovalDecision =
	| "approve"
	| "already"
	| "revoked"
	| "deleted"
	| "new";

/**
 * TEMPO-GATE-03 release backfill: what `approval.approveAllExistingUsers` does
 * with one account. Every account that exists before `cutoffMs` becomes
 * approved, except an explicit admin `revoked` decision and soft-deleted rows.
 * Accounts created at or after the cutoff are left alone (they start pending).
 */
export function releaseApprovalDecision(
	user: Pick<Doc<"users">, "approvalStatus" | "deletedAt"> & {
		_creationTime: number;
	},
	cutoffMs: number,
): ReleaseApprovalDecision {
	if (user._creationTime >= cutoffMs) return "new";
	if (user.deletedAt !== undefined) return "deleted";
	if (user.approvalStatus === "approved") return "already";
	if (user.approvalStatus === "revoked") return "revoked";
	return "approve";
}

export function isApproved(
	user: ApprovalUser,
	admins: string[] = adminEmails(),
): boolean {
	return approvalStatusOf(user, admins) === "approved";
}

/** requireUser + approved. Use in every query/mutation that spends model money or writes chat. */
export async function requireApprovedUser(ctx: QueryCtx | MutationCtx) {
	const user = await requireUser(ctx);
	if (!isApproved(user)) {
		throw new Error(PENDING_APPROVAL_MESSAGE);
	}
	return user;
}

/** requireUser + admin (role or TEMPO_ADMIN_EMAILS). */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
	const user = await requireUser(ctx);
	if (!isAdminUser(user)) {
		throw new Error("Access denied");
	}
	return user;
}
