export const dynamic = "force-dynamic";

const FORWARDED_REQUEST_HEADERS = [
  "authorization",
  "accept",
  "content-type",
  "mcp-session-id",
  "mcp-protocol-version",
] as const;

const PASSED_RESPONSE_HEADERS = [
  "content-type",
  "www-authenticate",
  "retry-after",
  "mcp-session-id",
  "cache-control",
  "access-control-allow-methods",
  "access-control-allow-headers",
] as const;

/** Convex HTTP actions live on `.convex.site`; the client URL is `.convex.cloud`. */
export function resolveMcpTarget(env: Record<string, string | undefined>): string | null {
  const site = env.CONVEX_SITE_URL?.trim();
  if (site) return `${site.replace(/\/+$/, "")}/mcp`;
  const cloud = env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!cloud || !cloud.includes(".convex.cloud")) return null;
  return `${cloud.replace(/\/+$/, "").replace(".convex.cloud", ".convex.site")}/mcp`;
}

function calmError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Forwards to Convex `/mcp`. Only the headers listed above are sent: `Origin`,
 * `Cookie` and `Host` are dropped on purpose (Convex rejects browser origins).
 * Headers are never logged.
 */
async function forward(request: Request): Promise<Response> {
  const target = resolveMcpTarget(process.env);
  if (!target) {
    return calmError(502, "The MCP backend is not configured.");
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return calmError(502, "Could not reach the MCP backend. Try again in a moment.");
  }

  const responseHeaders = new Headers();
  for (const name of PASSED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  const noBody = upstream.status === 204 || upstream.status === 304;
  return new Response(noBody ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const POST = forward;
export const GET = forward;
export const DELETE = forward;
export const OPTIONS = forward;
