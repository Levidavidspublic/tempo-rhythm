import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  mapRevenueCatEventToUserType,
  parseRevenueCatEvent,
  REVENUECAT_PRODUCT_CATALOG,
  REVENUECAT_PROCESSING_ENABLED,
  revenueCatIngressDecision,
} from "./lib/revenuecat_events";

/**
 * RevenueCat webhook handler.
 * Endpoint: POST /api/revenuecat-webhook
 *
 * Processing is off: authenticated deliveries receive a disabled response
 * before their event body is read or any account is changed.
 *
 * Security: Validates the Authorization header against REVENUECAT_WEBHOOK_SECRET.
 * Set this env var in each Convex deployment's environment variables.
 */
export const revenueCatWebhook = httpAction(async (ctx, request) => {
  // Validate authorization header
  const authHeader = request.headers.get("Authorization");
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const ingress = revenueCatIngressDecision({
    authorization: authHeader,
    configuredSecret: webhookSecret,
    processingEnabled: REVENUECAT_PROCESSING_ENABLED,
  });

  if (ingress === "not_configured") {
    console.error("[RevenueCat Webhook] REVENUECAT_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }

  if (ingress === "unauthorized") {
    return new Response("Unauthorized", { status: 401 });
  }

  if (ingress === "disabled") {
    return new Response(JSON.stringify({ received: false, reason: "payments_disabled" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const parsed = parseRevenueCatEvent(body, REVENUECAT_PRODUCT_CATALOG);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ received: false, reason: parsed.reason }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = {
    purchase: "INITIAL_PURCHASE",
    renewal: "RENEWAL",
    "product-change": "PRODUCT_CHANGE",
    uncancellation: "UNCANCELLATION",
    cancellation: "CANCELLATION",
    expiration: "EXPIRATION",
  }[parsed.event.kind];
  // Legacy application remains unreachable with the gate off and catalog empty.
  // Canonical identity, expiry, cancellation and replay handling still need review.
  const userType = mapRevenueCatEventToUserType(eventType);

  try {
    await ctx.runMutation(internal.users.updateSubscriptionStatus, {
      userId: parsed.event.appUserId,
      userType,
      activeEntitlements: [],
      revenueCatEvent: eventType,
    });
  } catch {
    console.error("[RevenueCat Webhook] Account update unavailable");
    // Return 200 so RevenueCat doesn't retry on our internal errors
  }

  return new Response(JSON.stringify({ received: true, eventType }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
