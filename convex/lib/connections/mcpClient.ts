/**
 * A minimal MCP client over Streamable HTTP (TEMPO-B07-07, #989; research doc §5.4).
 *
 * - Native `fetch` only (HARD_RULES §2), passed in so tests need no network.
 * - JSON-RPC 2.0 over POST. A server may answer `application/json` or `text/event-stream`; both
 *   are read, and an event stream is read only until the answer to our request arrives.
 * - `initialize`, then `notifications/initialized`, then `tools/list` / `tools/call`, reusing
 *   `Mcp-Session-Id` when the server hands one out. Protocol `2025-11-25` (EXTRAPOLATED, doc §5.4:
 *   the v2 build lists it; MCP `2026-07-28` drops `initialize`, which hosted support is UNKNOWN
 *   for, doc §7.1 item 10).
 * - One deadline (15 s) covers the whole session, and at most 100 KB of any answer is read.
 * - The access token is put in the `Authorization` header inside each request and nowhere else.
 *   Errors carry a kind only, never the token, the request or the server's text.
 */
import { isRecord } from "../mcp/jsonrpc";
import { type FetchLike, parseBearerChallenge, readCappedText } from "./oauth";

export const MCP_CLIENT_LIMITS = {
  protocolVersion: "2025-11-25",
  /** The whole session: initialize, list and call. */
  timeoutMs: 15_000,
  /** Largest answer read (doc §4.6: Executor's own output cap). */
  maxResponseBytes: 100 * 1024,
  /** Most `tools/list` pages followed. */
  maxToolPages: 3,
} as const;

export type McpErrorKind =
  | "network"
  | "timeout"
  | "unauthorized"
  | "insufficient_scope"
  | "forbidden"
  | "rate_limited"
  | "upstream"
  | "bad_response"
  | "rpc_error"
  | "too_large";

/** A failed MCP request. The message is the kind only. */
export class McpCallError extends Error {
  readonly kind: McpErrorKind;
  constructor(kind: McpErrorKind) {
    super(`mcp request failed (${kind})`);
    this.name = "McpCallError";
    this.kind = kind;
  }
}

export type McpToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type McpTool = {
  name: string;
  inputSchema?: unknown;
  annotations?: McpToolAnnotations;
};

export type McpToolResult = {
  /** The `tools/call` result object, unparsed. The caller keeps only a summary of it. */
  result: Record<string, unknown>;
  isError: boolean;
  /** Size of the answer's body in bytes. */
  bytes: number;
};

export type McpSession = {
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult>;
  /** Stops the deadline timer. Call when done. */
  close(): void;
};

function statusError(response: Response): McpCallError {
  if (response.status === 401) return new McpCallError("unauthorized");
  if (response.status === 403) {
    const challenge = parseBearerChallenge(response.headers.get("WWW-Authenticate"));
    return new McpCallError(challenge?.error === "insufficient_scope" ? "insufficient_scope" : "forbidden");
  }
  if (response.status === 429) return new McpCallError("rate_limited");
  if (response.status >= 500 || response.status === 404) return new McpCallError("upstream");
  return new McpCallError("bad_response");
}

/** The JSON payloads of the complete events in an SSE text (`data:` lines joined). */
export function parseSseEvents(text: string): unknown[] {
  const out: unknown[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) continue;
    try {
      out.push(JSON.parse(data));
    } catch {
      // Not JSON: not an answer.
    }
  }
  return out;
}

/** The JSON-RPC response to `id` among `messages`, or undefined. */
function answerTo(messages: unknown[], id: number): Record<string, unknown> | undefined {
  for (const message of messages) {
    if (isRecord(message) && message.jsonrpc === "2.0" && message.id === id && ("result" in message || "error" in message)) {
      return message;
    }
  }
  return undefined;
}

/**
 * Reads an event stream until the answer to `id` arrives (then stops reading), at most `max`
 * bytes in all.
 */
async function readSseAnswer(
  response: Response,
  id: number,
  max: number,
): Promise<{ answer: Record<string, unknown>; bytes: number }> {
  if (!response.body) {
    const text = await readCappedText(response, max);
    if (text === null) throw new McpCallError("too_large");
    const answer = answerTo(parseSseEvents(text), id);
    if (!answer) throw new McpCallError("bad_response");
    return { answer, bytes: new TextEncoder().encode(text).length };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        total += value.byteLength;
        if (total > max) throw new McpCallError("too_large");
        buffer += decoder.decode(value, { stream: true });
      }
      if (done) buffer += `${decoder.decode()}\n\n`;
      // Only complete events (ending in a blank line) are read; the rest waits for more bytes.
      const end = Math.max(buffer.lastIndexOf("\n\n"), buffer.lastIndexOf("\r\n\r\n"));
      if (end >= 0) {
        const answer = answerTo(parseSseEvents(buffer.slice(0, end)), id);
        if (answer) return { answer, bytes: total };
      }
      if (done) throw new McpCallError("bad_response");
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/** The JSON-RPC answer to request `id` in `response`, by its content type. */
async function readAnswer(
  response: Response,
  id: number,
  max: number,
): Promise<{ answer: Record<string, unknown>; bytes: number }> {
  const type = (response.headers.get("Content-Type") ?? "").toLowerCase();
  if (type.includes("text/event-stream")) {
    return readSseAnswer(response, id, max);
  }
  const text = await readCappedText(response, max);
  if (text === null) throw new McpCallError("too_large");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new McpCallError("bad_response");
  }
  const answer = answerTo(Array.isArray(json) ? json : [json], id);
  if (!answer) throw new McpCallError("bad_response");
  return { answer, bytes: new TextEncoder().encode(text).length };
}

function readAnnotations(value: unknown): McpToolAnnotations | undefined {
  if (!isRecord(value)) return undefined;
  const out: McpToolAnnotations = {};
  for (const key of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const) {
    if (typeof value[key] === "boolean") out[key] = value[key] as boolean;
  }
  return out;
}

/**
 * Opens a session against `url` with `accessToken`. The first `listTools` / `callTool` runs
 * `initialize` first. One deadline covers everything until `close`.
 */
export function openMcpSession(
  fetchImpl: FetchLike,
  options: { url: string; accessToken: string; timeoutMs?: number },
): McpSession {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? MCP_CLIENT_LIMITS.timeoutMs);
  let nextId = 1;
  let sessionId: string | null = null;
  let protocolVersion: string | null = null;
  let ready: Promise<void> | null = null;

  async function post(body: Record<string, unknown>): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${options.accessToken}`,
    };
    if (protocolVersion) headers["MCP-Protocol-Version"] = protocolVersion;
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;
    try {
      return await fetchImpl(options.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
        // The bearer token never follows a redirect to another place.
        redirect: "error",
      });
    } catch {
      throw new McpCallError(controller.signal.aborted ? "timeout" : "network");
    }
  }

  async function rpc(method: string, params: Record<string, unknown>) {
    const id = nextId;
    nextId += 1;
    const response = await post({ jsonrpc: "2.0", id, method, params });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw statusError(response);
    }
    let read: { answer: Record<string, unknown>; bytes: number };
    try {
      read = await readAnswer(response, id, MCP_CLIENT_LIMITS.maxResponseBytes);
    } catch (error) {
      if (error instanceof McpCallError) throw error;
      throw new McpCallError(controller.signal.aborted ? "timeout" : "bad_response");
    }
    if ("error" in read.answer || !isRecord(read.answer.result)) {
      throw new McpCallError("rpc_error");
    }
    return { result: read.answer.result as Record<string, unknown>, bytes: read.bytes, response };
  }

  async function initialize(): Promise<void> {
    const { result, response } = await rpc("initialize", {
      protocolVersion: MCP_CLIENT_LIMITS.protocolVersion,
      capabilities: {},
      clientInfo: { name: "Tempo", version: "1.0.0" },
    });
    sessionId = response.headers.get("Mcp-Session-Id");
    protocolVersion =
      typeof result.protocolVersion === "string" && result.protocolVersion
        ? result.protocolVersion
        : MCP_CLIENT_LIMITS.protocolVersion;
    const note = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    await note.body?.cancel().catch(() => {});
    // Only a refused token matters here; a server that ignores the notice is fine.
    if (note.status === 401 || note.status === 403) throw statusError(note);
  }

  function ensureReady(): Promise<void> {
    ready ??= initialize();
    return ready;
  }

  return {
    async listTools() {
      await ensureReady();
      const tools: McpTool[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MCP_CLIENT_LIMITS.maxToolPages; page += 1) {
        const { result } = await rpc("tools/list", cursor ? { cursor } : {});
        const list = Array.isArray(result.tools) ? result.tools : [];
        for (const tool of list) {
          if (!isRecord(tool) || typeof tool.name !== "string") continue;
          const annotations = readAnnotations(tool.annotations);
          tools.push({
            name: tool.name,
            ...(tool.inputSchema !== undefined ? { inputSchema: tool.inputSchema } : {}),
            ...(annotations ? { annotations } : {}),
          });
        }
        cursor = typeof result.nextCursor === "string" && result.nextCursor ? result.nextCursor : undefined;
        if (!cursor) break;
      }
      return tools;
    },
    async callTool(name, args) {
      await ensureReady();
      const { result, bytes } = await rpc("tools/call", { name, arguments: args });
      return { result, isError: result.isError === true, bytes };
    },
    close() {
      clearTimeout(timer);
    },
  };
}
