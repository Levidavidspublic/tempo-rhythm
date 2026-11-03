import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	AiAuthError,
	AiContextTooLargeError,
	AiRateLimitedError,
	AiUpstreamError,
} from "./ai_errors";
import { callLLM, DEEPINFRA_CHAT_COMPLETIONS_URL, DEFAULT_AI_MODEL } from "./ai_router";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.DEEPINFRA_API_KEY;
const originalModel = process.env.TEMPO_AI_MODEL;

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
	delete process.env.TEMPO_AI_MODEL;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
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
});

describe("callLLM", () => {
	test("throws AiAuthError when DEEPINFRA_API_KEY is missing", async () => {
		delete process.env.DEEPINFRA_API_KEY;
		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] }),
		).rejects.toBeInstanceOf(AiAuthError);
	});

	test("returns parsed content on success", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(jsonResponse(successBody('{"plan":true}'))),
		);

		const result = await callLLM({
			tier: "fast",
			messages: [{ role: "user", content: "hi" }],
			responseFormat: "json_object",
		});

		expect(result.content).toBe('{"plan":true}');
		expect(result.tier).toBe("fast");
		expect(result.model).toBe(DEFAULT_AI_MODEL);
		expect(result.escalated).toBe(false);
		expect(result.usage.totalTokens).toBe(15);
	});

	test("throws AiAuthError on HTTP 401 without retrying", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(401, "bad key")),
		);
		globalThis.fetch = fetchMock;

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

		globalThis.fetch = fetchMock;

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
		globalThis.fetch = fetchMock;

		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] }),
		).rejects.toBeInstanceOf(AiRateLimitedError);

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	test("posts to DeepInfra's OpenAI-compatible endpoint with DeepSeek V4.1 Flash by default", async () => {
		const fetchMock = mock((url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { model: string };
			expect(String(url)).toBe(DEEPINFRA_CHAT_COMPLETIONS_URL);
			expect(body.model).toBe("deepseek-ai/DeepSeek-V4.1-Flash");
			return Promise.resolve(jsonResponse(successBody("ok")));
		});
		globalThis.fetch = fetchMock;

		for (const tier of ["fast", "balanced", "deep"] as const) {
			const result = await callLLM({ tier, messages: [{ role: "user", content: "hi" }] });
			expect(result.model).toBe(DEFAULT_AI_MODEL);
			expect(result.escalated).toBe(false);
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	test("TEMPO_AI_MODEL overrides the model in one place", async () => {
		process.env.TEMPO_AI_MODEL = "deepseek-ai/DeepSeek-V4-Flash";
		const fetchMock = mock((_url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body)) as { model: string };
			expect(body.model).toBe("deepseek-ai/DeepSeek-V4-Flash");
			return Promise.resolve(jsonResponse(successBody("ok")));
		});
		globalThis.fetch = fetchMock;

		const result = await callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] });
		expect(result.model).toBe("deepseek-ai/DeepSeek-V4-Flash");
	});

	test("context-too-large surfaces without retry (single model, nothing to escalate to)", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(400, JSON.stringify({ error: "context_length_exceeded" }))),
		);
		globalThis.fetch = fetchMock;

		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "big" }] }),
		).rejects.toBeInstanceOf(AiContextTooLargeError);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("throws AiContextTooLargeError when deep tier still exceeds context", async () => {
		globalThis.fetch = mock(() =>
			Promise.resolve(
				errorResponse(400, "maximum context length exceeded for this model"),
			),
		);

		await expect(
			callLLM({ tier: "deep", messages: [{ role: "user", content: "huge" }] }),
		).rejects.toBeInstanceOf(AiContextTooLargeError);
	});

	test("retries once on HTTP 503 then surfaces AiUpstreamError", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(errorResponse(503, "unavailable")),
		);
		globalThis.fetch = fetchMock;

		await expect(
			callLLM({ tier: "fast", messages: [{ role: "user", content: "hi" }] }),
		).rejects.toBeInstanceOf(AiUpstreamError);

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
