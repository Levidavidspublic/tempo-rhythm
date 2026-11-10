/**
 * The v3 price table and plan helpers (docs/design/v3/screens/web/billing.html, trial-end.html).
 * Read-only: nothing here starts a purchase or talks to a payment provider.
 * Trial $1 for 3 weeks; Basic $10, Pro $20, Max $40 a month; a year costs 10 months.
 */

export type TierId = "trial" | "basic" | "pro" | "max";
export type BillingInterval = "month" | "year";

export type Tier = {
  id: TierId;
  /** US dollars a month, or for the whole trial. */
  monthly: number;
  /** Live voice minutes a day, when the tier has live voice. */
  liveVoiceMinutes: number | null;
};

export const TIERS: readonly Tier[] = [
  { id: "trial", monthly: 1, liveVoiceMinutes: null },
  { id: "basic", monthly: 10, liveVoiceMinutes: null },
  { id: "pro", monthly: 20, liveVoiceMinutes: 90 },
  { id: "max", monthly: 40, liveVoiceMinutes: 180 },
];

/** Months charged for a year: two months free. */
export const MONTHS_PER_PAID_YEAR = 10;

export type TierPrice = { amount: number; per: "3w" | "month" | "year" };

export function tierPrice(tier: Tier, interval: BillingInterval): TierPrice {
  if (tier.id === "trial") return { amount: tier.monthly, per: "3w" };
  if (interval === "year") return { amount: tier.monthly * MONTHS_PER_PAID_YEAR, per: "year" };
  return { amount: tier.monthly, per: "month" };
}

/** "$10". Whole dollars only, as the design shows them. */
export function formatUsd(amount: number): string {
  return `$${Math.round(amount)}`;
}

/** The fields of `api.users.getMyPlan` these screens read. */
export type PlanSnapshot = {
  plan: "none" | "trial" | "basic" | "pro" | "max";
  status: "inactive" | "active" | "grace" | "cancelled";
  isBeta: boolean;
};

function isLive(plan: PlanSnapshot): boolean {
  return plan.status === "active" || plan.status === "grace";
}

/** People approved during early access have Max included. */
export function isEarlyAccess(plan: PlanSnapshot): boolean {
  return plan.isBeta;
}

/** The tier card that says "Your plan", or null when there is none. */
export function currentTier(plan: PlanSnapshot): TierId | null {
  if (isEarlyAccess(plan)) return "max";
  if (!isLive(plan) || plan.plan === "none") return null;
  return plan.plan;
}

/** On the $1 trial right now (early-access accounts never are). */
export function isOnTrial(plan: PlanSnapshot): boolean {
  return !isEarlyAccess(plan) && isLive(plan) && plan.plan === "trial";
}
