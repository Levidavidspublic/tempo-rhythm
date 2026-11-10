import { createDocument, FirestoreError } from "@/lib/server/firestore";
import { logServerProblem } from "@/lib/server/log";
import { readBodyLimited } from "@/lib/server/read-body";
import { GcpAuthError, missingGcpEnv, readGcpConfig } from "@/lib/server/gcp-access-token";
import {
  createRateLimiter,
  isSameOrigin,
  MAX_BODY_BYTES,
  parseWaitlistBody,
  WAITLIST_COLLECTION,
  waitlistDocumentId,
} from "@/lib/waitlist";

/**
 * POST /api/waitlist — the coming-soon join form.
 * Writes one document per email to Firestore from the server (keyless, see lib/server).
 * Public route. It never says whether an email was already on the list.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allow = createRateLimiter(5, 10 * 60_000);

/** JSON answer that is never cached. */
function json(body: { ok: boolean; reason?: string }, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Handles one join: checks the request, then writes the email to Firestore. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return json({ ok: false, reason: "forbidden" }, 403);
  }
  const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(visitor, Date.now())) {
    return json({ ok: false, reason: "slow_down" }, 429);
  }

  const raw = await readBodyLimited(request, MAX_BODY_BYTES);
  if (raw === null) {
    return json({ ok: false, reason: "invalid" }, 400);
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, reason: "invalid" }, 400);
  }
  const input = parseWaitlistBody(body);
  if (input.kind === "invalid") {
    return json({ ok: false, reason: "invalid" }, 400);
  }
  if (input.kind === "ignore") {
    return json({ ok: true }, 200);
  }

  const config = readGcpConfig();
  if (!config) {
    // Names only: says which settings are missing, never a value.
    logServerProblem("waitlist", `not configured; missing: ${missingGcpEnv().join(", ")}`);
    return json({ ok: false, reason: "not_configured" }, 503);
  }

  try {
    await createDocument(config, WAITLIST_COLLECTION, await waitlistDocumentId(input.email), {
      email: { stringValue: input.email },
      source: { stringValue: "coming-soon" },
      createdAt: { timestampValue: new Date().toISOString() },
    });
    return json({ ok: true }, 200);
  } catch (error) {
    if (error instanceof GcpAuthError) {
      logServerProblem(
        "waitlist",
        `keyless auth stopped at ${error.step} (status ${error.status}) ${error.detail}`
      );
    } else if (error instanceof FirestoreError) {
      logServerProblem("waitlist", `Firestore answered ${error.status} ${error.detail}`);
    } else {
      logServerProblem(
        "waitlist",
        `write did not complete (${error instanceof Error ? error.name : "unknown"})`
      );
    }
    return json({ ok: false, reason: "unavailable" }, 502);
  }
}
