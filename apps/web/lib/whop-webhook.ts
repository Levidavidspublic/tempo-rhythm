/**
 * Whop webhook rules: signature check and what we keep from an event. Pure, so it can be tested.
 *
 * From Whop's webhook guide (https://docs.whop.com/developer/guides/webhooks):
 * - headers `webhook-id`, `webhook-timestamp` (Unix seconds), `webhook-signature`;
 * - Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256;
 * - the key is the whole `ws_...` secret as given (prefix kept, not base64-decoded);
 * - the signature is base64, sent as `v1,<signature>`; the header may hold several, space-separated;
 * - a timestamp more than 5 minutes from now is rejected.
 */
export const WHOP_TOLERANCE_SECONDS = 5 * 60;
export const WHOP_MEMBERSHIP_COLLECTION = "whopMemberships";

export type WhopHeaders = { id: string | null; timestamp: string | null; signature: string | null };

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signWhopPayload(
  secret: string,
  id: string,
  timestamp: string,
  rawBody: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${id}.${timestamp}.${rawBody}`)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function verifyWhopSignature(
  headers: WhopHeaders,
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }
  const sentAt = Number(headers.timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > WHOP_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = await signWhopPayload(secret, headers.id, headers.timestamp, rawBody);
  return headers.signature
    .split(" ")
    .map((entry) => entry.split(","))
    .some(
      ([version, value]) =>
        version === "v1" && typeof value === "string" && timingSafeEqual(value, expected)
    );
}

/** Membership statuses Whop documents. "trialing" is the $1 trial. */
export const WHOP_MEMBERSHIP_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "completed",
  "canceled",
  "expired",
  "unresolved",
] as const;
export type WhopMembershipStatus = (typeof WHOP_MEMBERSHIP_STATUSES)[number];

const HANDLED_TYPES = new Set([
  "membership.activated",
  "membership.updated",
  "membership.deactivated",
]);
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * One membership event, as we store it. Whop does not guarantee delivery order and may deliver an
 * event more than once (https://docs.whop.com/developer/guides/webhooks, "Delivery"), so events
 * are never merged into one "current" document. Each event is its own document, keyed by Whop's
 * event id: a repeat lands on the same document, and a late older event cannot replace a newer
 * one. The membership's current state is the event with the latest `eventTimestamp`.
 */
export type MembershipEvent = {
  membershipId: string;
  /** Whop's id for this event (`webhook-id`): the same on every retry of the same event. */
  eventId: string;
  /** When Whop created the event (ISO 8601), not when it reached us. */
  eventTimestamp: string;
  eventType: string;
  status: WhopMembershipStatus;
  planId: string | null;
  productId: string | null;
  whopUserId: string | null;
  cancelAtPeriodEnd: boolean;
};

/** Where one event is stored: `whopMemberships/{membershipId}/events/{eventId}`. */
export function membershipEventsCollection(membershipId: string): string {
  return `${WHOP_MEMBERSHIP_COLLECTION}/${membershipId}/events`;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** The event's own time: the envelope's ISO `timestamp`, else the signed `webhook-timestamp` header. */
function eventTime(bodyTimestamp: unknown, headerTimestamp: string | null): string | null {
  const fromBody = text(bodyTimestamp);
  if (fromBody && Number.isFinite(Date.parse(fromBody))) {
    return new Date(fromBody).toISOString();
  }
  const seconds = Number(headerTimestamp);
  if (headerTimestamp && Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000).toISOString();
  }
  return null;
}

/**
 * Maps a verified Whop request to the membership event we store, or null when it is not one we
 * keep. Reads only documented fields. The plan id is `variant_id` on current payloads and
 * `plan_id` on webhooks pinned before 2026-10-27.
 */
export function mapWhopEvent(
  body: unknown,
  headers: Pick<WhopHeaders, "id" | "timestamp">
): MembershipEvent | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const event = body as { id?: unknown; type?: unknown; timestamp?: unknown; data?: unknown };
  const eventType = text(event.type);
  if (
    !eventType ||
    !HANDLED_TYPES.has(eventType) ||
    !event.data ||
    typeof event.data !== "object"
  ) {
    return null;
  }
  const data = event.data as Record<string, unknown>;
  const membershipId = text(data.id);
  const status = text(data.status) as WhopMembershipStatus | null;
  const eventId = text(headers.id) ?? text(event.id);
  const eventTimestamp = eventTime(event.timestamp, headers.timestamp);
  if (
    !membershipId ||
    !SAFE_ID.test(membershipId) ||
    !eventId ||
    !SAFE_ID.test(eventId) ||
    !eventTimestamp ||
    !status ||
    !WHOP_MEMBERSHIP_STATUSES.includes(status)
  ) {
    return null;
  }
  return {
    membershipId,
    eventId,
    eventTimestamp,
    eventType,
    status,
    planId: text(data.variant_id) ?? text(data.plan_id),
    productId: text(data.product_id),
    whopUserId: text(data.user_id),
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
  };
}
