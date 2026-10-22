import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { resolveAiModel } from "./lib/ai_router";
import { auth } from "./auth";
import { executorCallback } from "./connectionsHttp";
import { mcpNotAllowed, mcpOptions, mcpPost } from "./mcpHttp";
import { revenueCatWebhook } from "./revenuecat";

const http = httpRouter();

// Convex Auth routes (sign-in, sign-out, session management)
auth.addHttpRoutes(http);

// RevenueCat subscription webhook
// Called by RevenueCat on: INITIAL_PURCHASE, RENEWAL, EXPIRATION, CANCELLATION, etc.
// Requires: REVENUECAT_WEBHOOK_SECRET env var set in Convex dashboard
http.route({
  path: "/api/revenuecat-webhook",
  method: "POST",
  handler: revenueCatWebhook,
});

// MCP server (Streamable HTTP, stateless). Auth: personal token, see convex/mcp.ts.
http.route({ path: "/mcp", method: "POST", handler: mcpPost });
http.route({ path: "/mcp", method: "GET", handler: mcpNotAllowed });
http.route({ path: "/mcp", method: "DELETE", handler: mcpNotAllowed });
http.route({ path: "/mcp", method: "OPTIONS", handler: mcpOptions });

// Executor connection: the OAuth callback (TEMPO-B07-07, see convex/connections.ts).
http.route({
  path: "/connections/executor/callback",
  method: "GET",
  handler: executorCallback,
});

// The callback is a deterministic adapter, never a second model or a second coach.
// Activation remains off until the documented provider-history conformance is observed.
const AGENT_BODY_BYTES = 65_536;
const AGENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT_FUNCTION = "tempo_coach_reply";
type AgentRequest = { stream: boolean } & (
  | { kind: "speech"; text: string; parentId?: string }
  | { kind: "answer"; functionId: string }
);
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** Provider history supplies an untrusted input and anchor, never owner/model/context authority. */
export function parseAgentRequest(value: unknown): AgentRequest {
  if (
    !object(value) ||
    (value.stream !== undefined && typeof value.stream !== "boolean") ||
    !Array.isArray(value.messages) ||
    value.messages.length === 0 ||
    value.messages.length > 64
  )
    throw new Error("invalid_request");
  let pending: string | undefined;
  let parentId: string | undefined;
  const seen = new Set<string>();
  for (let index = 0; index < value.messages.length; index += 1) {
    const message: unknown = value.messages[index];
    if (!object(message) || !["system", "user", "assistant", "tool"].includes(String(message.role)))
      throw new Error("invalid_message");
    if (
      message.content !== null &&
      message.content !== undefined &&
      typeof message.content !== "string"
    )
      throw new Error("invalid_content");
    const last = index === value.messages.length - 1;
    if (message.role === "assistant" && message.tool_calls !== undefined) {
      if (pending || !Array.isArray(message.tool_calls) || message.tool_calls.length !== 1)
        throw new Error("invalid_function");
      const call: unknown = message.tool_calls[0];
      if (
        !object(call) ||
        typeof call.id !== "string" ||
        !AGENT_UUID.test(call.id) ||
        seen.has(call.id) ||
        call.type !== "function" ||
        !object(call.function) ||
        call.function.name !== AGENT_FUNCTION
      )
        throw new Error("invalid_function");
      pending = call.id;
      seen.add(call.id);
    } else if (message.role === "tool") {
      if (!pending || message.tool_call_id !== pending || typeof message.content !== "string")
        throw new Error("invalid_anchor");
      parentId = pending;
      pending = undefined;
      if (last)
        return {
          kind: "answer",
          functionId: parentId,
          stream: value.stream === true,
        };
    } else if (pending) {
      throw new Error("missing_function_result");
    }
    if (last && message.role === "user") {
      if (typeof message.content !== "string" || message.content.length > 4_000)
        throw new Error("invalid_speech");
      const text = message.content.normalize("NFC").replace(/\s+/g, " ").trim();
      if (!text) throw new Error("invalid_speech");
      return {
        kind: "speech",
        text,
        ...(parentId ? { parentId } : {}),
        stream: value.stream === true,
      };
    }
  }
  throw new Error("missing_turn");
}
/** Enforce the bound while reading, including absent or dishonest Content-Length headers. */
export async function readAgentBody(request: Request, deadlineMs = 5_000): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  )
    throw new Error("invalid_content_type");
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > AGENT_BODY_BYTES))
    throw new Error("body_too_large");
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let rejectDeadline!: (reason: Error) => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject;
  });
  const abort = () => {
    rejectDeadline(new Error("body_interrupted"));
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(abort, Math.max(1, Math.min(deadlineMs, 5_000)));
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    if (request.signal.aborted) throw new Error("body_interrupted");
    for (;;) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > AGENT_BODY_BYTES) throw new Error("body_too_large");
      chunks.push(part.value);
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export function agentCompletion(args: {
  stream: boolean;
  model: string;
  id: string;
  result:
    | { kind: "answer"; content: string }
    | { kind: "function"; functionId: string; text: string; receipt: string };
}): Response {
  const { result } = args;
  const head = {
    id: `chatcmpl-${args.id}`,
    created: Math.floor(Date.now() / 1_000),
    model: args.model,
  };
  const tool =
    result.kind === "function"
      ? {
          id: result.functionId,
          type: "function",
          function: {
            name: AGENT_FUNCTION,
            arguments: JSON.stringify({
              text: result.text,
              receipt: result.receipt,
            }),
          },
        }
      : null;
  const finish = tool ? "tool_calls" : "stop";
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!args.stream)
    return Response.json(
      {
        ...head,
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: tool
              ? { role: "assistant", content: null, tool_calls: [tool] }
              : {
                  role: "assistant",
                  content: result.kind === "answer" ? result.content : "",
                },
            finish_reason: finish,
          },
        ],
      },
      { headers }
    );
  const delta = tool
    ? { role: "assistant", tool_calls: [{ index: 0, ...tool }] }
    : {
        role: "assistant",
        content: result.kind === "answer" ? result.content : "",
      };
  const chunk = (value: unknown, reason: string | null) =>
    JSON.stringify({
      ...head,
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: value, finish_reason: reason }],
    });
  return new Response(
    `data: ${chunk(delta, null)}\n\ndata: ${chunk({}, finish)}\n\ndata: [DONE]\n\n`,
    { headers: { ...headers, "Content-Type": "text/event-stream" } }
  );
}
function agentConfig(): { enabled: false } | { enabled: true; model: string; endpoint: string } {
  if (
    process.env.TEMPO_VOICE_AGENT_ENABLED !== "true" ||
    !process.env.DEEPGRAM_API_KEY ||
    !process.env.DEEPINFRA_API_KEY
  )
    return { enabled: false };
  try {
    const site = new URL(process.env.CONVEX_SITE_URL ?? "");
    if (site.protocol !== "https:" || site.username || site.password || site.search || site.hash)
      return { enabled: false };
    return {
      enabled: true,
      model: resolveAiModel(),
      endpoint: new URL("/voice/agent/think", site).href,
    };
  } catch {
    return { enabled: false };
  }
}
export const voiceAgentConfig = httpAction(async () =>
  Response.json(agentConfig(), {
    // Public availability only: no account, token, key or lease. No credentialed CORS.
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  })
);
export const voiceAgentThink = httpAction(async (ctx, request) => {
  const config = agentConfig();
  if (!config.enabled) return new Response(null, { status: 404 });
  const capability = request.headers
    .get("authorization")
    ?.match(/^Bearer ([0-9a-f-]{36}\.[0-9a-f-]{36})$/i)?.[1];
  const sessionId = request.headers.get("x-tempo-voice-session");
  if (!capability || !sessionId || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId))
    return new Response(null, { status: 401 });
  try {
    const input = parseAgentRequest(await readAgentBody(request));
    if (request.signal.aborted) return new Response(null, { status: 409 });
    const key = { sessionId: sessionId as Id<"voiceSessions">, capability };
    // Both functions validate the capability against the live owned lease and current budgets.
    // The supplied history's model, instructions, result text and identities are never forwarded.
    if (input.kind === "answer") {
      const answer = await ctx.runQuery(internal.voice.canonicalAgentAnswer, {
        ...key,
        functionId: input.functionId,
      });
      if (answer.status !== "ready" || request.signal.aborted)
        return new Response(null, { status: 409 });
      return agentCompletion({
        stream: input.stream,
        model: config.model,
        id: input.functionId,
        result: { kind: "answer", content: answer.content },
      });
    }
    const prepared = await ctx.runMutation(internal.voice.prepareAgentFunction, {
      ...key,
      text: input.text,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    });
    if (prepared.status !== "ready" || request.signal.aborted)
      return new Response(null, { status: 409 });
    return agentCompletion({
      stream: input.stream,
      model: config.model,
      id: prepared.functionId,
      result: {
        kind: "function",
        functionId: prepared.functionId,
        receipt: prepared.receipt,
        text: input.text,
      },
    });
  } catch {
    // Never echo capability, provider body, transcript or backend exception in public responses.
    return new Response(null, { status: 400 });
  }
});
http.route({
  path: "/voice/agent/config",
  method: "GET",
  handler: voiceAgentConfig,
});
http.route({
  path: "/voice/agent/think",
  method: "POST",
  handler: voiceAgentThink,
});

export default http;
