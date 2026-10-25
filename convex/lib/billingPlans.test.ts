import { describe, expect, test } from "bun:test";
import {
	capsFor,
	NAME_TBD,
	paymentsEnabled,
	statusFromPaddle,
	TEMPO_PLANS,
	tierFromPriceId,
} from "./billingPlans";
import { signPaddle, verifyPaddle } from "./paddleSignature";

describe("TEMPO_PLANS", () => {
	test("two paid tiers at $20 and $50 with placeholder names", () => {
		const paid = TEMPO_PLANS.filter((p) => p.priceCentsMonthly > 0);
		expect(paid.map((p) => p.priceCentsMonthly)).toEqual([2000, 5000]);
		expect(paid.every((p) => p.name === NAME_TBD)).toBe(true);
	});
	test("caps fall back to free unless active or grace", () => {
		expect(capsFor("tier_50", "cancelled")).toEqual(TEMPO_PLANS[0]!.caps);
		expect(capsFor("tier_50", "active")).toEqual(TEMPO_PLANS[2]!.caps);
		expect(capsFor("nope", "active")).toEqual(TEMPO_PLANS[0]!.caps);
	});
	test("price id mapping and status mapping", () => {
		expect(tierFromPriceId("pri_a", { tier20: "pri_a", tier50: "pri_b" })).toBe(
			"tier_20",
		);
		expect(tierFromPriceId("pri_x", { tier20: "pri_a" })).toBeUndefined();
		expect(statusFromPaddle("past_due")).toBe("grace");
		expect(statusFromPaddle("weird")).toBe("inactive");
	});
	test("payments switch is off unless exactly 'true'", () => {
		expect(paymentsEnabled(undefined)).toBe(false);
		expect(paymentsEnabled("1")).toBe(false);
		expect(paymentsEnabled("true")).toBe(true);
	});
});

describe("verifyPaddle", () => {
	const secret = "pdl_ntfset_test_secret";
	const body = '{"event_id":"evt_1","event_type":"subscription.created"}';
	test("accepts a correct signature", async () => {
		const now = 1_700_000_000;
		const h = await signPaddle(body, secret, now);
		expect(await verifyPaddle(body, h, secret, now * 1000)).toBe(true);
	});
	test("rejects a tampered body, wrong secret, missing header", async () => {
		const now = 1_700_000_000;
		const h = await signPaddle(body, secret, now);
		expect(await verifyPaddle(body + " ", h, secret, now * 1000)).toBe(false);
		expect(await verifyPaddle(body, h, "other", now * 1000)).toBe(false);
		expect(await verifyPaddle(body, null, secret, now * 1000)).toBe(false);
	});
	test("rejects a stale timestamp (replay)", async () => {
		const now = 1_700_000_000;
		const h = await signPaddle(body, secret, now);
		expect(await verifyPaddle(body, h, secret, (now + 3600) * 1000)).toBe(
			false,
		);
	});
});
