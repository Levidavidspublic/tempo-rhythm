import { createServerClient, getAccessTokenCookieName } from "@insforge/sdk/ssr";

type InsforgeEnv = {
  url?: string;
  anonKey?: string;
};

export function readInsforgeConfig(env: InsforgeEnv) {
  const baseUrl = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  return baseUrl && anonKey ? { baseUrl, anonKey } : null;
}

export function makeInsforgeClientGetter<Client>(
  env: InsforgeEnv,
  create: (options: { baseUrl: string; anonKey: string }) => Client
): () => Client | null {
  const config = readInsforgeConfig(env);
  if (!config) return () => null;

  let client: Client | undefined;
  return () => {
    client ??= create(config);
    return client;
  };
}

const insforgeEnv = {
  url: process.env.NEXT_PUBLIC_INSFORGE_URL,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
};

const SESSION_CHANGED = "tempo:insforge-session-changed";
const SESSION_TIMEOUT_MS = 10_000;
export const SESSION_REQUEST_HEADER = "X-Tempo-Session";

function readAccessCookie() {
  const prefix = `${getAccessTokenCookieName()}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie?.slice(prefix.length) || null;
}

function isCurrentAccessToken(token: string | null): token is string {
  const payload = token?.split(".")[1];
  if (!payload) return false;
  try {
    const { exp } = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/")));
    return typeof exp === "number" && exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function makeInsforgeDataFetch(
  refreshSession: () => Promise<unknown>,
  getAccessToken = readAccessCookie,
  fetchData = fetch
): typeof fetch {
  let pendingRefresh: Promise<unknown> | undefined;
  return Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      let token = getAccessToken();
      if (!isCurrentAccessToken(token)) {
        pendingRefresh ??= refreshSession().finally(() => {
          pendingRefresh = undefined;
        });
        await pendingRefresh;
        token = getAccessToken();
        if (!isCurrentAccessToken(token)) {
          return Response.json({ message: "InsForge session unavailable" }, { status: 401 });
        }
      }

      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
      headers.set("Authorization", `Bearer ${token}`);
      return fetchData(input, { ...init, headers });
    },
    { preconnect: fetchData.preconnect }
  );
}

const readBrowserSession = makeInsforgeSessionReader();
const getCookieClient = makeInsforgeClientGetter(insforgeEnv, (config) =>
  createServerClient({ ...config, fetch: makeInsforgeDataFetch(readBrowserSession) })
);

/** The app route handles refresh; the SDK data client consumes the access cookie only. */
export default function getInsforgeClient() {
  if (typeof document === "undefined") return null;
  const client = getCookieClient();
  if (!client) return null;

  const token = readAccessCookie();
  client.setAccessToken(isCurrentAccessToken(token) ? token : null);
  return client;
}

/** Call after an SSR auth action completes without navigating. */
export function invalidateInsforgeSession(events: EventTarget | undefined = globalThis.window) {
  events?.dispatchEvent(new Event(SESSION_CHANGED));
}

function makeInsforgeSessionReader(fetchSession: typeof fetch = fetch) {
  let pending: Promise<unknown> = Promise.resolve();
  async function readSession() {
    const response = await fetchSession("/api/auth/insforge/refresh", {
      method: "POST",
      headers: { [SESSION_REQUEST_HEADER]: "1" },
      mode: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    });
    getInsforgeClient();
    if (response.status === 401) return { data: { user: null }, error: null };
    if (!response.ok) throw new Error("InsForge session unavailable");
    const data: { user: { id: string; email: string } | null } = await response.json();
    return { data, error: null };
  }

  return () => {
    const read = pending.then(readSession);
    pending = read.catch(() => {});
    return read;
  };
}

export function makeInsforgeSessionSource(
  env: InsforgeEnv = insforgeEnv,
  fetchSession?: typeof fetch,
  events: EventTarget | undefined = globalThis.window
) {
  if (!readInsforgeConfig(env)) return null;

  return {
    getCurrentUser: fetchSession ? makeInsforgeSessionReader(fetchSession) : readBrowserSession,
    subscribe(listener: () => void) {
      const triggers = [SESSION_CHANGED, "focus", "pageshow"];
      for (const event of triggers) events?.addEventListener(event, listener);
      return () => {
        for (const event of triggers) events?.removeEventListener(event, listener);
      };
    },
  };
}
