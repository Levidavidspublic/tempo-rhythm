import { afterEach, describe, expect, test } from "bun:test";
import {
	APPROVAL_GATE_EPOCH_MS,
	approvalStatusOf,
	initialApprovalStatus,
	isAdminUser,
	isApproved,
	parseEmailList,
	releaseApprovalDecision,
} from "./approval";
import { newUserFields } from "./entitlements";

const ADMINS = ["amitlevin65@gmail.com", "amitlevin65@protonmail.com"];
const AFTER = APPROVAL_GATE_EPOCH_MS + 1;
const BEFORE = APPROVAL_GATE_EPOCH_MS - 1;
const originalAdmins = process.env.TEMPO_ADMIN_EMAILS;

afterEach(() => {
	if (originalAdmins === undefined) delete process.env.TEMPO_ADMIN_EMAILS;
	else process.env.TEMPO_ADMIN_EMAILS = originalAdmins;
});

describe("approval gate", () => {
	test("parseEmailList trims, lowercases and drops junk", () => {
		expect(parseEmailList(" A@B.com, ,c@d.io\nnot-an-email ")).toEqual([
			"a@b.com",
			"c@d.io",
		]);
		expect(parseEmailList(undefined)).toEqual([]);
	});

	test("a brand-new account starts pending; an admin email starts approved", () => {
		expect(initialApprovalStatus("new@example.com", ADMINS)).toBe("pending");
		expect(initialApprovalStatus(" AmitLevin65@gmail.com ", ADMINS)).toBe(
			"approved",
		);
	});

	test("newUserFields defaults to pending and only stamps betaApprovedAt when approved", () => {
		const pending = newUserFields({ email: "new@example.com" }, 1);
		expect(pending.approvalStatus).toBe("pending");
		expect("betaApprovedAt" in pending).toBe(false);
		const approved = newUserFields(
			{ email: "amitlevin65@gmail.com" },
			1,
			"approved",
		);
		expect(approved.approvalStatus).toBe("approved");
		expect(approved.betaApprovedAt).toBe(1);
	});

	test("explicit status wins for normal users", () => {
		for (const status of ["pending", "approved", "revoked"] as const) {
			expect(
				approvalStatusOf(
					{ email: "x@y.z", approvalStatus: status, _creationTime: BEFORE },
					ADMINS,
				),
			).toBe(status);
		}
	});

	test("pre-gate rows with no status stay approved; post-gate rows with no status are pending", () => {
		expect(
			approvalStatusOf({ email: "old@y.z", _creationTime: BEFORE }, ADMINS),
		).toBe("approved");
		expect(
			approvalStatusOf({ email: "new@y.z", _creationTime: AFTER }, ADMINS),
		).toBe("pending");
	});

	test("admins (role or TEMPO_ADMIN_EMAILS) are always approved, even if revoked", () => {
		expect(isAdminUser({ email: "z@z.z", role: "admin" }, [])).toBe(true);
		expect(isAdminUser({ email: "AMITLEVIN65@protonmail.com" }, ADMINS)).toBe(
			true,
		);
		expect(
			isAdminUser({ email: "someone@else.com", role: "user" }, ADMINS),
		).toBe(false);
		expect(
			isApproved(
				{
					email: "amitlevin65@gmail.com",
					approvalStatus: "revoked",
					_creationTime: AFTER,
				},
				ADMINS,
			),
		).toBe(true);
	});

	test("reads TEMPO_ADMIN_EMAILS from the Convex env by default", () => {
		process.env.TEMPO_ADMIN_EMAILS = "boss@example.com";
		expect(initialApprovalStatus("boss@example.com")).toBe("approved");
		expect(
			isApproved({ email: "pending@example.com", approvalStatus: "pending" }),
		).toBe(false);
	});
});

describe("release backfill (TEMPO-GATE-03)", () => {
	const CUTOFF = 1_000_000;
	test("every existing pending or unset account is approved", () => {
		expect(
			releaseApprovalDecision(
				{ approvalStatus: "pending", _creationTime: CUTOFF - 1 },
				CUTOFF,
			),
		).toBe("approve");
		expect(releaseApprovalDecision({ _creationTime: CUTOFF - 1 }, CUTOFF)).toBe(
			"approve",
		);
	});
	test("approved stays, revoked and deleted are kept, new sign-ups are left pending", () => {
		expect(
			releaseApprovalDecision(
				{ approvalStatus: "approved", _creationTime: 1 },
				CUTOFF,
			),
		).toBe("already");
		expect(
			releaseApprovalDecision(
				{ approvalStatus: "revoked", _creationTime: 1 },
				CUTOFF,
			),
		).toBe("revoked");
		expect(
			releaseApprovalDecision(
				{ approvalStatus: "pending", deletedAt: 5, _creationTime: 1 },
				CUTOFF,
			),
		).toBe("deleted");
		expect(
			releaseApprovalDecision(
				{ approvalStatus: "pending", _creationTime: CUTOFF },
				CUTOFF,
			),
		).toBe("new");
	});
});
