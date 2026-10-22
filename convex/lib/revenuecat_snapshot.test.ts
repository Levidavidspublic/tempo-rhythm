import { describe, expect, spyOn, test } from "bun:test";
import { readRevenueCatSnapshot } from "./revenuecat_client";
import {
	parseRevenueCatSnapshot,
	type ServerMapping,
} from "./revenuecat_snapshot";

const NOW = "2026-10-22T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const LATER = "2026-11-22T00:00:00Z";
const mapping: ServerMapping = {
	"fictional-basic": {
		plan: "basic",
		products: { "fictional-monthly": { billingCycle: "monthly" } },
	},
	"fictional-max": {
		plan: "max",
		products: {
			"fictional-annual": {
				billingCycle: "annual",
				basePlanId: "fictional-base",
			},
		},
	},
};
function snapshot() {
	return {
		request_date: NOW,
		request_date_ms: NOW_MS,
		subscriber: {
			entitlements: {
				"fictional-basic": {
					product_identifier: "fictional-monthly",
					expires_date: LATER,
				},
			} as Record<string, Record<string, unknown>>,
			subscriptions: { "fictional-monthly": { is_sandbox: true } } as Record<
				string,
				Record<string, unknown>
			>,
		},
	};
}
function options() {
	return {
		enabled: true,
		canonicalCustomerId: "fictional-customer",
		mapping,
		environment: "sandbox" as const,
	};
}
const fixtureCredential = () => ["synthetic", "test", "only"].join(" ");
function transport(body: unknown = snapshot()) {
	const calls: { url: string; init: RequestInit }[] = [];
	return {
		calls,
		dependencies: {
			getApiKey: fixtureCredential,
			fetch: async (url: string, init: RequestInit) => {
				calls.push({ url, init });
				return new Response(JSON.stringify(body));
			},
		},
	};
}

describe("authoritative subscription snapshot parser", () => {
	test("keeps only server mapping authority and returns a fresh normalized shape", () => {
		const body = snapshot();
		body.subscriber.entitlements["fictional-basic"].plan = "max";
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: true,
			snapshot: {
				requestAtMs: NOW_MS,
				grants: [
					{
						entitlementId: "fictional-basic",
						productId: "fictional-monthly",
						plan: "basic",
						billingCycle: "monthly",
						expiresAtMs: Date.parse(LATER),
					},
				],
			},
		});
	});

	test("complete empty maps differ from absent or malformed maps", () => {
		expect(
			parseRevenueCatSnapshot(
				{
					request_date: NOW,
					subscriber: { entitlements: {}, subscriptions: {} },
				},
				mapping,
				"sandbox",
			),
		).toEqual({ ok: true, snapshot: { requestAtMs: NOW_MS, grants: [] } });
		for (const subscriber of [
			{},
			{ entitlements: {} },
			{ entitlements: {}, subscriptions: [] },
			{ entitlements: null, subscriptions: {} },
		]) {
			expect(
				parseRevenueCatSnapshot(
					{ request_date: NOW, subscriber },
					mapping,
					"sandbox",
				),
			).toEqual({ ok: false, reason: "malformed" });
		}
	});

	test("retains expired grants and overlapping tiers in deterministic order", () => {
		const body = snapshot();
		body.subscriber.entitlements = {
			"fictional-max": {
				product_identifier: "fictional-annual",
				product_plan_identifier: "fictional-base",
				expires_date: NOW,
			},
			...body.subscriber.entitlements,
		};
		body.subscriber.subscriptions["fictional-annual"] = {
			is_sandbox: true,
			product_plan_identifier: "fictional-base",
		};
		const result = parseRevenueCatSnapshot(body, mapping, "sandbox");
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("Expected supported snapshot");
		expect(result.snapshot.grants.map((grant) => grant.plan)).toEqual([
			"basic",
			"max",
		]);
		expect(result.snapshot.grants[1].expiresAtMs).toBe(NOW_MS);
	});

	test("two entitlement IDs may share a product without losing either grant", () => {
		const body = snapshot();
		body.subscriber.entitlements.second = {
			...body.subscriber.entitlements["fictional-basic"],
		};
		const result = parseRevenueCatSnapshot(
			body,
			{ ...mapping, second: mapping["fictional-basic"] },
			"sandbox",
		);
		expect(result.ok && result.snapshot.grants.length).toBe(2);
	});

	test("unknown entitlements confer nothing; malformed mapped rows never partially succeed", () => {
		const body = snapshot();
		body.subscriber.entitlements.unknown = { arbitrary: true };
		expect(parseRevenueCatSnapshot(body, {}, "sandbox")).toEqual({
			ok: true,
			snapshot: { requestAtMs: NOW_MS, grants: [] },
		});
		body.subscriber.entitlements["fictional-max"] = {
			product_identifier: "fictional-annual",
		};
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox").ok).toBe(false);
	});

	test("mapped product must be configured and backed by a subscription", () => {
		const body = snapshot();
		body.subscriber.entitlements["fictional-basic"].product_identifier =
			"unmapped";
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: false,
			reason: "unsupported",
		});
		body.subscriber.entitlements["fictional-basic"].product_identifier =
			"fictional-monthly";
		body.subscriber.subscriptions = {};
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: false,
			reason: "malformed",
		});
	});

	test("configured base plan is exact and redundant product data cannot contradict it", () => {
		const body = snapshot();
		body.subscriber.entitlements = {
			"fictional-max": {
				product_identifier: "fictional-annual",
				expires_date: LATER,
			},
		};
		body.subscriber.subscriptions = {
			"fictional-annual": { is_sandbox: true },
		};
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: false,
			reason: "unsupported",
		});
		body.subscriber.entitlements["fictional-max"].product_plan_identifier =
			"fictional-base";
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox").ok).toBe(true);
		body.subscriber.subscriptions["fictional-annual"].product_plan_identifier =
			"different";
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: false,
			reason: "unsupported",
		});
	});

	test("environment must match a real subscription boolean", () => {
		const body = snapshot();
		expect(parseRevenueCatSnapshot(body, mapping, "production")).toEqual({
			ok: false,
			reason: "environment-mismatch",
		});
		body.subscriber.subscriptions["fictional-monthly"].is_sandbox = "true";
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: false,
			reason: "malformed",
		});
		body.subscriber.subscriptions["fictional-monthly"].is_sandbox = false;
		expect(parseRevenueCatSnapshot(body, mapping, "production").ok).toBe(true);
	});

	test("mapped lifetime grants are explicitly unsupported", () => {
		const body = snapshot();
		body.subscriber.entitlements["fictional-basic"].expires_date = null;
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: false,
			reason: "unsupported",
		});
	});

	test("request timestamp supports either representation and exact agreement", () => {
		const { request_date: _date, request_date_ms: _ms, ...rest } = snapshot();
		for (const dates of [
			{ request_date: NOW },
			{ request_date_ms: NOW_MS },
			{ request_date: "2026-10-22T03:00:00+03:00", request_date_ms: NOW_MS },
		]) {
			expect(
				parseRevenueCatSnapshot({ ...rest, ...dates }, mapping, "sandbox").ok,
			).toBe(true);
		}
		for (const dates of [
			{},
			{ request_date: NOW, request_date_ms: NOW_MS + 1 },
			{ request_date_ms: -1 },
			{ request_date_ms: Infinity },
			{ request_date_ms: 1.5 },
			{ request_date: null, request_date_ms: NOW_MS },
		]) {
			expect(
				parseRevenueCatSnapshot({ ...rest, ...dates }, mapping, "sandbox"),
			).toEqual({ ok: false, reason: "malformed" });
		}
	});

	test("invalid or lossy RFC3339 dates are not normalized into valid grants", () => {
		for (const date of [
			"2026-02-30T00:00:00Z",
			"2026-10-22",
			"2026-10-22T24:00:00Z",
			"2026-10-22T00:00:00.0001Z",
			"1960-01-01T00:00:00Z",
			"2026-10-22T00:00:00+24:00",
		]) {
			const body = snapshot();
			body.subscriber.entitlements["fictional-basic"].expires_date = date;
			expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
				ok: false,
				reason: "malformed",
			});
		}
	});

	test("malformed top-level shapes and unsafe map keys fail closed", () => {
		for (const body of [
			null,
			[],
			"raw",
			1,
			{ request_date: NOW, subscriber: [] },
		]) {
			expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
				ok: false,
				reason: "malformed",
			});
		}
		const body = snapshot();
		body.subscriber.entitlements[" padded "] = {};
		expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
			ok: false,
			reason: "malformed",
		});
	});

	test("both provider maps are capped at 128 entries", () => {
		for (const field of ["entitlements", "subscriptions"] as const) {
			const body = snapshot();
			body.subscriber[field] = Object.fromEntries(
				Array.from({ length: 129 }, (_, i) => [`entry-${i}`, {}]),
			);
			expect(parseRevenueCatSnapshot(body, mapping, "sandbox")).toEqual({
				ok: false,
				reason: "oversize",
			});
		}
	});

	test("32 mapped grants are accepted, 33 rejected as a whole", () => {
		const body = snapshot();
		const manyMapping: Record<string, ServerMapping[string]> = {};
		body.subscriber.entitlements = {};
		for (let i = 0; i < 33; i++) {
			const id = `entitlement-${i}`;
			manyMapping[id] = mapping["fictional-basic"];
			body.subscriber.entitlements[id] = {
				product_identifier: "fictional-monthly",
				expires_date: LATER,
			};
			if (i === 31)
				expect(parseRevenueCatSnapshot(body, manyMapping, "sandbox").ok).toBe(
					true,
				);
		}
		expect(parseRevenueCatSnapshot(body, manyMapping, "sandbox")).toEqual({
			ok: false,
			reason: "oversize",
		});
	});
});

describe("server-only bounded snapshot reader", () => {
	test("fixed endpoint encodes identity and uses GET/no redirects with a server header", async () => {
		const io = transport();
		const result = await readRevenueCatSnapshot(
			{ ...options(), canonicalCustomerId: "fictional/ +?" },
			io.dependencies,
		);
		expect(result.ok).toBe(true);
		expect(io.calls).toHaveLength(1);
		expect(io.calls[0].url).toBe(
			"https://api.revenuecat.com/v1/subscribers/fictional%2F%20%2B%3F",
		);
		expect(io.calls[0].init.method).toBe("GET");
		expect(io.calls[0].init.redirect).toBe("error");
		expect(new Headers(io.calls[0].init.headers).get("Authorization")).toBe(
			`Bearer ${fixtureCredential()}`,
		);
	});

	test("OFF reads no credential and performs zero fetches", async () => {
		let accesses = 0;
		const io = transport();
		expect(
			await readRevenueCatSnapshot(
				{ ...options(), enabled: false },
				{
					...io.dependencies,
					getApiKey: () => {
						accesses++;
						throw new Error("must not read");
					},
				},
			),
		).toEqual({ ok: false, reason: "disabled" });
		expect(accesses).toBe(0);
		expect(io.calls).toHaveLength(0);
	});

	test("empty mapping, missing environment or invalid bounded identity never fetch", async () => {
		const io = transport();
		for (const changes of [
			{ mapping: {} },
			{ environment: null },
			{ canonicalCustomerId: "" },
			{ canonicalCustomerId: " padded" },
			{ canonicalCustomerId: "a".repeat(257) },
			{ canonicalCustomerId: "bad\nidentity" },
		]) {
			expect(
				await readRevenueCatSnapshot(
					{ ...options(), ...changes },
					io.dependencies,
				),
			).toEqual({ ok: false, reason: "unconfigured" });
		}
		expect(io.calls).toHaveLength(0);
	});

	test("missing or rejected credential accessor fails without networking", async () => {
		const io = transport();
		for (const getApiKey of [
			() => undefined,
			() => "",
			() => "bad\nheader",
			() => {
				throw new Error("private fixture error");
			},
		]) {
			expect(
				await readRevenueCatSnapshot(options(), {
					...io.dependencies,
					getApiKey,
				}),
			).toEqual({ ok: false, reason: "unconfigured" });
		}
		expect(io.calls).toHaveLength(0);
	});

	test("non-200, redirect failure and fetch rejection are typed unavailable without retry", async () => {
		for (const status of [201, 301, 401, 429, 500]) {
			let calls = 0;
			const result = await readRevenueCatSnapshot(options(), {
				getApiKey: fixtureCredential,
				fetch: async () => {
					calls++;
					return new Response("not logged", { status });
				},
			});
			expect(result).toEqual({ ok: false, reason: "unavailable" });
			expect(calls).toBe(1);
		}
		expect(
			await readRevenueCatSnapshot(options(), {
				getApiKey: fixtureCredential,
				fetch: async () => {
					throw new Error("redirect or private provider failure");
				},
			}),
		).toEqual({ ok: false, reason: "unavailable" });
	});

	test("partial or invalid provider response never becomes an empty revocation", async () => {
		for (const body of [
			{},
			{ request_date: NOW, subscriber: {} },
			{
				request_date: NOW,
				subscriber: { entitlements: {}, subscriptions: [] },
			},
		]) {
			const io = transport(body);
			expect(await readRevenueCatSnapshot(options(), io.dependencies)).toEqual({
				ok: false,
				reason: "invalid-response",
			});
		}
		for (const body of ['{"subscriber":', new Uint8Array([255, 254])]) {
			expect(
				await readRevenueCatSnapshot(options(), {
					getApiKey: fixtureCredential,
					fetch: async () => new Response(body),
				}),
			).toEqual({ ok: false, reason: "invalid-response" });
		}
	});

	test("oversized raw stream is canceled and unlocked without parsing partial bytes", async () => {
		let canceled = 0;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(128 * 1024 + 1));
			},
			cancel() {
				canceled++;
			},
		});
		expect(
			await readRevenueCatSnapshot(options(), {
				getApiKey: fixtureCredential,
				fetch: async () => new Response(stream),
			}),
		).toEqual({ ok: false, reason: "invalid-response" });
		expect(canceled).toBe(1);
		expect(stream.locked).toBe(false);
	});

	test("exact 128KiB valid response is accepted", async () => {
		const json = JSON.stringify(snapshot());
		const bytes = new TextEncoder().encode(json.padEnd(128 * 1024, " "));
		expect(
			(
				await readRevenueCatSnapshot(options(), {
					getApiKey: fixtureCredential,
					fetch: async () => new Response(bytes),
				})
			).ok,
		).toBe(true);
	});

	test("already-aborted caller causes zero fetches", async () => {
		const controller = new AbortController();
		controller.abort();
		const io = transport();
		expect(
			await readRevenueCatSnapshot(
				{ ...options(), signal: controller.signal },
				io.dependencies,
			),
		).toEqual({ ok: false, reason: "unavailable" });
		expect(io.calls).toHaveLength(0);
	});

	test("external abort cancels a pending reader even if cancellation never settles", async () => {
		const controller = new AbortController();
		let canceled = 0;
		const observed: { signal?: AbortSignal | null } = {};
		const stream = new ReadableStream<Uint8Array>({
			cancel() {
				canceled++;
				return new Promise<void>(() => {});
			},
		});
		const pending = readRevenueCatSnapshot(
			{ ...options(), signal: controller.signal },
			{
				getApiKey: fixtureCredential,
				fetch: async (_url, init) => {
					observed.signal = init.signal;
					return new Response(stream);
				},
			},
		);
		await new Promise((resolve) => setTimeout(resolve, 10));
		controller.abort();
		expect(await pending).toEqual({ ok: false, reason: "unavailable" });
		expect(observed.signal?.aborted).toBe(true);
		expect(canceled).toBe(1);
		expect(stream.locked).toBe(false);
	});

	test("whole-response five-second deadline includes a body that never completes", async () => {
		let canceled = 0;
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("{"));
			},
			cancel() {
				canceled++;
			},
		});
		const started = Date.now();
		expect(
			await readRevenueCatSnapshot(options(), {
				getApiKey: fixtureCredential,
				fetch: async () => new Response(stream),
			}),
		).toEqual({ ok: false, reason: "unavailable" });
		expect(Date.now() - started).toBeGreaterThanOrEqual(4_900);
		expect(Date.now() - started).toBeLessThan(6_500);
		expect(canceled).toBe(1);
		expect(stream.locked).toBe(false);
	}, 8_000);

	test("normal completion releases the body lock", async () => {
		const response = new Response(JSON.stringify(snapshot()));
		expect(
			(
				await readRevenueCatSnapshot(options(), {
					getApiKey: fixtureCredential,
					fetch: async () => response,
				})
			).ok,
		).toBe(true);
		expect(response.body?.locked).toBe(false);
	});

	test("aborted header wait rejects promptly and cancels any late response body", async () => {
		const controller = new AbortController();
		let deliver: (response: Response) => void = () => {};
		const headers = new Promise<Response>((resolve) => {
			deliver = resolve;
		});
		const pending = readRevenueCatSnapshot(
			{ ...options(), signal: controller.signal },
			{ getApiKey: fixtureCredential, fetch: () => headers },
		);
		controller.abort();
		expect(await pending).toEqual({ ok: false, reason: "unavailable" });
		let canceled = 0;
		const stream = new ReadableStream<Uint8Array>({
			cancel() {
				canceled++;
			},
		});
		deliver(new Response(stream));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(canceled).toBe(1);
		expect(stream.locked).toBe(false);
	});

	test("non-success header response cancels its unread body", async () => {
		let canceled = 0;
		const stream = new ReadableStream<Uint8Array>({
			cancel() {
				canceled++;
			},
		});
		expect(
			await readRevenueCatSnapshot(options(), {
				getApiKey: fixtureCredential,
				fetch: async () => new Response(stream, { status: 429 }),
			}),
		).toEqual({ ok: false, reason: "unavailable" });
		expect(canceled).toBe(1);
	});

	test("provider errors and raw response contents never reach console output", async () => {
		const log = spyOn(console, "log").mockImplementation(() => {});
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		const error = spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(
				await readRevenueCatSnapshot(options(), {
					getApiKey: fixtureCredential,
					fetch: async () => {
						throw new Error("fictional provider private detail");
					},
				}),
			).toEqual({ ok: false, reason: "unavailable" });
			expect(
				await readRevenueCatSnapshot(options(), {
					getApiKey: fixtureCredential,
					fetch: async () => new Response("fictional unstructured response"),
				}),
			).toEqual({ ok: false, reason: "invalid-response" });
			expect(log).not.toHaveBeenCalled();
			expect(warn).not.toHaveBeenCalled();
			expect(error).not.toHaveBeenCalled();
		} finally {
			log.mockRestore();
			warn.mockRestore();
			error.mockRestore();
		}
	});
});
