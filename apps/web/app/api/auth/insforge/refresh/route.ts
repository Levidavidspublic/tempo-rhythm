import { createServerClient, getRefreshTokenCookieName, refreshAuth } from "@insforge/sdk/ssr";
import type { NextRequest } from "next/server";
import { parseDataBackend } from "@/lib/backend-flag";
import { readInsforgeConfig, SESSION_REQUEST_HEADER } from "@/lib/insforge/client";

function sessionResponse(
  status: number,
  user?: { id: string; email: string } | null,
  cookies?: Headers
) {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const cookie of cookies?.getSetCookie() ?? []) headers.append("set-cookie", cookie);
  const id = user?.id?.trim();
  return Response.json({ user: id ? { id, email: user?.email ?? "" } : null }, { status, headers });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (request.headers.get(SESSION_REQUEST_HEADER) !== "1") return sessionResponse(403);

  const config = readInsforgeConfig({
    url: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  });
  if (parseDataBackend(process.env.NEXT_PUBLIC_DATA_BACKEND) !== "insforge" || !config) {
    return sessionResponse(503);
  }

  try {
    const options = { ...config, cookies: request.cookies, retryCount: 0 };
    const { data, error } = await createServerClient(options).auth.getCurrentUser();
    if (!error && data?.user) return sessionResponse(200, data.user);
    if (error && error.statusCode !== 401) return sessionResponse(503);
    if (!request.cookies.has(getRefreshTokenCookieName())) return sessionResponse(401);

    const result = await refreshAuth({
      ...options,
      options: { accessToken: { secure: true }, refreshToken: { secure: true } },
    });
    if (result.error) return sessionResponse(result.error.statusCode === 401 ? 401 : 503);
    if (!result.data?.user?.id) return sessionResponse(503);
    return sessionResponse(200, result.data.user, result.response.headers);
  } catch {
    return sessionResponse(503);
  }
}
