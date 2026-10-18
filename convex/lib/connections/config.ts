/**
 * Executor connection settings (TEMPO-B07-07, #989), read from the deployment's environment.
 *
 * Names only: this module reads these variables and never sets them, and it never returns or
 * logs the key's value. The research doc (`docs/research/EXECUTOR-IN-TEMPO.md` §3.6) lists them:
 *
 * - `TEMPO_EXECUTOR_ENABLED`: the kill switch. Only the exact text `true` turns the feature on.
 * - `EXECUTOR_MCP_URL`: the person's Executor MCP endpoint. UNKNOWN whether the live value is
 *   `https://mcp.executor.sh/mcp` or `https://executor.sh/mcp` (doc §7.1 item 1), so it is
 *   config, never hard-coded, and everything else is discovered from it.
 * - `TEMPO_CONNECTIONS_KEY`: the AES-256-GCM key for tokens at rest (lib/connections/crypto.ts).
 * - `SITE_URL`: the web app's origin; the OAuth callback sends the browser back there.
 * - `CONVEX_SITE_URL`: built into every Convex deployment; the callback route lives on it.
 *
 * When any of them is missing or malformed, the feature is `unavailable`: no connect, no lookup,
 * no revocation call, and no `fetch` at all. Disconnect still scrubs what Tempo holds.
 */
import { parseConnectionsKey } from "./crypto";

export type Env = Record<string, string | undefined>;

export const EXECUTOR_PROVIDER = "executor" as const;
export const EXECUTOR_CALLBACK_PATH = "/connections/executor/callback";

/** Where the callback sends the browser back to, by the `returnTo` the connect call chose. */
export const RETURN_PATHS = {
  settings: "/settings/integrations",
  coach: "/coach",
} as const;
export type ReturnTo = keyof typeof RETURN_PATHS;

/**
 * The result the web app reads from `?executor=` after the callback. "confirm" comes with
 * `&n=<nonce>`: the app passes it to `connections.confirmExecutorConnect` as the signed-in person.
 */
export type CallbackResult = "confirm" | "denied" | "expired" | "error";

export type ExecutorConfig = {
  /** The MCP URL exactly as configured: the OAuth `resource` and the endpoint Tempo calls. */
  mcpUrl: string;
  /** The web app origin, e.g. `https://www.tempoflow.dev`. */
  siteOrigin: string;
  /** `{CONVEX_SITE_URL}/connections/executor/callback`: the registered redirect URI. */
  redirectUri: string;
};

/** Host names that only mean something inside a network, never on the public internet. */
const PRIVATE_NAME_SUFFIXES = [
  "localhost",
  "local",
  "localdomain",
  "internal",
  "intranet",
  "lan",
  "home.arpa",
  "corp",
  "private",
] as const;

/**
 * A URL Tempo's server may call (SSRF guard for anything discovered from Executor's metadata):
 * https on the default port, no credentials or fragment, and a public DNS name. Refused: IP
 * literals (v4, including the forms the URL parser turns into dotted v4, and v6), `localhost`,
 * single-label names and private-use suffixes such as `.internal` or `.local`. A public name that
 * resolves to a private address cannot be caught without resolving it; that stays UNKNOWN.
 */
export function publicHttpsUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password || url.hash) {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.startsWith("[") || host.includes(":") || /^[0-9.]+$/.test(host) || !host.includes(".")) {
    return null;
  }
  if (PRIVATE_NAME_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return null;
  }
  return url.href;
}

/** The configured MCP URL, held to the same rule as discovered URLs; else null. */
export function httpsUrl(value: string | undefined): string | null {
  return publicHttpsUrl(value);
}

/** A web origin for redirects: https, or http only on localhost (local dev). Else null. */
export function siteOrigin(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "https:" || (url.protocol === "http:" && local)) {
    return url.origin;
  }
  return null;
}

/**
 * The switch, the MCP URL, the site and the callback origin, or null when any is missing or
 * malformed. Does not look at the key; `executorEnabled` and the actions check it too.
 */
export function executorConfig(env: Env = process.env): ExecutorConfig | null {
  if (env.TEMPO_EXECUTOR_ENABLED?.trim() !== "true") return null;
  const mcpUrl = httpsUrl(env.EXECUTOR_MCP_URL);
  const site = siteOrigin(env.SITE_URL);
  const convexSite = siteOrigin(env.CONVEX_SITE_URL);
  if (!mcpUrl || !site || !convexSite) return null;
  return { mcpUrl, siteOrigin: site, redirectUri: `${convexSite}${EXECUTOR_CALLBACK_PATH}` };
}

/**
 * True when Executor can be used on this deployment: the switch is on, the URLs are valid and
 * the key decodes to 32 bytes. Reads presence and shape only, never returns a value, and reads
 * no clock, so it is safe in a query.
 */
export function executorEnabled(env: Env = process.env): boolean {
  return executorConfig(env) !== null && parseConnectionsKey(env.TEMPO_CONNECTIONS_KEY) !== null;
}

/** True when the MCP URL picks a scoped Executor connection (`?connection=<id>`, doc §1.5). */
export function isScopedMcpUrl(mcpUrl: string): boolean {
  try {
    return new URL(mcpUrl).searchParams.has("connection");
  } catch {
    return false;
  }
}

/**
 * The fixed page the callback redirects to. Never a URL taken from the request (doc §2.4 step 9).
 * Only "confirm" carries a value: the one-time confirm nonce, as `n`.
 */
export function callbackRedirect(
  origin: string,
  returnTo: ReturnTo,
  result: CallbackResult,
  nonce?: string,
): string {
  const page = `${origin}${RETURN_PATHS[returnTo]}?executor=${result}`;
  return result === "confirm" && nonce ? `${page}&n=${encodeURIComponent(nonce)}` : page;
}
