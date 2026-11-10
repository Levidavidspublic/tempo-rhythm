/**
 * Waitlist rules shared by the API route and its tests. Pure: no network, no clock of its own.
 */
export const WAITLIST_COLLECTION = "waitlist";
export const MAX_EMAIL_LENGTH = 254;
export const MAX_BODY_BYTES = 2048;

// One "@", something on both sides, a dot in the domain, no spaces. The address is proven later
// by the one email we send, not here.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WaitlistInput =
  | { kind: "join"; email: string }
  | { kind: "ignore" }
  | { kind: "invalid" };

/** Reads the posted JSON. A filled "company" field means a form-filling script: accept and drop. */
export function parseWaitlistBody(body: unknown): WaitlistInput {
  if (!body || typeof body !== "object") {
    return { kind: "invalid" };
  }
  const { email, company } = body as { email?: unknown; company?: unknown };
  if (typeof company === "string" && company.trim() !== "") {
    return { kind: "ignore" };
  }
  if (typeof email !== "string") {
    return { kind: "invalid" };
  }
  const normalised = email.trim().toLowerCase();
  if (
    normalised.length === 0 ||
    normalised.length > MAX_EMAIL_LENGTH ||
    !EMAIL_SHAPE.test(normalised)
  ) {
    return { kind: "invalid" };
  }
  return { kind: "join", email: normalised };
}

/** Document id: SHA-256 of the normalised email, so joining twice is the same document. */
export async function waitlistDocumentId(email: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A browser form post comes from our own page: when Origin is sent it must match the host. */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) {
    return true;
  }
  if (!host) {
    return false;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Best-effort limiter kept in one function instance's memory. Not a guarantee across instances. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now: number): boolean {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) {
      hits.clear();
    }
    return true;
  };
}
