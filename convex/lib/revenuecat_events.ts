export type RevenueCatUserType = "free" | "paid";

// Owner-controlled server gate, independent of the web checkout flag.
// Keep off until canonical subscription application, identity and expiry are reviewed.
export const REVENUECAT_PROCESSING_ENABLED: boolean = false;

export type RevenueCatProductCatalog = Readonly<Record<string, {
  plan: "basic" | "pro" | "max";
  billingCycle: "monthly" | "annual";
}>>;

// No provider product IDs have been approved. This is server-owned, never payload data.
export const REVENUECAT_PRODUCT_CATALOG: RevenueCatProductCatalog = Object.freeze({});

type RevenueCatEventKind =
  | "purchase" | "renewal" | "product-change"
  | "uncancellation" | "cancellation" | "expiration";

type ParsedRevenueCatEvent = {
  eventId: string;
  eventAtMs: number;
  appUserId: string;
  productId: string;
  plan: "basic" | "pro" | "max";
  billingCycle: "monthly" | "annual";
  kind: RevenueCatEventKind;
  paidThroughMs: number;
};

const EVENT_KINDS: Readonly<Record<string, RevenueCatEventKind>> = {
  INITIAL_PURCHASE: "purchase",
  RENEWAL: "renewal",
  PRODUCT_CHANGE: "product-change",
  UNCANCELLATION: "uncancellation",
  CANCELLATION: "cancellation",
  EXPIRATION: "expiration",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256
    && value.trim() === value && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Normalize fields only; this does not establish identity or apply entitlements. */
export function parseRevenueCatEvent(
  input: unknown,
  catalog: RevenueCatProductCatalog,
): { ok: true; event: ParsedRevenueCatEvent } | {
  ok: false;
  reason: "malformed" | "unsupported-event" | "unmapped-product";
} {
  if (!isRecord(input) || !isRecord(input.event)) {
    return { ok: false, reason: "malformed" };
  }
  const event = input.event;
  if (!isIdentifier(event.type)) return { ok: false, reason: "malformed" };
  if (!Object.prototype.hasOwnProperty.call(EVENT_KINDS, event.type)) {
    return { ok: false, reason: "unsupported-event" };
  }
  if (!isIdentifier(event.id) || !isIdentifier(event.app_user_id)
    || !isIdentifier(event.product_id) || !isTimestamp(event.event_timestamp_ms)
    || !isTimestamp(event.expiration_at_ms)) {
    return { ok: false, reason: "malformed" };
  }
  if (!Object.prototype.hasOwnProperty.call(catalog, event.product_id)) {
    return { ok: false, reason: "unmapped-product" };
  }
  const product = catalog[event.product_id];
  if (!isRecord(product) || !["basic", "pro", "max"].includes(product.plan)
    || !["monthly", "annual"].includes(product.billingCycle)) {
    return { ok: false, reason: "unmapped-product" };
  }
  return {
    ok: true,
    event: {
      eventId: event.id,
      eventAtMs: event.event_timestamp_ms,
      appUserId: event.app_user_id,
      // PRODUCT_CHANGE can announce a deferred change: never grant new_product_id here.
      productId: event.product_id,
      plan: product.plan,
      billingCycle: product.billingCycle,
      kind: EVENT_KINDS[event.type],
      paidThroughMs: event.expiration_at_ms,
    },
  };
}

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
