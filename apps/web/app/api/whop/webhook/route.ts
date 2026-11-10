import { FirestoreError, type FirestoreFields, setDocumentFields } from "@/lib/server/firestore";
import { logServerProblem } from "@/lib/server/log";
import { GcpAuthError, readGcpConfig } from "@/lib/server/gcp-access-token";
import { mapWhopEvent, verifyWhopSignature, WHOP_MEMBERSHIP_COLLECTION } from "@/lib/whop-webhook";

/**
 * POST /api/whop/webhook — Whop tells us when a membership (the $1 trial) starts or changes.
 * The signature is the only thing that authenticates this request; see lib/whop-webhook.ts.
 * Stores one document per membership in Firestore: status "trialing", "active", "canceled", ...
 * Answers 503 until WHOP_WEBHOOK_SECRET is set, so Whop retries instead of losing events.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

function reply(
  body: { received: boolean; handled?: boolean; reason?: string },
  status: number
): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    return reply({ received: false, reason: "not_configured" }, 503);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return reply({ received: false, reason: "too_large" }, 413);
  }
  const verified = await verifyWhopSignature(
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    raw,
    secret
  );
  if (!verified) {
    return reply({ received: false, reason: "bad_signature" }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply({ received: false, reason: "invalid" }, 400);
  }
  const record = mapWhopEvent(body);
  if (!record) {
    return reply({ received: true, handled: false }, 200);
  }

  const config = readGcpConfig();
  if (!config) {
    logServerProblem("whop webhook", "storage is not configured");
    return reply({ received: false, reason: "not_configured" }, 503);
  }
  const fields: FirestoreFields = {
    status: { stringValue: record.status },
    planId: record.planId ? { stringValue: record.planId } : { nullValue: null },
    productId: record.productId ? { stringValue: record.productId } : { nullValue: null },
    whopUserId: record.whopUserId ? { stringValue: record.whopUserId } : { nullValue: null },
    cancelAtPeriodEnd: { booleanValue: record.cancelAtPeriodEnd },
    lastEventType: { stringValue: record.eventType },
    lastEventId: record.eventId ? { stringValue: record.eventId } : { nullValue: null },
    updatedAt: { timestampValue: new Date().toISOString() },
  };
  try {
    await setDocumentFields(config, WHOP_MEMBERSHIP_COLLECTION, record.membershipId, fields);
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
      logServerProblem("whop webhook", "write did not complete");
    }
    return reply({ received: false, reason: "unavailable" }, 502);
  }
}
