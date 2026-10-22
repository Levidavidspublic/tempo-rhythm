import {
  AiAuthError,
  AiCancelledError,
  AiConfigurationError,
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
  signal?: AbortSignal;
  mode?: "default" | "think_hard";
  reasoning?: "medium" | "high";
  /** Absolute caller deadline; it may shorten, but never extend, the mode's total budget. */
  deadlineAtMs?: number;
};

/**
 * All text generation stays behind this native-fetch seam. Model identifiers are Convex
 * deployment settings, never fallbacks in source. Configure verified serving identifiers for
 * the owner's requested default and think-hard models before enabling them. The provider's
 * reasoning_effort contract is documented in DeepInfra's chat/reasoning documentation.
 */
export const DEEPINFRA_CHAT_COMPLETIONS_URL =
  "https://api.deepinfra.com/v1/openai/chat/completions";

const DEFAULT_DEADLINE_MS = 30_000;
const MAX_DEADLINE_MS = 600_000;
const RETRY_DELAY_MS = 500;

function configuredModel(name: "TEMPO_AI_MODEL" | "TEMPO_AI_THINK_HARD_MODEL"): string {
  const value = process.env[name]?.trim();
  // A model identifier is data, not a URL, header, prompt or arbitrary configuration object.
  if (!value || value.length > 200 || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value)) {
    throw new AiConfigurationError(`${name} needs a supported model identifier in Convex settings`);
  }
  return value;
}

export function resolveAiModel(mode: "default" | "think_hard" = "default"): string {
  const normal = configuredModel("TEMPO_AI_MODEL");
  if (mode === "default") return normal;
  if (mode !== "think_hard") throw new AiConfigurationError("Unsupported model mode");
  const thinking = configuredModel("TEMPO_AI_THINK_HARD_MODEL");
  if (thinking === normal) {
    throw new AiConfigurationError("Think hard needs a separate model identifier in Convex settings");
  }
  return thinking;
}

function reasoningFor(opts: AiCallOptions): "medium" | "high" {
  if (opts.reasoning !== undefined && opts.reasoning !== "medium" && opts.reasoning !== "high") {
    throw new AiConfigurationError("Unsupported reasoning effort");
  }
  if (opts.mode === "think_hard" || opts.reasoning === "high") return "high";
  if (opts.reasoning === "medium") return "medium";
  // A bounded, deterministic default for substantial user input. System prompts and old
  // conversation history do not silently raise effort; callers may explicitly choose high.
  let latest = "";
  for (let index = opts.messages.length - 1; index >= 0; index--) {
    if (opts.messages[index]?.role === "user") {
      latest = opts.messages[index]!.content;
      break;
    }
  }
  return latest.length >= 8_000 ? "high" : "medium";
}

/** One timer/controller covers fetch headers, response consumption and the one retry. */
function callBudget(opts: AiCallOptions) {
  if (opts.deadlineAtMs !== undefined && !Number.isFinite(opts.deadlineAtMs)) {
    throw new AiConfigurationError("The model request deadline must be finite");
  }
  const controller = new AbortController();
  const duration = opts.mode === "think_hard" ? MAX_DEADLINE_MS : DEFAULT_DEADLINE_MS;
  const deadline = Math.min(Date.now() + duration, opts.deadlineAtMs ?? Number.POSITIVE_INFINITY);
  let failure: AiCancelledError | AiUpstreamError | undefined;
  const abort = (error: AiCancelledError | AiUpstreamError) => {
    if (controller.signal.aborted) return;
    failure = error;
    controller.abort();
  };
  const cancelled = () => abort(new AiCancelledError("The model request was cancelled"));
  opts.signal?.addEventListener("abort", cancelled, { once: true });
  if (opts.signal?.aborted) cancelled();
  const timeout = () => abort(new AiUpstreamError("The model request timed out", 0, ""));
  const remaining = deadline - Date.now();
  const timer = remaining > 0 ? setTimeout(timeout, remaining) : undefined;
  if (remaining <= 0) timeout();

  const check = () => {
    if (!controller.signal.aborted && Date.now() >= deadline) timeout();
    if (failure) throw failure;
  };
  async function run<T>(work: () => Promise<T>): Promise<T> {
    check();
    // Racing the abort also bounds a body/mock transport that does not honor AbortSignal.
    // Both outcomes retain handlers, so a late rejection cannot become unhandled.
    let onAbort: (() => void) | undefined;
    try {
      return await new Promise<T>((resolve, reject) => {
        onAbort = () => reject(failure);
        controller.signal.addEventListener("abort", onAbort, { once: true });
        Promise.resolve().then(() => { check(); return work(); }).then(
          (value) => { try { check(); resolve(value); } catch (error) { reject(error); } },
          (error: unknown) => reject(failure ?? error),
        );
      });
    } finally {
      if (onAbort) controller.signal.removeEventListener("abort", onAbort);
    }
  }
  return {
    signal: controller.signal,
    check,
    run,
    async backoff() {
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await run(() => new Promise<void>((resolve) => { retryTimer = setTimeout(resolve, RETRY_DELAY_MS); }));
      } finally {
        if (retryTimer !== undefined) clearTimeout(retryTimer);
      }
    },
    close() {
      if (timer !== undefined) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", cancelled);
    },
  };
}

const CONTEXT_TOO_LARGE_PHRASES = ["context_length_exceeded", "too long", "maximum context length"];

function isContextTooLarge(body: string): boolean {
  return CONTEXT_TOO_LARGE_PHRASES.some((phrase) => body.toLowerCase().includes(phrase));
}

function responseResult(json: unknown, opts: AiCallOptions, model: string): AiResult {
  const invalid = () => new AiUpstreamError("The model returned an invalid response", 200, "");
  if (!json || typeof json !== "object") throw invalid();
  const body = json as { choices?: { message?: { content?: unknown } }[]; usage?: unknown };
  if (!Array.isArray(body.choices)) throw invalid();
  const content = body.choices[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw invalid();
  if (body.usage !== undefined && (!body.usage || typeof body.usage !== "object" || Array.isArray(body.usage))) {
    throw invalid();
  }
  const usage = (body.usage ?? {}) as Record<string, unknown>;
  const count = (name: string) => {
    const value = usage[name];
    if (value === undefined) return 0;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid();
    return value;
  };
  return {
    tier: opts.tier,
    requestedTier: opts.tier,
    model,
    content,
    usage: {
      promptTokens: count("prompt_tokens"),
      completionTokens: count("completion_tokens"),
      totalTokens: count("total_tokens"),
    },
    escalated: false,
  };
}

async function attemptCall(
  opts: AiCallOptions,
  apiKey: string,
  model: string,
  reasoning: "medium" | "high",
  budget: ReturnType<typeof callBudget>,
): Promise<AiResult> {
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    reasoning_effort: reasoning,
  };
  if (opts.responseFormat === "json_object") body.response_format = { type: "json_object" };
  let response: Response;
  try {
    response = await budget.run(() => fetch(DEEPINFRA_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: budget.signal,
    }));
  } catch {
    budget.check();
    throw new AiUpstreamError("The model provider could not be reached", 0, "");
  }

  if (!response.ok) {
    let text: string;
    try { text = await budget.run(() => response.text()); }
    catch { budget.check(); throw new AiUpstreamError("The model response could not be read", response.status, ""); }
    if (response.status === 401) throw new AiAuthError("The model provider rejected its credentials");
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      const retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_DEADLINE_MS) : undefined;
      throw new AiRateLimitedError("Rate limited by the model provider", retryAfterMs);
    }
    if (response.status === 400 && isContextTooLarge(text)) {
      throw new AiContextTooLargeError("The input exceeds the model context limit");
    }
    throw new AiUpstreamError(`The model provider returned HTTP ${response.status}`, response.status, "");
  }

  let json: unknown;
  try { json = await budget.run(() => response.json()); }
  catch { budget.check(); throw new AiUpstreamError("The model returned invalid JSON", response.status, ""); }
  return responseResult(json, opts, model);
}

export async function callLLM(opts: AiCallOptions): Promise<AiResult> {
  if (opts.signal?.aborted) throw new AiCancelledError("The model request was cancelled");
  const apiKey = process.env.DEEPINFRA_API_KEY;
  if (!apiKey) throw new AiAuthError("DEEPINFRA_API_KEY not set in Convex env");
  // Resolve once: configuration changing during retry cannot switch a request's model.
  const model = resolveAiModel(opts.mode);
  const reasoning = reasoningFor(opts);
  const budget = callBudget(opts);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await attemptCall(opts, apiKey, model, reasoning, budget);
      } catch (error) {
        budget.check();
        const retryable = error instanceof AiRateLimitedError ||
          (error instanceof AiUpstreamError && (error.status === 0 || error.status >= 500));
        if (!retryable || attempt === 1) throw error;
        await budget.backoff();
      }
    }
    throw new AiUpstreamError("Unexpected exit from the model request", 0, "");
  } finally {
    budget.close();
  }
}
