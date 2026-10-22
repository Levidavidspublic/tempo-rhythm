import { spawnSync } from "bun";
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { mapRevenueCatEventToUserType, revenueCatIngressDecision } from "./revenuecat_events";
import {
  parseRevenueCatEvent,
  REVENUECAT_PRODUCT_CATALOG,
  type RevenueCatProductCatalog,
} from "./revenuecat_events";

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

const FIXTURE_CATALOG = {
  "fictional-basic-monthly": { plan: "basic", billingCycle: "monthly" },
  "fictional-pro-annual": { plan: "pro", billingCycle: "annual" },
  "fictional-max-monthly": { plan: "max", billingCycle: "monthly" },
} as const satisfies RevenueCatProductCatalog;

function eventEnvelope(fields: Record<string, unknown> = {}) {
  return {
    api_version: "1.0",
    event: {
      id: "fictional-event",
      type: "INITIAL_PURCHASE",
      app_user_id: "fictional-applicant",
      product_id: "fictional-basic-monthly",
      event_timestamp_ms: 1_700_000_000_000,
      expiration_at_ms: 1_702_592_000_000,
      ...fields,
    },
  };
}

describe("parseRevenueCatEvent", () => {
  for (const [type, kind] of [
    ["INITIAL_PURCHASE", "purchase"],
    ["RENEWAL", "renewal"],
    ["PRODUCT_CHANGE", "product-change"],
    ["UNCANCELLATION", "uncancellation"],
    ["CANCELLATION", "cancellation"],
    ["EXPIRATION", "expiration"],
  ]) {
    test("normalizes " + type + " with exact server-owned fields", () => {
      expect(parseRevenueCatEvent(eventEnvelope({ type }), FIXTURE_CATALOG)).toEqual({
        ok: true,
        event: {
          eventId: "fictional-event", eventAtMs: 1_700_000_000_000,
          appUserId: "fictional-applicant", productId: "fictional-basic-monthly",
          plan: "basic", billingCycle: "monthly", kind, paidThroughMs: 1_702_592_000_000,
        },
      });
    });
  }

  test("rejects non-object envelopes and missing or non-object event fields", () => {
    for (const input of [undefined, null, false, 1, "event", [], {}, { event: [] }, { event: null }, { event: "event" }]) {
      expect(parseRevenueCatEvent(input, FIXTURE_CATALOG)).toEqual({ ok: false, reason: "malformed" });
    }
  });

  test("requires bounded nonempty string IDs without padding or control characters", () => {
    for (const field of ["id", "app_user_id", "product_id", "type"]) {
      for (const value of [undefined, null, 1, {}, [], "", " ", " padded ", "a\nb", "a\u200Bb", "x".repeat(257)]) {
        expect(parseRevenueCatEvent(eventEnvelope({ [field]: value }), FIXTURE_CATALOG)).toEqual({ ok: false, reason: "malformed" });
      }
    }
  });

  test("accepts 256-character IDs without changing identity", () => {
    const id = "x".repeat(256);
    const result = parseRevenueCatEvent(eventEnvelope({ id, app_user_id: id }), FIXTURE_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) expect([result.event.eventId, result.event.appUserId]).toEqual([id, id]);
  });

  test("requires finite nonnegative safe integral millisecond timestamps", () => {
    for (const field of ["event_timestamp_ms", "expiration_at_ms"]) {
      for (const value of [undefined, null, "1700000000000", NaN, Infinity, -Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
        expect(parseRevenueCatEvent(eventEnvelope({ [field]: value }), FIXTURE_CATALOG)).toEqual({ ok: false, reason: "malformed" });
      }
    }
  });

  test("accepts zero and safe integer timestamp boundaries without converting seconds", () => {
    const result = parseRevenueCatEvent(eventEnvelope({ event_timestamp_ms: 0, expiration_at_ms: Number.MAX_SAFE_INTEGER }), FIXTURE_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.eventAtMs).toBe(0);
      expect(result.event.paidThroughMs).toBe(Number.MAX_SAFE_INTEGER);
    }
  });

  test("rejects aliases, transfers and unknown kinds without inventing a downgrade", () => {
    for (const type of ["SUBSCRIBER_ALIAS", "TRANSFER", "BILLING_ISSUE", "TEST", "NON_RENEWING_PURCHASE", "NEW_EVENT", "toString", "__proto__"]) {
      expect(parseRevenueCatEvent(eventEnvelope({ type }), FIXTURE_CATALOG)).toEqual({ ok: false, reason: "unsupported-event" });
    }
  });

  test("shipping catalog is frozen, empty, and rejects otherwise valid events", () => {
    expect(Object.keys(REVENUECAT_PRODUCT_CATALOG)).toEqual([]);
    expect(Object.isFrozen(REVENUECAT_PRODUCT_CATALOG)).toBe(true);
    expect(parseRevenueCatEvent(eventEnvelope(), REVENUECAT_PRODUCT_CATALOG)).toEqual({ ok: false, reason: "unmapped-product" });
  });

  test("rejects unknown products and inherited catalog entries", () => {
    for (const product_id of ["fictional-unmapped", "toString", "__proto__"]) {
      expect(parseRevenueCatEvent(eventEnvelope({ product_id }), FIXTURE_CATALOG)).toEqual({ ok: false, reason: "unmapped-product" });
    }
    const inherited: RevenueCatProductCatalog = Object.create(FIXTURE_CATALOG);
    expect(parseRevenueCatEvent(eventEnvelope(), inherited)).toEqual({ ok: false, reason: "unmapped-product" });
  });

  test("uses each fictional server mapping rather than claimed tier or entitlements", () => {
    for (const [product_id, mapping] of Object.entries(FIXTURE_CATALOG)) {
      const result = parseRevenueCatEvent(eventEnvelope({ product_id, plan: "max", billingCycle: "lifetime", entitlement_ids: ["fictional-admin"] }), FIXTURE_CATALOG);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.event.plan).toBe(mapping.plan);
        expect(result.event.billingCycle).toBe(mapping.billingCycle);
        expect(Object.keys(result.event).sort()).toEqual(["appUserId", "billingCycle", "eventAtMs", "eventId", "kind", "paidThroughMs", "plan", "productId"]);
      }
    }
  });

  test("product changes retain the current product and never grant a deferred product", () => {
    const result = parseRevenueCatEvent(eventEnvelope({ type: "PRODUCT_CHANGE", new_product_id: "fictional-max-monthly" }), FIXTURE_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.productId).toBe("fictional-basic-monthly");
      expect(result.event.plan).toBe("basic");
    }
  });

  test("cancellation preserves expiry and does not infer access revocation", () => {
    const result = parseRevenueCatEvent(eventEnvelope({ type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" }), FIXTURE_CATALOG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.paidThroughMs).toBe(1_702_592_000_000);
  });

  test("ignores additive provider fields without copying raw payloads", () => {
    const envelope = eventEnvelope({ future_field: { privateFixture: "fictional-only" }, aliases: ["fictional-alias"] });
    const before = JSON.stringify(envelope);
    const result = parseRevenueCatEvent(envelope, FIXTURE_CATALOG);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("fictional-only");
    expect(JSON.stringify(result)).not.toContain("fictional-alias");
    expect(JSON.stringify(envelope)).toBe(before);
  });

  test("parser rejections cannot reach the legacy updater with test-only ingress bypass", () => {
    const payloads = [null, eventEnvelope({ type: "TRANSFER" }), eventEnvelope()];
    const script = [
      'import { mock } from "bun:test";',
      'const actual = await import("./convex/lib/revenuecat_events");',
      'mock.module("./convex/lib/revenuecat_events", () => ({ ...actual, revenueCatIngressDecision: () => "continue" }));',
      'const { revenueCatWebhook } = await import("./convex/revenuecat");',
      'let writes = 0, calls = 0; const responses = [];',
      'globalThis.fetch = async () => { calls++; throw new Error("Provider calls forbidden"); };',
      'for (const payload of ' + JSON.stringify(payloads) + ') {',
      'const request = new Request("https://tempo.example/api/revenuecat-webhook", { method: "POST", body: JSON.stringify(payload) });',
      'const response = await revenueCatWebhook._handler({ runMutation: async () => { writes++; } }, request);',
      'responses.push({ status: response.status, body: await response.json() }); }',
      'process.stdout.write(JSON.stringify({ responses, writes, calls }));',
    ].join("\n");
    const child = spawnSync([process.execPath, "--no-env-file", "-e", script], {
      cwd: resolve(import.meta.dir, "../.."), env: { NODE_ENV: "test", TZ: "UTC" }, timeout: 10_000,
    });
    expect(child.exitCode).toBe(0);
    expect(new TextDecoder().decode(child.stderr)).toBe("");
    const result = JSON.parse(new TextDecoder().decode(child.stdout));
    expect(result.writes).toBe(0);
    expect(result.calls).toBe(0);
    expect(result.responses).toEqual(["malformed", "unsupported-event", "unmapped-product"].map((reason) => ({ status: 400, body: { received: false, reason } })));
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
