/**
 * Tempo Flow paid plan catalog (pure data, no Convex imports).
 * Prices are fixed by Amit: $20 and $50 a month. Names are placeholders.
 * Caps are placeholders until Amit sets them.
 */

export const PAYMENTS_SWITCH_ENV = "PAYMENTS_ENABLED";

export type TempoTierKey = "free" | "tier_20" | "tier_50";

export interface TierCaps {
	/** AI coach messages per day. */
	coachMessagesPerDay: number;
	/** Brain-dump parses per day. */
	brainDumpsPerDay: number;
	/** Connected tools through Executor. */
	connections: number;
	/** Stored memories. */
	memories: number;
}

export interface PlanDef {
	key: TempoTierKey;
	name: string;
	priceCentsMonthly: number;
	currency: "USD";
	caps: TierCaps;
	capsPlaceholder: boolean;
	sortOrder: number;
}

export const NAME_TBD = "NAME TBD (Amit)";

export const TEMPO_PLANS: readonly PlanDef[] = [
	{
		key: "free",
		name: "Free",
		priceCentsMonthly: 0,
		currency: "USD",
		caps: {
			coachMessagesPerDay: 10,
			brainDumpsPerDay: 3,
			connections: 1,
			memories: 50,
		},
		capsPlaceholder: true,
		sortOrder: 0,
	},
	{
		key: "tier_20",
		name: NAME_TBD,
		priceCentsMonthly: 2000,
		currency: "USD",
		caps: {
			coachMessagesPerDay: 100,
			brainDumpsPerDay: 30,
			connections: 5,
			memories: 1000,
		},
		capsPlaceholder: true,
		sortOrder: 1,
	},
	{
		key: "tier_50",
		name: NAME_TBD,
		priceCentsMonthly: 5000,
		currency: "USD",
		caps: {
			coachMessagesPerDay: 400,
			brainDumpsPerDay: 120,
			connections: 25,
			memories: 10000,
		},
		capsPlaceholder: true,
		sortOrder: 2,
	},
] as const;

export function planByKey(key: string): PlanDef | undefined {
	return TEMPO_PLANS.find((p) => p.key === key);
}

/** Caps for a user: paid tier only while status is active or grace, else free. */
export function capsFor(
	tierKey: string | undefined,
	status: string | undefined,
): TierCaps {
	const free = TEMPO_PLANS[0]!.caps;
	if (status !== "active" && status !== "grace") return free;
	return planByKey(tierKey ?? "")?.caps ?? free;
}

/** Map a provider price/product id to a tier using env-configured ids (never hard-coded). */
export function tierFromPriceId(
	priceId: string | undefined,
	env: { tier20?: string; tier50?: string },
): TempoTierKey | undefined {
	if (!priceId) return undefined;
	if (env.tier20 && priceId === env.tier20) return "tier_20";
	if (env.tier50 && priceId === env.tier50) return "tier_50";
	return undefined;
}

/** Paddle subscription status -> our subscription status. */
export function statusFromPaddle(
	s: string | undefined,
): "inactive" | "active" | "grace" | "cancelled" {
	switch (s) {
		case "active":
		case "trialing":
			return "active";
		case "past_due":
			return "grace";
		case "canceled":
			return "cancelled";
		default:
			return "inactive";
	}
}

export function paymentsEnabled(value: string | undefined): boolean {
	return value === "true";
}
