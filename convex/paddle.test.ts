import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mapPaddleEvent, mapPriceToTier, verifyPaddleSignature } from "./lib/paddle";

const secret = "test_secret";
const sign = (ts: number, body: string) => `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;

describe("paddle signature", () => {
  const body = '{"event_type":"x"}';
  const now = 1_700_000_000;
  test("valid", async () => expect(await verifyPaddleSignature(sign(now, body), body, secret, now)).toBe(true));
  test("tampered body", async () => expect(await verifyPaddleSignature(sign(now, body), body + " ", secret, now)).toBe(false));
  test("stale ts", async () => expect(await verifyPaddleSignature(sign(now - 1000, body), body, secret, now)).toBe(false));
  test("missing header", async () => expect(await verifyPaddleSignature(null, body, secret, now)).toBe(false));
});

describe("paddle mapping", () => {
  test("price to tier", () => {
    expect(mapPriceToTier("pri_01m65qv85arr2xy4s17zjpgybg")).toEqual({ plan: "pro", cycle: "annual" });
    expect(mapPriceToTier("pri_unknown")).toBeNull();
  });
  const ev = (event_type: string, extra: object = {}) => ({
    event_type,
    data: { custom_data: { userId: "u1" }, items: [{ price: { id: "pri_01m65qv8dvkesf0f794zmv2k4d" } }], ...extra },
  });
  test("created", () => expect(mapPaddleEvent(ev("subscription.created", { status: "active" }))).toMatchObject({ plan: "max", billingCycle: "monthly", status: "active" }));
  test("updated past_due", () => expect(mapPaddleEvent(ev("subscription.updated", { status: "past_due" }))?.status).toBe("grace"));
  test("canceled", () => expect(mapPaddleEvent(ev("subscription.canceled"))?.status).toBe("cancelled"));
  test("transaction completed", () => expect(mapPaddleEvent(ev("transaction.completed"))?.status).toBe("active"));
  test("ignored event", () => expect(mapPaddleEvent(ev("customer.created"))).toBeNull());
  test("no userId", () => expect(mapPaddleEvent({ event_type: "subscription.created", data: {} })).toBeNull());
});
