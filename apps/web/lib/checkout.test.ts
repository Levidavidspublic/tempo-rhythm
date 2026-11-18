import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { POST as whopWebhook } from "../app/api/whop/webhook/route";
import { GET as checkout } from "../app/checkout/route";
import { paypalSandboxCheckout, trialCheckoutUrl } from "./checkout";

describe("trial checkout link", () => {
  test("off by default", () => {
    expect(trialCheckoutUrl({})).toBeNull();
    expect(trialCheckoutUrl({ WHOP_PLAN_ID: "plan_abc123" })).toBeNull();
    expect(
      trialCheckoutUrl({ TEMPO_CHECKOUT_ENABLED: "1", WHOP_PLAN_ID: "plan_abc123" })
    ).toBeNull();
    expect(trialCheckoutUrl({ TEMPO_CHECKOUT_ENABLED: "true" })).toBeNull();
  });

  test("on only with the flag and a plan id of the right shape", () => {
    expect(trialCheckoutUrl({ TEMPO_CHECKOUT_ENABLED: "true", WHOP_PLAN_ID: "plan_abc123" })).toBe(
      "https://whop.com/checkout/plan_abc123"
    );
    expect(
      trialCheckoutUrl({ TEMPO_CHECKOUT_ENABLED: "true", WHOP_PLAN_ID: "prod_abc123" })
    ).toBeNull();
    expect(
      trialCheckoutUrl({ TEMPO_CHECKOUT_ENABLED: "true", WHOP_PLAN_ID: "plan_abc/../x" })
    ).toBeNull();
  });

  test("preview uses the existing Whop checkout switch and plan", () => {
    expect(
      trialCheckoutUrl({
        VERCEL_ENV: "preview",
        TEMPO_CHECKOUT_ENABLED: "true",
        WHOP_PLAN_ID: "plan_abc123",
      })
    ).toBe("https://whop.com/checkout/plan_abc123");
  });
});

describe("PayPal Sandbox checkout", () => {
  const preview = { VERCEL_ENV: "preview", PAYPAL_SANDBOX_PAYMENT_LINK_ID: "PLB-TEST12345678" };

  test("fails closed for an absent switch, malformed settings, or production", () => {
    for (const env of [
      preview,
      { ...preview, TEMPO_PAYPAL_SANDBOX_ENABLED: "1" },
      { VERCEL_ENV: "preview", TEMPO_PAYPAL_SANDBOX_ENABLED: "true" },
      {
        ...preview,
        TEMPO_PAYPAL_SANDBOX_ENABLED: "true",
        PAYPAL_SANDBOX_PAYMENT_LINK_ID: "https://www.paypal.com/ncp/payment/PLB-TEST12345678",
      },
      { ...preview, TEMPO_PAYPAL_SANDBOX_ENABLED: "true", VERCEL_ENV: "production" },
    ]) {
      expect(paypalSandboxCheckout(env).status).toBe(404);
    }
  });

  test("the checkout route redirects only to the configured sandbox resource", async () => {
    const previous = process.env;
    process.env = {
      ...preview,
      NODE_ENV: "test",
      TEMPO_CHECKOUT_ENABLED: "true",
      WHOP_PLAN_ID: "plan_abc123",
    };
    try {
      const request = new NextRequest(
        "https://preview.tempoflow.dev/checkout?next=https://www.paypal.com&amount=999"
      );
      expect((await checkout(request)).status).toBe(404);
      const webhook = new Request("https://preview.tempoflow.dev/api/whop/webhook", {
        method: "POST",
        body: "{}",
      });
      expect((await whopWebhook(webhook)).status).toBe(503);

      process.env.TEMPO_PAYPAL_SANDBOX_ENABLED = "true";
      const response = await checkout(request);
      expect(response.status).toBe(303);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("location")).toBe(
        "https://www.sandbox.paypal.com/ncp/payment/PLB-TEST12345678"
      );
    } finally {
      process.env = previous;
    }
  });
});
