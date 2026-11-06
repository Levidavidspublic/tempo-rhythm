import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	AiAuthError,
	AiCancelledError,
	AiConfigurationError,
	AiContextTooLargeError,
	AiRateLimitedError,
	AiUpstreamError,
} from "./ai_errors";
import { callLLM, DEEPINFRA_CHAT_COMPLETIONS_URL, resolveAiModel } from "./ai_router";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.DEEPINFRA_API_KEY;
const originalModel = process.env.TEMPO_AI_MODEL;
const originalThinkingModel = process.env.TEMPO_AI_THINK_HARD_MODEL;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const MODEL_FIXTURE = "fixture/default-model";
const THINKING_FIXTURE = "fixture/thinking-model";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

function errorResponse(
	status: number,
	body: string,
	headers?: HeadersInit,
): Response {
	return new Response(body, { status, headers });
}

function successBody(content = "ok") {
	return {
		choices: [{ message: { content } }],
		usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
	};
}

beforeEach(() => {
	process.env.DEEPINFRA_API_KEY = "test-key";
	process.env.TEMPO_AI_MODEL = MODEL_FIXTURE;
	delete process.env.TEMPO_AI_THINK_HARD_MODEL;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	globalThis.setTimeout = originalSetTimeout;
	globalThis.clearTimeout = originalClearTimeout;
	if (originalApiKey === undefined) {
		delete process.env.DEEPINFRA_API_KEY;
	} else {
		process.env.DEEPINFRA_API_KEY = originalApiKey;
	}
	if (originalModel === undefined) {
		delete process.env.TEMPO_AI_MODEL;
	} else {
		process.env.TEMPO_AI_MODEL = originalModel;
	}
	if (originalThinkingModel === undefined) {
		delete process.env.TEMPO_AI_THINK_HARD_MODEL;
	} else {
		process.env.TEMPO_AI_THINK_HARD_MODEL = originalThinkingModel;
	}
});

describe("callLLM", () => {
	test("throws AiAuthError when DEEPINFRA_API_KEY is missing", async () => {
		delete process.env.DEEPINFRA_API_KEY;
		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] }),
		).rejects.toBeInstanceOf(AiAuthError);
	});

	test("returns parsed content on success", async () => {
		globalThis.fetch = Object.assign(mock(() =>
			Promise.resolve(jsonResponse(successBody('{"plan":true}'))),
		), { preconnect: originalFetch.preconnect });

		const result = await callLLM({
			tier: "fast",
			messages: [{ role: "user", content: "hi" }],
			responseFormat: "json_object",
		});

		expect(result.content).toBe('{"plan":true}');
		expect(result.tier).toBe("fast");
		expect(result.model).toBe(MODEL_FIXTURE);
		expect(result.escalated).toBe(false);
		expect(result.usage.totalTokens).toBe(15);
	});

	test("throws AiAuthError on HTTP 401 without retrying", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(401, "bad key")),
		);
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });

		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] }),
		).rejects.toBeInstanceOf(AiAuthError);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("retries once on HTTP 429 then succeeds", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(429, "slow down", { "Retry-After": "1" })),
		)
			.mockImplementationOnce(() =>
				Promise.resolve(
					errorResponse(429, "slow down", { "Retry-After": "1" }),
				),
			)
			.mockImplementationOnce(() =>
				Promise.resolve(jsonResponse(successBody("done"))),
			);

		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });

		const result = await callLLM({
			tier: "balanced",
			messages: [{ role: "user", content: "hi" }],
		});

		expect(result.content).toBe("done");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	test("throws AiRateLimitedError after two 429 responses", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(429, "slow down")),
		);
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });

		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] }),
		).rejects.toBeInstanceOf(AiRateLimitedError);

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	test("posts to the existing provider with the configured default for every legacy tier", async () => {
		const fetchMock = mock((url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { model: string };
			expect(String(url)).toBe(DEEPINFRA_CHAT_COMPLETIONS_URL);
			expect(body.model).toBe(MODEL_FIXTURE);
			return Promise.resolve(jsonResponse(successBody("ok")));
		});
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });

		for (const tier of ["fast", "balanced", "deep"] as const) {
			const result = await callLLM({ tier, messages: [{ role: "user", content: "hi" }] });
			expect(result.model).toBe(MODEL_FIXTURE);
			expect(result.escalated).toBe(false);
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	test("TEMPO_AI_MODEL overrides the model in one place", async () => {
		process.env.TEMPO_AI_MODEL = "fixture/alternate-model";
		const fetchMock = mock((_url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { model: string };
			expect(body.model).toBe("fixture/alternate-model");
			return Promise.resolve(jsonResponse(successBody("ok")));
		});
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });

		const result = await callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] });
		expect(result.model).toBe("fixture/alternate-model");
	});

	test("context-too-large surfaces without retry (single model, nothing to escalate to)", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(400, JSON.stringify({ error: "context_length_exceeded" }))),
		);
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });

		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "big" }] }),
		).rejects.toBeInstanceOf(AiContextTooLargeError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("throws AiContextTooLargeError when deep tier still exceeds context", async () => {
		globalThis.fetch = Object.assign(mock(() =>
			Promise.resolve(
				errorResponse(400, "maximum context length exceeded for this model"),
			),
		), { preconnect: originalFetch.preconnect });

		await expect(
			callLLM({ tier: "deep", messages: [{ role: "user", content: "huge" }] }),
		).rejects.toBeInstanceOf(AiContextTooLargeError);
	});

	test("retries once on HTTP 503 then surfaces AiUpstreamError", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(503, "unavailable")),
		);
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });

		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] }),
		).rejects.toBeInstanceOf(AiUpstreamError);

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe("configured reasoning and cancellation", () => {
	const messages = [{ role: "user" as const, content: "A fictional question" }];

	test("missing model configuration has no fallback and preserves friendly auth handling", async () => {
		delete process.env.TEMPO_AI_MODEL;
		const fetchMock = mock(() => Promise.resolve(jsonResponse(successBody())));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		const failure = await callLLM({ tier: "balanced", messages }).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(AiConfigurationError);
		expect(failure).toBeInstanceOf(AiAuthError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test.each([" ", "fixture/model\nextra", "https://untrusted.invalid/model", "a".repeat(201)])(
		"invalid model configuration is rejected without echoing it: %s", async (value) => {
			process.env.TEMPO_AI_MODEL = value;
			const fetchMock = mock(() => Promise.resolve(jsonResponse(successBody())));
			globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
			const failure = await callLLM({ tier: "balanced", messages }).catch((error: unknown) => error);
			expect(failure).toBeInstanceOf(AiConfigurationError);
			expect((failure as Error).message).toBe("TEMPO_AI_MODEL needs a supported model identifier in Convex settings");
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);

	test("normal requests use medium reasoning and preserve request controls", async () => {
		globalThis.fetch = Object.assign(mock((_url: string | URL | Request, init?: RequestInit) => {
			expect(JSON.parse(String(init?.body))).toEqual({
				model: MODEL_FIXTURE, messages, max_tokens: 42, temperature: 0,
				reasoning_effort: "medium", response_format: { type: "json_object" },
			});
			expect(init?.signal).toBeInstanceOf(AbortSignal);
			return Promise.resolve(jsonResponse(successBody()));
		}), { preconnect: originalFetch.preconnect });
		await callLLM({ tier: "balanced", messages, maxTokens: 42, temperature: 0, responseFormat: "json_object" });
	});

	test("explicit high raises effort without changing the default model", async () => {
		globalThis.fetch = Object.assign(mock((_url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			expect(body.reasoning_effort).toBe("high");
			expect(body.model).toBe(MODEL_FIXTURE);
			return Promise.resolve(jsonResponse(successBody()));
		}), { preconnect: originalFetch.preconnect });
		await callLLM({ tier: "balanced", messages, reasoning: "high" });
	});

	test("substantial newest user input raises default effort, not system or historical text", async () => {
		const efforts: string[] = [];
		globalThis.fetch = Object.assign(mock((_url: string | URL | Request, init?: RequestInit) => {
			efforts.push(JSON.parse(String(init?.body)).reasoning_effort);
			return Promise.resolve(jsonResponse(successBody()));
		}), { preconnect: originalFetch.preconnect });
		await callLLM({ tier: "balanced", messages: [{ role: "user", content: "a".repeat(8_000) }] });
		await callLLM({ tier: "balanced", messages: [{ role: "system", content: "a".repeat(8_000) }, ...messages] });
		await callLLM({ tier: "balanced", messages: [{ role: "user", content: "a".repeat(8_000) }, ...messages] });
		await callLLM({ tier: "balanced", messages: [{ role: "user", content: "a".repeat(8_000) }], reasoning: "medium" });
		expect(efforts).toEqual(["high", "medium", "medium", "medium"]);
	});

	test("think hard uses the separate configured model and always high reasoning", async () => {
		process.env.TEMPO_AI_THINK_HARD_MODEL = THINKING_FIXTURE;
		globalThis.fetch = Object.assign(mock((_url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			expect(body.reasoning_effort).toBe("high");
			expect(body.model).toBe(THINKING_FIXTURE);
			return Promise.resolve(jsonResponse(successBody()));
		}), { preconnect: originalFetch.preconnect });
		const result = await callLLM({ tier: "deep", messages, mode: "think_hard", reasoning: "medium" });
		expect(result.model).toBe(THINKING_FIXTURE);
		expect(result.tier).toBe("deep");
		expect(result.requestedTier).toBe("deep");
		expect(result.escalated).toBe(false);
	});

	test("think hard rejects missing or duplicate model settings before any provider call", async () => {
		const fetchMock = mock(() => Promise.resolve(jsonResponse(successBody())));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		await expect(callLLM({ tier: "deep", messages, mode: "think_hard" })).rejects.toBeInstanceOf(AiConfigurationError);
		process.env.TEMPO_AI_THINK_HARD_MODEL = MODEL_FIXTURE;
		await expect(callLLM({ tier: "deep", messages, mode: "think_hard" })).rejects.toBeInstanceOf(AiConfigurationError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("configuration is frozen across the single transient retry", async () => {
		const models: string[] = [];
		globalThis.fetch = Object.assign(mock((_url: string | URL | Request, init?: RequestInit) => {
			models.push(JSON.parse(String(init?.body)).model);
			process.env.TEMPO_AI_MODEL = "fixture/changed-setting";
			return Promise.resolve(models.length === 1 ? errorResponse(503, "temporary") : jsonResponse(successBody()));
		}), { preconnect: originalFetch.preconnect });
		await callLLM({ tier: "balanced", messages });
		expect(models).toEqual([MODEL_FIXTURE, MODEL_FIXTURE]);
		expect(resolveAiModel()).toBe("fixture/changed-setting");
	});

	test("pre-abort makes no provider call and never exposes the abort reason", async () => {
		const controller = new AbortController();
		controller.abort("fictional-private-abort-detail");
		const fetchMock = mock(() => Promise.resolve(jsonResponse(successBody())));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		const failure = await callLLM({ tier: "balanced", messages, signal: controller.signal }).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(AiCancelledError);
		expect((failure as Error).message).toBe("The model request was cancelled");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("abort ends a headers wait even if the transport ignores its signal, without retry", async () => {
		const controller = new AbortController();
		let requestStarted!: () => void;
		const started = new Promise<void>((resolve) => { requestStarted = resolve; });
		let transportSignal: AbortSignal | null | undefined;
		const fetchMock = mock((_url: string | URL | Request, init?: RequestInit) => {
			transportSignal = init?.signal;
			requestStarted();
			return new Promise<Response>(() => {});
		});
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		const result = callLLM({ tier: "balanced", messages, signal: controller.signal });
		await started;
		controller.abort();
		await expect(result).rejects.toBeInstanceOf(AiCancelledError);
		expect(transportSignal?.aborted).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("abort remains active while a successful response body is being consumed", async () => {
		const controller = new AbortController();
		let bodyStarted!: () => void;
		const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
		const response = jsonResponse(successBody());
		response.json = () => { bodyStarted(); return new Promise(() => {}); };
		const fetchMock = mock(() => Promise.resolve(response));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		const result = callLLM({ tier: "balanced", messages, signal: controller.signal });
		await started;
		controller.abort();
		await expect(result).rejects.toBeInstanceOf(AiCancelledError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("abort remains active while an error body is being consumed", async () => {
		const controller = new AbortController();
		let bodyStarted!: () => void;
		const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
		const response = errorResponse(503, "temporary");
		response.text = () => { bodyStarted(); return new Promise(() => {}); };
		const fetchMock = mock(() => Promise.resolve(response));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		const result = callLLM({ tier: "balanced", messages, signal: controller.signal });
		await started;
		controller.abort();
		await expect(result).rejects.toBeInstanceOf(AiCancelledError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("abort during retry backoff clears its timer and sends no second request", async () => {
		const controller = new AbortController();
		const clears: unknown[] = [];
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout> | undefined) => { clears.push(id); originalClearTimeout(id); }) as typeof clearTimeout;
		globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
			const id = originalSetTimeout(callback, delay, ...args);
			if (delay === 500) { retryTimer = id; controller.abort(); }
			return id;
		}) as typeof setTimeout;
		const fetchMock = mock(() => Promise.resolve(errorResponse(503, "temporary")));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		await expect(callLLM({ tier: "balanced", messages, signal: controller.signal })).rejects.toBeInstanceOf(AiCancelledError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(retryTimer).toBeDefined();
		expect(clears).toContain(retryTimer);
	});

	test("a shared earlier deadline bounds body consumption without retry", async () => {
		const response = jsonResponse(successBody());
		response.json = () => new Promise(() => {});
		const fetchMock = mock(() => Promise.resolve(response));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		const failure = await callLLM({ tier: "balanced", messages, deadlineAtMs: Date.now() + 20 }).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(AiUpstreamError);
		expect((failure as Error).message).toBe("The model request timed out");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("the total deadline includes backoff and cannot restart for the retry", async () => {
		const fetchMock = mock(() => Promise.resolve(errorResponse(503, "temporary")));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		await expect(callLLM({ tier: "balanced", messages, deadlineAtMs: Date.now() + 20 })).rejects.toThrow("timed out");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("expired and nonfinite deadlines make zero provider requests", async () => {
		const fetchMock = mock(() => Promise.resolve(jsonResponse(successBody())));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		await expect(callLLM({ tier: "balanced", messages, deadlineAtMs: Date.now() - 1 })).rejects.toThrow("timed out");
		await expect(callLLM({ tier: "balanced", messages, deadlineAtMs: Number.POSITIVE_INFINITY })).rejects.toBeInstanceOf(AiConfigurationError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("think-hard is capped at ten minutes and normal mode at thirty seconds", async () => {
		process.env.TEMPO_AI_THINK_HARD_MODEL = THINKING_FIXTURE;
		const delays: number[] = [];
		const cleared: unknown[] = [];
		globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
			delays.push(delay ?? 0);
			return originalSetTimeout(callback, delay, ...args);
		}) as typeof setTimeout;
		globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout> | undefined) => { cleared.push(id); originalClearTimeout(id); }) as typeof clearTimeout;
		globalThis.fetch = Object.assign(mock(() => Promise.resolve(jsonResponse(successBody()))), { preconnect: originalFetch.preconnect });
		await callLLM({ tier: "deep", messages, mode: "think_hard", deadlineAtMs: Date.now() + 3_600_000 });
		await callLLM({ tier: "balanced", messages, deadlineAtMs: Date.now() + 3_600_000 });
		expect(delays).toHaveLength(2);
		expect(delays[0]).toBeGreaterThan(590_000);
		expect(delays[0]).toBeLessThanOrEqual(600_000);
		expect(delays[1]).toBeGreaterThan(20_000);
		expect(delays[1]).toBeLessThanOrEqual(30_000);
		expect(cleared).toHaveLength(2);
	});

	test.each([null, {}, { choices: [] }, { choices: [{ message: { content: 42 } }] },
		{ choices: [{ message: { content: " " } }] }, { ...successBody(), usage: { total_tokens: -1 } }])(
		"malformed provider data fails without leaking or retrying: %j", async (body) => {
			const fetchMock = mock(() => Promise.resolve(jsonResponse(body)));
			globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
			const failure = await callLLM({ tier: "balanced", messages }).catch((error: unknown) => error);
			expect(failure).toBeInstanceOf(AiUpstreamError);
			expect((failure as AiUpstreamError).upstream).toBe("");
			expect(fetchMock).toHaveBeenCalledTimes(1);
		},
	);

	test("invalid JSON is a typed nonretrying failure", async () => {
		const fetchMock = mock(() => Promise.resolve(new Response("fictional-not-json")));
		globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
		const failure = await callLLM({ tier: "balanced", messages }).catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(AiUpstreamError);
		expect((failure as AiUpstreamError).upstream).toBe("");
		expect((failure as Error).message).not.toContain("fictional-not-json");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("credential/provider bodies and transport details never escape in errors", async () => {
		globalThis.fetch = Object.assign(mock(() => Promise.resolve(errorResponse(401, "fictional-private-provider-detail"))), { preconnect: originalFetch.preconnect });
		const auth = await callLLM({ tier: "balanced", messages }).catch((error: unknown) => error);
		expect((auth as Error).message).not.toContain("fictional-private-provider-detail");
		globalThis.fetch = Object.assign(mock(() => Promise.reject(new Error("fictional-private-network-detail"))), { preconnect: originalFetch.preconnect });
		const network = await callLLM({ tier: "balanced", messages }).catch((error: unknown) => error);
		expect((network as Error).message).not.toContain("fictional-private-network-detail");
		expect((network as AiUpstreamError).upstream).toBe("");
	});
});
