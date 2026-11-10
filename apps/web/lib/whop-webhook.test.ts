import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mapWhopEvent, signWhopPayload, verifyWhopSignature } from "./whop-webhook";

const secret = "ws_test_only_not_a_real_secret";
const now = 1_800_000_000;
const body = '{"type":"membership.activated"}';
const headers = (signature: string, timestamp = String(now)) => ({
  id: "msg_1",
  timestamp,
  signature,
});

describe("whop signature", () => {
  test("matches HMAC-SHA256 over id.timestamp.body with the whole secret, base64", async () => {
    const expected = createHmac("sha256", secret).update(`msg_1.${now}.${body}`).digest("base64");
    expect(await signWhopPayload(secret, "msg_1", String(now), body)).toBe(expected);
    expect(await verifyWhopSignature(headers(`v1,${expected}`), body, secret, now)).toBe(true);
  });

  test("accepts one good signature among several", async () => {
    const good = await signWhopPayload(secret, "msg_1", String(now), body);
    expect(await verifyWhopSignature(headers(`v1,AAAA v1,${good}`), body, secret, now)).toBe(true);
  });

  test("rejects a changed body, a wrong secret, a wrong version and missing headers", async () => {
    const good = await signWhopPayload(secret, "msg_1", String(now), body);
    expect(await verifyWhopSignature(headers(`v1,${good}`), `${body} `, secret, now)).toBe(false);
    expect(await verifyWhopSignature(headers(`v1,${good}`), body, "ws_other", now)).toBe(false);
    expect(await verifyWhopSignature(headers(`v2,${good}`), body, secret, now)).toBe(false);
    expect(
      await verifyWhopSignature(
        { id: null, timestamp: String(now), signature: `v1,${good}` },
        body,
        secret,
        now
      )
    ).toBe(false);
    expect(await verifyWhopSignature(headers(`v1,${good}`), body, "", now)).toBe(false);
  });

  test("rejects a timestamp more than 5 minutes away, either way", async () => {
    for (const offset of [-301, 301]) {
      const timestamp = String(now + offset);
      const signature = await signWhopPayload(secret, "msg_1", timestamp, body);
      expect(
        await verifyWhopSignature(headers(`v1,${signature}`, timestamp), body, secret, now)
      ).toBe(false);
    }
    const timestamp = String(now - 299);
    const signature = await signWhopPayload(secret, "msg_1", timestamp, body);
    expect(
      await verifyWhopSignature(headers(`v1,${signature}`, timestamp), body, secret, now)
    ).toBe(true);
  });
});

describe("whop event mapping", () => {
  const event = (type: string, data: Record<string, unknown>) => ({ id: "evt_1", type, data });

  test("keeps a trial start", () => {
    expect(
      mapWhopEvent(
        event("membership.activated", {
          id: "mem_1",
          status: "trialing",
          variant_id: "plan_a",
          product_id: "prod_a",
          user_id: "user_a",
        })
      )
    ).toEqual({
      membershipId: "mem_1",
      status: "trialing",
      planId: "plan_a",
      productId: "prod_a",
      whopUserId: "user_a",
      cancelAtPeriodEnd: false,
      eventId: "evt_1",
      eventType: "membership.activated",
    });
  });

  test("reads plan_id on older payloads and the cancel flag", () => {
    const record = mapWhopEvent(
      event("membership.updated", {
        id: "mem_1",
        status: "canceled",
        plan_id: "plan_old",
        cancel_at_period_end: true,
      })
    );
    expect(record?.planId).toBe("plan_old");
    expect(record?.status).toBe("canceled");
    expect(record?.cancelAtPeriodEnd).toBe(true);
  });

  test("ignores other events, unknown statuses and unsafe ids", () => {
    expect(mapWhopEvent(event("payment.succeeded", { id: "pay_1", status: "paid" }))).toBeNull();
    expect(
      mapWhopEvent(event("membership.updated", { id: "mem_1", status: "drafted" }))
    ).toBeNull();
    expect(mapWhopEvent(event("membership.updated", { id: "a/b", status: "active" }))).toBeNull();
    expect(mapWhopEvent(event("membership.updated", { status: "active" }))).toBeNull();
    expect(mapWhopEvent(null)).toBeNull();
    expect(mapWhopEvent({ type: "membership.updated" })).toBeNull();
  });
});
