import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import {
  mapWhopEvent,
  membershipEventsCollection,
  signWhopPayload,
  verifyWhopSignature,
} from "./whop-webhook";

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
  const sent = { id: "msg_1", timestamp: "1786381404" };
  /** A Whop event envelope of the given type around `data`. */
  const event = (type: string, data: Record<string, unknown>, timestamp?: string) => ({
    id: "msg_1",
    type,
    timestamp,
    data,
  });

  test("keeps a trial start with Whop's event id and the event's own time", () => {
    expect(
      mapWhopEvent(
        event(
          "membership.activated",
          {
            id: "mem_1",
            status: "trialing",
            variant_id: "plan_a",
            product_id: "prod_a",
            user_id: "user_a",
          },
          "2026-08-10T17:03:24.291Z"
        ),
        sent
      )
    ).toEqual({
      membershipId: "mem_1",
      eventId: "msg_1",
      eventTimestamp: "2026-08-10T17:03:24.291Z",
      eventType: "membership.activated",
      status: "trialing",
      planId: "plan_a",
      productId: "prod_a",
      whopUserId: "user_a",
      cancelAtPeriodEnd: false,
    });
  });

  test("a late older event and a newer one are separate documents with their own times", () => {
    const cancelled = mapWhopEvent(
      event("membership.updated", { id: "mem_1", status: "canceled" }, "2026-08-12T09:00:00.000Z"),
      { id: "msg_new", timestamp: "1786525200" }
    );
    const lateStart = mapWhopEvent(
      event(
        "membership.activated",
        { id: "mem_1", status: "trialing" },
        "2026-08-10T17:03:24.291Z"
      ),
      { id: "msg_old", timestamp: "1786381404" }
    );
    expect(cancelled?.eventId).toBe("msg_new");
    expect(lateStart?.eventId).toBe("msg_old");
    expect(membershipEventsCollection("mem_1")).toBe("whopMemberships/mem_1/events");
    // Whichever arrives last, the newest by event time is still the cancellation.
    const newest = [lateStart, cancelled].sort((a, b) =>
      (b?.eventTimestamp ?? "").localeCompare(a?.eventTimestamp ?? "")
    )[0];
    expect(newest?.status).toBe("canceled");
  });

  test("falls back to the signed header time when the body has none", () => {
    const record = mapWhopEvent(
      event("membership.updated", { id: "mem_1", status: "active" }),
      sent
    );
    expect(record?.eventTimestamp).toBe(new Date(1786381404 * 1000).toISOString());
  });

  test("reads plan_id on older payloads and the cancel flag", () => {
    const record = mapWhopEvent(
      event("membership.updated", {
        id: "mem_1",
        status: "canceled",
        plan_id: "plan_old",
        cancel_at_period_end: true,
      }),
      sent
    );
    expect(record?.planId).toBe("plan_old");
    expect(record?.status).toBe("canceled");
    expect(record?.cancelAtPeriodEnd).toBe(true);
  });

  test("ignores other events, unknown statuses, unsafe ids and events with no id or time", () => {
    expect(
      mapWhopEvent(event("payment.succeeded", { id: "pay_1", status: "paid" }), sent)
    ).toBeNull();
    expect(
      mapWhopEvent(event("membership.updated", { id: "mem_1", status: "drafted" }), sent)
    ).toBeNull();
    expect(
      mapWhopEvent(event("membership.updated", { id: "a/b", status: "active" }), sent)
    ).toBeNull();
    expect(mapWhopEvent(event("membership.updated", { status: "active" }), sent)).toBeNull();
    expect(
      mapWhopEvent(event("membership.updated", { id: "mem_1", status: "active" }), {
        id: "a/b",
        timestamp: "1786381404",
      })
    ).toBeNull();
    expect(
      mapWhopEvent(
        { type: "membership.updated", data: { id: "mem_1", status: "active" } },
        { id: null, timestamp: "1786381404" }
      )
    ).toBeNull();
    expect(
      mapWhopEvent(event("membership.updated", { id: "mem_1", status: "active" }), {
        id: "msg_1",
        timestamp: null,
      })
    ).toBeNull();
    expect(mapWhopEvent(null, sent)).toBeNull();
    expect(mapWhopEvent({ type: "membership.updated" }, sent)).toBeNull();
  });
});
