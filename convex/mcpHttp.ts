import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { PENDING_APPROVAL_ERROR } from "./lib/approval";
import {
  handleRpc,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "./lib/mcp/dispatch";
import {
  INVALID_REQUEST,
  type JsonRpcResponse,
  PARSE_ERROR,
  parseRequest,
  rpcError,
} from "./lib/mcp/jsonrpc";
import { isOriginAllowed, parseOriginList } from "./lib/mcp/origin";
import { hashToken, isTokenShaped, parseBearer } from "./lib/mcp/token";

/**
 * MCP Streamable HTTP endpoint (TEMPO-MCP-01), stateless: POST a JSON-RPC message, get
 * `application/json` back. Notifications get 202. No server-initiated stream (GET -> 405).
 * Auth: `Authorization: Bearer tmcp_...` (personal token, see convex/mcp.ts).
 */
const MAX_BODY_BYTES = 256 * 1024;

function json(status: number, body: JsonRpcResponse | null, headers: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(body === null ? {} : { "Content-Type": "application/json" }),
      "MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
      ...headers,
    },
  });
}

function allowedOrigins(): string[] {
  return parseOriginList(process.env.TEMPO_MCP_ALLOWED_ORIGINS);
}

export const mcpPost = httpAction(async (ctx, request) => {
  if (!isOriginAllowed(request.headers.get("Origin"), allowedOrigins())) {
    return json(403, rpcError(null, INVALID_REQUEST, "Origin not allowed"));
  }

  const token = parseBearer(request.headers.get("Authorization"));
  const unauthorized = () =>
    json(401, rpcError(null, INVALID_REQUEST, "Missing or invalid token"), {
      "WWW-Authenticate": 'Bearer realm="tempo-mcp"',
    });
  if (!token || !isTokenShaped(token)) {
    return unauthorized();
  }

  const version = request.headers.get("MCP-Protocol-Version");
  if (version !== null && !(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(version)) {
    return json(
      400,
      rpcError(null, INVALID_REQUEST, `Unsupported MCP-Protocol-Version: ${version}`),
    );
  }

  const auth = await ctx.runMutation(internal.mcp.authorizeCall, {
    tokenHash: await hashToken(token),
  });
  if (auth.status === "unauthorized") {
    return unauthorized();
  }
  if (auth.status === "pending") {
    return json(403, rpcError(null, INVALID_REQUEST, PENDING_APPROVAL_ERROR));
  }
  if (auth.status === "rate_limited") {
    return json(429, rpcError(null, INVALID_REQUEST, "Rate limit: 120 calls per minute"), {
      "Retry-After": "60",
    });
  }
  const userId = auth.userId;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return json(413, rpcError(null, INVALID_REQUEST, "Request too large"));
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, rpcError(null, PARSE_ERROR, "Parse error"));
  }
  if (Array.isArray(body)) {
    return json(400, rpcError(null, INVALID_REQUEST, "JSON-RPC batches are not supported"));
  }
  const rpc = parseRequest(body);
  if (!rpc) {
    // A response or an unrecognised message: nothing to answer.
    return json(400, rpcError(null, INVALID_REQUEST, "Invalid request"));
  }

  const response = await handleRpc(rpc, async (tool, args) => {
    if (tool.kind === "query") {
      return {
        ok: true,
        data: await ctx.runQuery(internal.mcpTools.runReadTool, {
          userId,
          name: tool.name,
          args,
        }),
      };
    }
    if (tool.kind === "mutation") {
      return {
        ok: true,
        data: await ctx.runMutation(internal.mcpTools.runWriteTool, {
          userId,
          name: tool.name,
          args,
        }),
      };
    }
    return {
      ok: true,
      data: await ctx.runAction(internal.mcpTools.runBrainDump, {
        userId,
        text: args.text as string,
        accept: args.accept as boolean | undefined,
      }),
    };
  });
  return response === null ? json(202, null) : json(200, response);
});

/** No server-initiated stream and no sessions: GET and DELETE are 405. */
export const mcpNotAllowed = httpAction(async () => {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST, OPTIONS" },
  });
});

export const mcpOptions = httpAction(async (_ctx, request) => {
  const origin = request.headers.get("Origin");
  if (!isOriginAllowed(origin, allowedOrigins())) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, Accept",
      "Access-Control-Max-Age": "86400",
    },
  });
});
