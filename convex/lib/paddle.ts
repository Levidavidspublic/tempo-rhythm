/**
 * Paddle (sandbox) webhook helpers. Pure functions so they can be unit tested.
 * Refs #1336, #1335 (sandbox price IDs), #1208 (tiers).
 */

export type PaddlePlan = "trial" | "basic" | "pro" | "max";
export type PaddleCycle = "monthly" | "annual";

/** Paddle SANDBOX price IDs from #1335. Live IDs are not mapped here on purpose. */
export const PADDLE_SANDBOX_PRICES: Record<string, { plan: PaddlePlan; cycle: PaddleCycle }> = {
  pri_01m65qv7fqmd1sp38dwme7z0ze: { plan: "trial", cycle: "monthly" },
  pri_01m65qv7rxpk62a8842j1kva5d: { plan: "basic", cycle: "monthly" },
  pri_01m65qv7wck94rpjygnmqy0za1: { plan: "basic", cycle: "annual" },
  pri_01m65qv82hw595ndd0yckqbqkb: { plan: "pro", cycle: "monthly" },
  pri_01m65qv85arr2xy4s17zjpgybg: { plan: "pro", cycle: "annual" },
  pri_01m65qv8dvkesf0f794zmv2k4d: { plan: "max", cycle: "monthly" },
  pri_01m65qv8hxqbspvnq41n44ap4v: { plan: "max", cycle: "annual" },
};

export function mapPriceToTier(priceId: string | undefined) {
  return priceId ? PADDLE_SANDBOX_PRICES[priceId] ?? null : null;
}

export function parsePaddleSignature(header: string | null): { ts: string; h1: string[] } | null {
  if (!header) return null;
  let ts = "";
  const h1: string[] = [];
  for (const part of header.split(";")) {
    const [k, v] = part.split("=", 2).map((s) => s?.trim());
    if (k === "ts" && v) ts = v;
    if (k === "h1" && v) h1.push(v);
  }
  return ts && h1.length ? { ts, h1 } : null;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Verifies Paddle-Signature (ts=...;h1=HMAC_SHA256(secret, `${ts}:${rawBody}`)). */
export async function verifyPaddleSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): Promise<boolean> {
  const parsed = parsePaddleSignature(header);
  if (!parsed) return false;
  const ts = Number(parsed.ts);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${parsed.ts}:${rawBody}`);
  return parsed.h1.some((h) => safeEqual(h, expected));
}

export const HANDLED_EVENTS = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "transaction.completed",
] as const;

export type PaddleUpdate = {
  userId: string;
  plan: PaddlePlan | "none";
  billingCycle: PaddleCycle | "none";
  status: "active" | "grace" | "cancelled" | "inactive";
  eventType: string;
};

/** Maps a Paddle event to a subscription state update, or null when ignored. */
export function mapPaddleEvent(body: any): PaddleUpdate | null {
  const eventType: string | undefined = body?.event_type;
  if (!eventType || !(HANDLED_EVENTS as readonly string[]).includes(eventType)) return null;
  const data = body.data ?? {};
  const userId: string | undefined = data.custom_data?.userId;
  if (!userId) return null;
  const priceId: string | undefined = data.items?.[0]?.price?.id ?? data.items?.[0]?.price_id;
  const tier = mapPriceToTier(priceId);
  if (eventType === "subscription.canceled") {
    return { userId, plan: tier?.plan ?? "none", billingCycle: tier?.cycle ?? "none", status: "cancelled", eventType };
  }
  if (!tier) return null;
  let status: PaddleUpdate["status"] = "active";
  if (eventType === "subscription.updated" || eventType === "subscription.created") {
    const s = data.status;
    if (s === "past_due") status = "grace";
    else if (s === "canceled") status = "cancelled";
    else if (s === "paused") status = "inactive";
  }
  return { userId, plan: tier.plan, billingCycle: tier.cycle, status, eventType };
}
