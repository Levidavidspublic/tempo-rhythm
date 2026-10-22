import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { pingModel } from "./ai_smoke";
import { DEEPINFRA_CHAT_COMPLETIONS_URL } from "./lib/ai_router";

type SmokeResult = {
  model: string;
  content: string;
  totalTokens: number;
  ok: boolean;
  error?: string;
};
const run = (pingModel as unknown as { _handler: () => Promise<SmokeResult> })._handler;
const originalFetch = globalThis.fetch;
const originalModel = process.env.TEMPO_AI_MODEL;
const originalKey = process.env.DEEPINFRA_API_KEY;
const modelFixture = "fixture/smoke-model";
let fetchMock = mock<typeof fetch>(() => Promise.reject(new Error("Unexpected provider request")));

beforeEach(() => {
  process.env.TEMPO_AI_MODEL = modelFixture;
  process.env.DEEPINFRA_API_KEY = "test-key";
  fetchMock = mock<typeof fetch>(() => Promise.reject(new Error("Unexpected provider request")));
  globalThis.fetch = Object.assign(fetchMock, { preconnect: originalFetch.preconnect });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalModel === undefined) delete process.env.TEMPO_AI_MODEL;
  else process.env.TEMPO_AI_MODEL = originalModel;
  if (originalKey === undefined) delete process.env.DEEPINFRA_API_KEY;
  else process.env.DEEPINFRA_API_KEY = originalKey;
});

describe.serial("pingModel settings failures", () => {
  test("missing model settings return a failure object without calling the provider", async () => {
    delete process.env.TEMPO_AI_MODEL;
    expect(await run()).toEqual({
      model: "", content: "", totalTokens: 0, ok: false,
      error: "AiConfigurationError: TEMPO_AI_MODEL needs a supported model identifier in Convex settings",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(["   ", "unsupported model", "https://example.test/model"])(
    "invalid model setting %s returns a failure object without a fallback", async (invalidModel) => {
      process.env.TEMPO_AI_MODEL = invalidModel;
      expect(await run()).toEqual({
        model: "", content: "", totalTokens: 0, ok: false,
        error: "AiConfigurationError: TEMPO_AI_MODEL needs a supported model identifier in Convex settings",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("missing provider credentials preserve the resolved model and make no request", async () => {
    delete process.env.DEEPINFRA_API_KEY;
    expect(await run()).toEqual({
      model: modelFixture, content: "", totalTokens: 0, ok: false,
      error: "AiAuthError: DEEPINFRA_API_KEY not set in Convex env",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a provider rejection keeps the already resolved model even if settings disappear", async () => {
    fetchMock.mockImplementation(async () => {
      delete process.env.TEMPO_AI_MODEL;
      return new Response("synthetic provider rejection", { status: 401 });
    });
    expect(await run()).toEqual({
      model: modelFixture, content: "", totalTokens: 0, ok: false,
      error: "AiAuthError: The model provider rejected its credentials",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a successful smoke request preserves the existing result and request parameters", async () => {
    fetchMock.mockImplementation(async () => Response.json({
      choices: [{ message: { content: "pong" } }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    }));
    expect(await run()).toEqual({ model: modelFixture, content: "pong", totalTokens: 4, ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe(DEEPINFRA_CHAT_COMPLETIONS_URL);
    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toEqual({
      model: modelFixture,
      messages: [{ role: "user", content: "Reply with exactly: pong" }],
      max_tokens: 10, temperature: 0, reasoning_effort: "medium",
    });
  });

  test("invalid provider output returns the established failure shape", async () => {
    fetchMock.mockImplementation(async () => Response.json({ choices: [] }));
    expect(await run()).toEqual({
      model: modelFixture, content: "", totalTokens: 0, ok: false,
      error: "AiUpstreamError: The model returned an invalid response",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
