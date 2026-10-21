import { spawnSync } from "bun";
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { mapRevenueCatEventToUserType, revenueCatIngressDecision } from "./revenuecat_events";

describe("mapRevenueCatEventToUserType", () => {
  test("maps purchase lifecycle events to paid", () => {
    for (const eventType of [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "PRODUCT_CHANGE",
      "UNCANCELLATION",
    ]) {
      expect(mapRevenueCatEventToUserType(eventType)).toBe("paid");
    }
  });

  test("maps churn events to free", () => {
    for (const eventType of ["EXPIRATION", "CANCELLATION", "SUBSCRIBER_ALIAS"]) {
      expect(mapRevenueCatEventToUserType(eventType)).toBe("free");
    }
  });

  test("defaults unknown or missing events to free", () => {
    expect(mapRevenueCatEventToUserType(undefined)).toBe("free");
    expect(mapRevenueCatEventToUserType("BILLING_ISSUE")).toBe("free");
  });
});

// Recognizable synthetic inputs, never credentials from the host or a deployment.
const FIXTURE_AUTH = "payment-gate-fixture-auth";
const FIXTURE_BODY = "payment-gate-fixture-body";
type WebhookScenario = {
  configuredSecret?: string;
  authorization?: string;
  malformedBody?: boolean;
  throwingBody?: boolean;
  clientEnable?: boolean;
  registeredRoute?: boolean;
};
type WebhookResult = {
  status: number;
  body: string;
  contentType: string | null;
  bodyReads: number;
  bodyUsed: boolean;
  mutations: number;
  providerCalls: number;
  logs: string[];
  registeredMatch: boolean;
  processingEnabled: boolean;
};

function runWebhook(scenario: WebhookScenario): WebhookResult {
  const script = `
    const scenario = ${JSON.stringify(scenario)};
    let bodyReads = 0, mutations = 0, providerCalls = 0;
    const logs = [];
    for (const method of ["log", "warn", "error"]) console[method] = (...values) => logs.push(values.map(String).join(" "));
    globalThis.fetch = async () => { providerCalls++; throw new Error("Provider calls are forbidden in this fixture"); };
    const { revenueCatWebhook } = await import("./convex/revenuecat");
    const { REVENUECAT_PROCESSING_ENABLED } = await import("./convex/lib/revenuecat_events");
    let action = revenueCatWebhook;
    let registeredMatch = false;
    if (scenario.registeredRoute) {
      const { default: router } = await import("./convex/http");
      const route = router.getRoutes().find(([path, method]) => path === "/api/revenuecat-webhook" && method === "POST");
      if (!route) throw new Error("Registered payment webhook is missing");
      action = route[2];
      registeredMatch = action === revenueCatWebhook;
    }
    const headers = new Headers({ "Content-Type": "application/json" });
    if (scenario.authorization !== undefined) headers.set("Authorization", scenario.authorization);
    if (scenario.clientEnable) headers.set("REVENUECAT_PROCESSING_ENABLED", "true");
    const request = new Request("https://tempo.example/api/revenuecat-webhook" + (scenario.clientEnable ? "?processingEnabled=true" : ""), {
      method: "POST", headers,
      body: scenario.malformedBody ? "{" : JSON.stringify({ event: { type: "INITIAL_PURCHASE", app_user_id: "fixture-user", payload: ${JSON.stringify(FIXTURE_BODY)} }, processingEnabled: true }),
    });
    const readJson = request.json.bind(request);
    request.json = async () => { bodyReads++; if (scenario.throwingBody) throw new Error("Body must remain unread"); return readJson(); };
    const response = await action._handler({ runMutation: async () => { mutations++; throw new Error("Account writes are forbidden in this fixture"); } }, request);
    process.stdout.write(JSON.stringify({ status: response.status, body: await response.text(), contentType: response.headers.get("Content-Type"), bodyReads, bodyUsed: request.bodyUsed, mutations, providerCalls, logs, registeredMatch, processingEnabled: REVENUECAT_PROCESSING_ENABLED }));
  `;
  const child = spawnSync([process.execPath, "--no-env-file", "-e", script], {
    cwd: resolve(import.meta.dir, "../.."),
    // Do not inherit a host secret or load an environment file.
    env: {
      NODE_ENV: "test",
      TZ: "UTC",
      ...(scenario.configuredSecret === undefined ? {} : { REVENUECAT_WEBHOOK_SECRET: scenario.configuredSecret }),
      ...(scenario.clientEnable ? { REVENUECAT_PROCESSING_ENABLED: "true", PAYMENT_SYSTEM_ENABLED: "true" } : {}),
    },
    timeout: 10_000,
  });
  expect(child.exitCode).toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toBe("");
  const result: WebhookResult = JSON.parse(new TextDecoder().decode(child.stdout));
  expect(result.bodyReads).toBe(0);
  expect(result.bodyUsed).toBe(false);
  expect(result.mutations).toBe(0);
  expect(result.providerCalls).toBe(0);
  expect(result.processingEnabled).toBe(false);
  expect(JSON.stringify(result)).not.toContain(FIXTURE_AUTH);
  expect(JSON.stringify(result)).not.toContain(FIXTURE_BODY);
  return result;
}

describe("payment webhook stays off", () => {
  test("missing or empty configuration keeps the existing 503 response", () => {
    for (const configuredSecret of [undefined, ""]) {
      for (const processingEnabled of [false, true]) {
        expect(revenueCatIngressDecision({ authorization: FIXTURE_AUTH, configuredSecret, processingEnabled })).toBe("not_configured");
      }
      const response = runWebhook({ configuredSecret, authorization: FIXTURE_AUTH });
      expect(response.status).toBe(503);
      expect(response.body).toBe("Webhook not configured");
      expect(response.logs).toEqual(["[RevenueCat Webhook] REVENUECAT_WEBHOOK_SECRET is not configured"]);
    }
  }, 25_000);

  test("missing or wrong authorization keeps the existing 401 response", () => {
    for (const authorization of [null, "wrong-fixture-auth"]) {
      for (const processingEnabled of [false, true]) {
        expect(revenueCatIngressDecision({ authorization, configuredSecret: FIXTURE_AUTH, processingEnabled })).toBe("unauthorized");
      }
      const response = runWebhook({ configuredSecret: FIXTURE_AUTH, authorization: authorization ?? undefined });
      expect(response.status).toBe(401);
      expect(response.body).toBe("Unauthorized");
      expect(response.logs).toEqual([]);
    }
  }, 25_000);

  test("authenticated processing-off requests explicitly return disabled", () => {
    const input = { authorization: FIXTURE_AUTH, configuredSecret: FIXTURE_AUTH };
    expect(revenueCatIngressDecision({ ...input, processingEnabled: false })).toBe("disabled");
    expect(revenueCatIngressDecision({ ...input, processingEnabled: true })).toBe("continue");
    const response = runWebhook({ ...input });
    expect(response.status).toBe(503);
    expect(response.contentType).toBe("application/json");
    expect(JSON.parse(response.body)).toEqual({ received: false, reason: "payments_disabled" });
    expect(response.logs).toEqual([]);
  }, 15_000);

  test("disabled malformed and throwing request bodies are never read", () => {
    for (const body of [{ malformedBody: true }, { throwingBody: true }]) {
      const response = runWebhook({ configuredSecret: FIXTURE_AUTH, authorization: FIXTURE_AUTH, ...body });
      expect(response.status).toBe(503);
      expect(JSON.parse(response.body)).toEqual({ received: false, reason: "payments_disabled" });
      expect(response.logs).toEqual([]);
    }
  }, 25_000);

  test("client query, body, headers and environment flags cannot enable processing", () => {
    const response = runWebhook({ configuredSecret: FIXTURE_AUTH, authorization: FIXTURE_AUTH, clientEnable: true });
    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ received: false, reason: "payments_disabled" });
    expect(response.logs).toEqual([]);
  }, 15_000);

  test("the actual registered action stays off without writes, provider calls or payload logs", () => {
    const response = runWebhook({ configuredSecret: FIXTURE_AUTH, authorization: FIXTURE_AUTH, registeredRoute: true });
    expect(response.registeredMatch).toBe(true);
    expect(response.status).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ received: false, reason: "payments_disabled" });
    expect(response.logs).toEqual([]);
  }, 15_000);
});
