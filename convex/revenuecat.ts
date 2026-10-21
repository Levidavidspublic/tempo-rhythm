import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  mapRevenueCatEventToUserType,
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) {
    return new Response("Missing event field", { status: 400 });
  }

  const eventType = event.type as string | undefined;
  const appUserId = event.app_user_id as string | undefined;

  // Determine new user tier from entitlements
  // RevenueCat sends entitlement identifiers in the event
  const activeEntitlements = (event.entitlement_ids as string[] | undefined) ?? [];

  const userType = mapRevenueCatEventToUserType(eventType);

  if (appUserId) {
    try {
      await ctx.runMutation(internal.users.updateSubscriptionStatus, {
        userId: appUserId,
        userType,
        activeEntitlements,
        revenueCatEvent: eventType ?? "UNKNOWN",
      });
    } catch (err) {
      console.error("[RevenueCat Webhook] Failed to update user:", err);
      // Return 200 so RevenueCat doesn't retry on our internal errors
    }
  }

  return new Response(JSON.stringify({ received: true, eventType }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
