/**
 * Checkout destinations for the Vercel Preview alpha and the coming-soon surface.
 */
type Env = Record<string, string | undefined>;

const PLAN_ID_SHAPE = /^plan_[A-Za-z0-9]+$/;
const PAYPAL_PAYMENT_LINK_ID_SHAPE = /^(?:PLB-)?[A-Z0-9]{12,32}$/;
const PAYPAL_SANDBOX_PAYMENT_LINK = "https://www.sandbox.paypal.com/ncp/payment/";

/** The Whop trial link, gated by the existing flag and plan ID. */
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

/** Redirects preview checkout to a preconfigured PayPal Sandbox payment link. */
export function paypalSandboxCheckout(env: Env = process.env): Response {
  const paymentLinkId = env.PAYPAL_SANDBOX_PAYMENT_LINK_ID?.trim();
  const headers = { "cache-control": "no-store" };
  if (
    env.VERCEL_ENV !== "preview" ||
    env.TEMPO_PAYPAL_SANDBOX_ENABLED !== "true" ||
    !paymentLinkId ||
    !PAYPAL_PAYMENT_LINK_ID_SHAPE.test(paymentLinkId)
  ) {
    return new Response("Not found", { status: 404, headers });
  }

  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      location: `${PAYPAL_SANDBOX_PAYMENT_LINK}${paymentLinkId}`,
      "referrer-policy": "no-referrer",
    },
  });
}
