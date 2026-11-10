/**
 * The "$1 trial" checkout link on the coming-soon page (Whop hosted checkout).
 *
 * Off by default. The link shows only when TEMPO_CHECKOUT_ENABLED is exactly "true" AND a Whop
 * plan id is set. With either missing, the page shows the waitlist only.
 */
type Env = Record<string, string | undefined>;

const PLAN_ID_SHAPE = /^plan_[A-Za-z0-9]+$/;

export function trialCheckoutUrl(env: Env = process.env): string | null {
  if (env.TEMPO_CHECKOUT_ENABLED?.trim() !== "true") {
    return null;
  }
  const planId = env.WHOP_PLAN_ID?.trim();
  if (!planId || !PLAN_ID_SHAPE.test(planId)) {
    return null;
  }
  return `https://whop.com/checkout/${planId}`;
}
