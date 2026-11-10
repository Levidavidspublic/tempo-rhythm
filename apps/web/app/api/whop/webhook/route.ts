import { createDocument, FirestoreError, type FirestoreFields } from "@/lib/server/firestore";
import { GcpAuthError, readGcpConfig } from "@/lib/server/gcp-access-token";
import { logServerProblem } from "@/lib/server/log";
import { mapWhopEvent, membershipEventsCollection, verifyWhopSignature } from "@/lib/whop-webhook";

/**
 * POST /api/whop/webhook — Whop tells us when a membership (the $1 trial) starts or changes.
 * The signature is the only thing that authenticates this request; see lib/whop-webhook.ts.
 *
 * Each event is stored as its own Firestore document,
 * `whopMemberships/{membership id}/events/{event id}`, and never overwritten: Whop may deliver
 * events out of order or more than once. A repeat of the same event is a no-op. The membership's
 * current state ("trialing", "active", "canceled", ...) is the event with the latest
 * `eventTimestamp`.
 *
 * Answers 503 until WHOP_WEBHOOK_SECRET is set, so Whop retries instead of losing events.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

/** JSON answer that is never cached. */
function reply(
  body: { received: boolean; handled?: boolean; reason?: string },
  status: number
): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Handles one Whop delivery: checks the signature, then stores the membership event. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    return reply({ received: false, reason: "not_configured" }, 503);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return reply({ received: false, reason: "too_large" }, 413);
  }
  const headers = {
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
  };
  if (!(await verifyWhopSignature(headers, raw, secret))) {
    return reply({ received: false, reason: "bad_signature" }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ received: false, reason: "invalid" }, 400);
  }
  const event = mapWhopEvent(body, headers);
  if (!event) {
    return reply({ received: true, handled: false }, 200);
  }

  const config = readGcpConfig();
  if (!config) {
    logServerProblem("whop webhook", "storage is not configured");
    return reply({ received: false, reason: "not_configured" }, 503);
  }
  const fields: FirestoreFields = {
    membershipId: { stringValue: event.membershipId },
    status: { stringValue: event.status },
    planId: event.planId ? { stringValue: event.planId } : { nullValue: null },
    productId: event.productId ? { stringValue: event.productId } : { nullValue: null },
    whopUserId: event.whopUserId ? { stringValue: event.whopUserId } : { nullValue: null },
    cancelAtPeriodEnd: { booleanValue: event.cancelAtPeriodEnd },
    eventType: { stringValue: event.eventType },
    eventTimestamp: { timestampValue: event.eventTimestamp },
    receivedAt: { timestampValue: new Date().toISOString() },
  };
  try {
    // "exists" means Whop sent this event before: already stored, nothing to do.
    await createDocument(
      config,
      membershipEventsCollection(event.membershipId),
      event.eventId,
      fields
    );
    return reply({ received: true, handled: true }, 200);
  } catch (error) {
    if (error instanceof GcpAuthError) {
      logServerProblem(
        "whop webhook",
        `keyless auth stopped at ${error.step} (status ${error.status}) ${error.detail}`
      );
    } else if (error instanceof FirestoreError) {
      logServerProblem("whop webhook", `Firestore answered ${error.status} ${error.detail}`);
    } else {
      logServerProblem(
        "whop webhook",
        `write did not complete (${error instanceof Error ? error.name : "unknown"})`
      );
    }
    return reply({ received: false, reason: "unavailable" }, 502);
  }
}
