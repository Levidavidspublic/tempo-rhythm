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

const getCookieClient = makeInsforgeClientGetter(insforgeEnv, createServerClient);

/** The app route handles refresh; the SDK data client consumes the access cookie only. */
export default function getInsforgeClient() {
  if (typeof document === "undefined") return null;
  const client = getCookieClient();
  if (!client) return null;

  const prefix = `${getAccessTokenCookieName()}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  client.setAccessToken(cookie?.slice(prefix.length) || null);
  return client;
}

const SESSION_CHANGED = "tempo:insforge-session-changed";
export const SESSION_REQUEST_HEADER = "X-Tempo-Session";

/** Call after an SSR auth action completes without navigating. */
export function invalidateInsforgeSession(events: EventTarget | undefined = globalThis.window) {
  events?.dispatchEvent(new Event(SESSION_CHANGED));
}

export function makeInsforgeSessionSource(
  env: InsforgeEnv = insforgeEnv,
  fetchSession: typeof fetch = fetch,
  events: EventTarget | undefined = globalThis.window
) {
  if (!readInsforgeConfig(env)) return null;

  let pending: Promise<unknown> = Promise.resolve();
  async function readSession() {
    getInsforgeClient();
    const response = await fetchSession("/api/auth/insforge/refresh", {
      method: "POST",
      headers: { [SESSION_REQUEST_HEADER]: "1" },
      mode: "same-origin",
      redirect: "error",
    });
    getInsforgeClient();
    if (response.status === 401) return { data: { user: null }, error: null };
    if (!response.ok) throw new Error("InsForge session unavailable");
    const data: { user: { id: string; email: string } | null } = await response.json();
    return { data, error: null };
  }

  return {
    getCurrentUser() {
      const read = pending.then(readSession);
      pending = read.catch(() => {});
      return read;
    },
    subscribe(listener: () => void) {
      const triggers = [SESSION_CHANGED, "focus", "pageshow"];
      for (const event of triggers) events?.addEventListener(event, listener);
      return () => {
        for (const event of triggers) events?.removeEventListener(event, listener);
      };
    },
  };
}
