export type RevenueCatUserType = "free" | "paid";

// Owner-controlled server gate, independent of the web checkout flag.
// Keep off until canonical subscription application, identity and expiry are reviewed.
export const REVENUECAT_PROCESSING_ENABLED: boolean = false;

/** Validate ingress only; this does not validate an event or authorize activation. */
export function revenueCatIngressDecision(input: {
  authorization: string | null;
  configuredSecret: string | undefined;
  processingEnabled: boolean;
}): "not_configured" | "unauthorized" | "disabled" | "continue" {
  if (!input.configuredSecret) return "not_configured";
  if (input.authorization !== input.configuredSecret) return "unauthorized";
  if (!input.processingEnabled) return "disabled";
  return "continue";
}

const PAID_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
]);

const FREE_EVENT_TYPES = new Set([
  "EXPIRATION",
  "CANCELLATION",
  "SUBSCRIBER_ALIAS",
]);

/**
 * Map a RevenueCat webhook event type to the Convex userType tier.
 * Unknown event types default to "free" (no upgrade).
 */
export function mapRevenueCatEventToUserType(
  eventType: string | undefined,
): RevenueCatUserType {
  if (!eventType) return "free";
  if (PAID_EVENT_TYPES.has(eventType)) return "paid";
  if (FREE_EVENT_TYPES.has(eventType)) return "free";
  return "free";
}
