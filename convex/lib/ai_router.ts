import {
  AiAuthError,
  AiContextTooLargeError,
  AiRateLimitedError,
  AiUpstreamError,
} from "./ai_errors";

export type AiTier = "fast" | "balanced" | "deep";
export type AiMessage = { role: "system" | "user" | "assistant"; content: string };
export type AiResult = {
  tier: AiTier;
  requestedTier: AiTier;
  model: string;
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  escalated: boolean;
};
export type AiCallOptions = {
  tier: AiTier;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json_object";
};

/**
 * ONE place for Tempo's text model (TEMPO-GATE-01 / Amit 6 Oct: "DeepSeek 4.1 Flash via DeepInfra").
 * Every Tempo AI call (brain dump, nag phrase suggestions, memory extraction, future coach)
 * goes through callLLM -> DeepInfra's OpenAI-compatible endpoint.
 * - Model: Convex env TEMPO_AI_MODEL, default `deepseek-ai/DeepSeek-V4.1-Flash`
 *   (exact id from DeepInfra GET /v1/openai/models, 6 Oct 2026).
 * - Key: Convex env DEEPINFRA_API_KEY.
 * Tiers are kept for callers but all map to the same model for now (TRD "Text, interim").
 */
export const DEFAULT_AI_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash";
export const DEEPINFRA_CHAT_COMPLETIONS_URL =
  "https://api.deepinfra.com/v1/openai/chat/completions";

export function resolveAiModel(): string {
  const fromEnv = process.env.TEMPO_AI_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_AI_MODEL;
}

const CONTEXT_TOO_LARGE_PHRASES = [
  "context_length_exceeded",
  "too long",
  "maximum context length",
];

function isContextTooLarge(body: string): boolean {
  const lower = body.toLowerCase();
  return CONTEXT_TOO_LARGE_PHRASES.some((p) => lower.includes(p));
}

async function attemptCall(
  tier: AiTier,
  opts: AiCallOptions,
  apiKey: string,
): Promise<AiResult & { requestedTier: AiTier }> {
  const model = resolveAiModel();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    const body: Record<string, unknown> = {
      model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.3,
    };
    if (opts.responseFormat === "json_object") {
      body.response_format = { type: "json_object" };
    }

    response = await fetch(DEEPINFRA_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted"));
    throw new AiUpstreamError(
      isAbort ? "Request timed out after 30s" : String(err),
      0,
      String(err),
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new AiAuthError(`DeepInfra auth failed: ${text.slice(0, 200)}`);
    }
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? parseFloat(retryAfterHeader) * 1000 : undefined;
      throw new AiRateLimitedError(`Rate limited by DeepInfra`, retryAfterMs);
    }
    if (response.status === 400 && isContextTooLarge(text)) {
      throw new AiContextTooLargeError(`Context too large for model ${model}`);
    }
    throw new AiUpstreamError(
      `DeepInfra returned HTTP ${response.status}`,
      response.status,
      text.slice(0, 200),
    );
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  return {
    tier,
    requestedTier: opts.tier,
    model,
    content: json.choices[0]?.message?.content ?? "",
    usage: {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
    },
    escalated: tier !== opts.tier,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callLLM(opts: AiCallOptions): Promise<AiResult> {
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) {
    throw new AiAuthError("DEEPINFRA_API_KEY not set in Convex env");
  }

  // One model for every tier, so there is nothing to escalate to: a context-too-large
  // error surfaces to the caller. Rate-limit / upstream errors get one retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await attemptCall(opts.tier, opts, apiKey);
    } catch (err) {
      const retryable = err instanceof AiRateLimitedError || err instanceof AiUpstreamError;
      if (retryable && attempt === 0) {
        await sleep(500);
        continue;
      }
      throw err;
    }
  }

  // Unreachable, but satisfies TypeScript.
  throw new AiUpstreamError("Unexpected exit from callLLM", 0, "");
}
