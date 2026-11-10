import { describe, expect, test } from "bun:test";
import { trialCheckoutUrl } from "./checkout";

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
});
