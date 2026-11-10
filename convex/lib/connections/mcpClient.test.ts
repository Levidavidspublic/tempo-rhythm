import { describe, expect, test } from "bun:test";
import { FAKE, SEARCH_RESULT, SECRETS, fakeExecutor } from "./fakeExecutor.testkit";
import { MCP_CLIENT_LIMITS, McpCallError, openMcpSession, parseSseEvents } from "./mcpClient";
import type { FetchLike } from "./oauth";

async function failure(run: () => Promise<unknown>): Promise<McpCallError> {
  const error = await run().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(McpCallError);
  return error as McpCallError;
}

function connected(options: Parameters<typeof fakeExecutor>[0] = {}) {
  const executor = fakeExecutor(options);
  executor.issue(SECRETS.access1);
  return executor;
}

describe("the MCP client", () => {
  test("initialize, initialized, then list and call, with the bearer header and the session id", async () => {
    const executor = connected();
    const session = openMcpSession(executor.fetch, { url: FAKE.mcpUrl, accessToken: SECRETS.access1 });
    const tools = await session.listTools();
    const call = await session.callTool("search", { query: "calendar" });
    session.close();

    expect(tools).toEqual([
      {
        name: "search",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
    ]);
    expect(call.isError).toBe(false);
    expect(call.result).toEqual(SEARCH_RESULT);
    expect(call.bytes).toBeGreaterThan(0);
    expect(executor.mcpMethods()).toEqual(["initialize", "notifications/initialized", "tools/list", "tools/call"]);
    const [init, ...rest] = executor.mcpCalls();
    expect(init?.headers.authorization).toBe(`Bearer ${SECRETS.access1}`);
    expect(init?.headers.accept).toBe("application/json, text/event-stream");
    expect(init?.headers["mcp-session-id"]).toBeUndefined();
    for (const later of rest) {
      expect(later.headers["mcp-session-id"]).toBe(FAKE.sessionId);
      expect(later.headers["mcp-protocol-version"]).toBe(MCP_CLIENT_LIMITS.protocolVersion);
    }
    // The token travels in the header only, never in the URL or the body.
    for (const c of executor.calls) {
      expect(c.url).not.toContain(SECRETS.access1);
      expect(c.body).not.toContain(SECRETS.access1);
    }
  });

  test("an event-stream answer is read up to our response", async () => {
    const executor = connected({ sse: true });
    const session = openMcpSession(executor.fetch, { url: FAKE.mcpUrl, accessToken: SECRETS.access1 });
    const call = await session.callTool("search", { query: "x" });
    session.close();
    expect(call.result).toEqual(SEARCH_RESULT);
    expect(parseSseEvents('data: {"a":1}\n\ndata: not json\n\n: comment\n\ndata: {"b":\ndata: 2}\n\n')).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
  });

  test("an event stream that never closes still ends once our answer arrives", async () => {
    const encoder = new TextEncoder();
    const streaming: FetchLike = async (_url, init) => {
      const rpc = JSON.parse(String(init?.body)) as { id?: number; method: string };
      if (rpc.id === undefined) return new Response(null, { status: 202 });
      const answer =
        rpc.method === "initialize"
          ? { jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: "2025-11-25" } }
          : { jsonrpc: "2.0", id: rpc.id, result: { tools: [] } };
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(answer)}\n\n`));
          // Never closed: the client must stop reading on its own.
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    };
    const session = openMcpSession(streaming, { url: FAKE.mcpUrl, accessToken: "t", timeoutMs: 2_000 });
    expect(await session.listTools()).toEqual([]);
    session.close();
  });

  test("HTTP statuses become kinds: 401, 403 insufficient_scope, 429, 5xx", async () => {
    const cases: Array<[number, Record<string, string>, string]> = [
      [401, {}, "unauthorized"],
      [403, { "WWW-Authenticate": 'Bearer error="insufficient_scope", scope="more"' }, "insufficient_scope"],
      [403, {}, "forbidden"],
      [429, {}, "rate_limited"],
      [502, {}, "upstream"],
      [400, {}, "bad_response"],
    ];
    for (const [status, headers, kind] of cases) {
      const fetchImpl: FetchLike = async () => new Response("SERVER-TEXT", { status, headers });
      const session = openMcpSession(fetchImpl, { url: FAKE.mcpUrl, accessToken: SECRETS.access1 });
      const error = await failure(() => session.listTools());
      session.close();
      expect(error.kind).toBe(kind as McpCallError["kind"]);
      expect(error.message).toBe(`mcp request failed (${kind})`);
    }
  });

  test("a network failure, a timeout and an oversized answer each have their kind", async () => {
    const down: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    let session = openMcpSession(down, { url: FAKE.mcpUrl, accessToken: "t" });
    expect((await failure(() => session.listTools())).kind).toBe("network");
    session.close();

    const executor = connected({ mcpHang: true });
    session = openMcpSession(executor.fetch, { url: FAKE.mcpUrl, accessToken: SECRETS.access1, timeoutMs: 20 });
    expect((await failure(() => session.listTools())).kind).toBe("timeout");
    session.close();

    const huge: FetchLike = async (_url, init) => {
      const rpc = JSON.parse(String(init?.body)) as { id: number };
      const padding = "x".repeat(MCP_CLIENT_LIMITS.maxResponseBytes + 10);
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: { padding } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    session = openMcpSession(huge, { url: FAKE.mcpUrl, accessToken: "t" });
    expect((await failure(() => session.listTools())).kind).toBe("too_large");
    session.close();
  });

  test("a JSON-RPC error answer is rpc_error; a tool's own error is isError", async () => {
    const executor = connected();
    const session = openMcpSession(executor.fetch, { url: FAKE.mcpUrl, accessToken: SECRETS.access1 });
    expect((await failure(() => session.callTool("execute", {}))).kind).toBe("rpc_error");
    session.close();

    const toolError = connected({ searchResult: { isError: true, content: [{ type: "text", text: "no" }] } });
    const second = openMcpSession(toolError.fetch, { url: FAKE.mcpUrl, accessToken: SECRETS.access1 });
    expect((await second.callTool("search", { query: "x" })).isError).toBe(true);
    second.close();
  });

  test("redirects are refused, so the bearer token never follows one", async () => {
    const executor = connected();
    const session = openMcpSession(executor.fetch, { url: FAKE.mcpUrl, accessToken: SECRETS.access1 });
    await session.listTools();
    session.close();
    // The fake records the init; redirect mode is set on every authenticated request.
    expect(executor.mcpCalls().length).toBeGreaterThan(0);
    const seen: RequestInit[] = [];
    const spy: FetchLike = async (url, init) => {
      seen.push(init ?? {});
      return executor.fetch(url, init);
    };
    const again = openMcpSession(spy, { url: FAKE.mcpUrl, accessToken: SECRETS.access1 });
    await again.listTools();
    again.close();
    expect(seen.every((init) => init.redirect === "error")).toBe(true);
  });
});
