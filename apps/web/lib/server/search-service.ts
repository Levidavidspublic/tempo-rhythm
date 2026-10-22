import { createHash, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";

/** Server-only gateway. No model, query log, result cache or browser credential. */
export type SearchRow = {
  title: string;
  site: string;
  url: string;
  snippet: string;
  imageUrl: null;
  thumbnailUrl: null;
  durationSeconds: null;
  publishedAt: null;
};
type Status = "ok" | "off" | "unsupported" | "unavailable";
type SearchInput = {
  query: string;
  mode: "speed" | "balanced" | "quality";
  sources: ("web" | "discussions" | "academic")[];
  domains: string[];
  category: "web" | "images" | "videos" | "discover";
};
type Address = { address: string; family: number };
type UpstreamResponse = {
  status: number;
  contentType: string;
  contentEncoding?: string;
  body: ReadableStream<Uint8Array>;
};
type Settings = { token?: string; upstreamUrl?: string };
export type SearchDependencies = {
  settings?: () => Settings;
  resolve?: (hostname: string) => Promise<Address[]>;
  transport?: (
    url: URL,
    address: Address,
    form: string,
    signal: AbortSignal
  ) => Promise<UpstreamResponse>;
};

const REQUEST_BYTES = 8_192;
const RESPONSE_BYTES = 1_048_576;
const MAX_REQUEST_MS = 12_000;
const DOMAIN_SUFFIXES = [
  "localhost",
  "local",
  "internal",
  "test",
  "invalid",
  "example",
  "onion",
  "home.arpa",
];

function reply(
  status: Status,
  httpStatus: number,
  rows: SearchRow[] = [],
  truncated = false
): Response {
  return Response.json(
    { status, rows, retrievedAt: status === "ok" ? Date.now() : null, truncated },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    }
  );
}

/** IDNA normalization without accepting ports, paths, credentials, IPs or local names. */
export function publicHostname(input: string): string | null {
  if (!input || input.length > 253 || /[\s/@:#?\\]/u.test(input)) return null;
  let host: string;
  try {
    host = new URL(`https://${input}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
  if (isIP(host) || !host.includes(".") || host.length > 253) return null;
  if (DOMAIN_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return null;
  if (!host.split(".").every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)))
    return null;
  return host;
}

/** Conservative public-unicast policy; special-use, mapped and transition ranges stay out. */
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const a = octets[0]!;
    const b = octets[1]!;
    const c = octets[2]!;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(address) !== 6 || address.includes(".") || address.includes("%")) return false;
  const halves = address.toLowerCase().split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const words =
    halves.length === 2
      ? [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right]
      : left;
  const first = Number.parseInt(words[0]!, 16);
  const second = Number.parseInt(words[1]!, 16);
  if ((first & 0xe000) !== 0x2000) return false;
  return (
    first !== 0x2002 &&
    first !== 0x3fff &&
    !(first === 0x2001 && (second <= 0x01ff || second === 0x0db8))
  );
}

function upstreamUrl(value: string | undefined): URL | null {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;
    const hostname = publicHostname(url.hostname);
    if (!hostname) return null;
    url.hostname = hostname;
    // The setting names an exact SearXNG search endpoint, possibly under a deployment prefix.
    if (!url.pathname.endsWith("/search")) return null;
    return url;
  } catch {
    return null;
  }
}

function authorized(request: Request, token: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (header.length > 4_096 || !header.startsWith("Bearer ")) return false;
  const candidate = header.slice(7);
  if (!candidate || /[\s\r\n]/.test(candidate)) return false;
  // Fixed-size digests avoid a token-length timing branch; neither digest is persisted.
  return timingSafeEqual(
    createHash("sha256").update(candidate).digest(),
    createHash("sha256").update(token).digest()
  );
}

class BodyLimitError extends Error {}
class InputError extends Error {}

async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new Error("cancelled");
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(new Error("cancelled"));
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

async function readText(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal
): Promise<string> {
  if (!body) throw new InputError();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const next = await abortable(reader.read(), signal);
      if (signal.aborted) throw new Error("cancelled");
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new BodyLimitError();
      chunks.push(next.value);
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

function parseInput(value: unknown): SearchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError();
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some(
      (key) => !["query", "mode", "sources", "domains", "category"].includes(key)
    )
  )
    throw new InputError();
  if (typeof row.query !== "string" || /[\p{Cc}\p{Cf}]/u.test(row.query)) throw new InputError();
  const query = row.query.trim();
  if (!query || [...query].length > 200) throw new InputError();
  if (
    !["speed", "balanced", "quality"].includes(row.mode as string) ||
    !["web", "images", "videos", "discover"].includes(row.category as string)
  )
    throw new InputError();
  if (
    !Array.isArray(row.sources) ||
    row.sources.length < 1 ||
    row.sources.length > 3 ||
    row.sources.some((source) => !["web", "discussions", "academic"].includes(source)) ||
    new Set(row.sources).size !== row.sources.length
  )
    throw new InputError();
  if (!Array.isArray(row.domains) || row.domains.length > 5) throw new InputError();
  const domains = row.domains.map((domain: unknown) =>
    typeof domain === "string" ? publicHostname(domain) : null
  );
  if (domains.some((domain) => domain === null) || new Set(domains).size !== domains.length)
    throw new InputError();
  return {
    query,
    mode: row.mode as SearchInput["mode"],
    category: row.category as SearchInput["category"],
    sources: row.sources as SearchInput["sources"],
    domains: domains as string[],
  };
}

function plain(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const bounded = value.slice(0, 20_000);
  const text = bounded
    .replace(/<script\b[^>]{0,2048}>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]{0,2048}>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]{0,2048}>/g, " ")
    .replace(/[<>]/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|apos|#39|nbsp);/gi,
      (entity) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&#39;": "'",
          "&nbsp;": " ",
        })[entity.toLowerCase()] ?? " "
    )
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...text].slice(0, max).join("");
}

function resultRows(
  value: unknown,
  input: SearchInput,
  limit: number
): { rows: SearchRow[]; truncated: boolean } {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { results?: unknown }).results)
  )
    throw new Error("invalid response");
  const results = (value as { results: unknown[] }).results;
  const rows: SearchRow[] = [];
  const seen = new Set<string>();
  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const result = entry as Record<string, unknown>;
    if (typeof result.url !== "string" || result.url.length > 2_048) continue;
    let url: URL;
    try {
      url = new URL(result.url);
    } catch {
      continue;
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port)
      continue;
    const host = publicHostname(url.hostname);
    if (
      !host ||
      (input.domains.length &&
        !input.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)))
    )
      continue;
    url.hostname = host;
    const title = plain(result.title, 200);
    if (!title || seen.has(url.href)) continue;
    seen.add(url.href);
    if (rows.length === limit) return { rows, truncated: true };
    rows.push({
      title,
      site: host,
      url: url.href,
      snippet: plain(result.content, 400),
      imageUrl: null,
      thumbnailUrl: null,
      durationSeconds: null,
      publishedAt: null,
    });
  }
  return { rows, truncated: false };
}

/** Pins the connection to the already validated address; TLS still checks the original hostname. */
export function pinnedRequestOptions(
  url: URL,
  address: Address,
  signal: AbortSignal
): RequestOptions {
  if (!publicAddress(address.address) || isIP(address.address) !== address.family)
    throw new Error("invalid address");
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [address]);
    else callback(null, address.address, address.family);
  };
  return {
    method: "POST",
    agent: false,
    servername: url.hostname,
    rejectUnauthorized: true,
    lookup: pinnedLookup,
    signal,
    maxHeaderSize: 8_192,
  };
}

/** Built-in HTTPS avoids a second DNS resolution and never follows redirects. */
async function transport(
  url: URL,
  address: Address,
  form: string,
  signal: AbortSignal
): Promise<UpstreamResponse> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        ...pinnedRequestOptions(url, address, signal),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "Content-Length": Buffer.byteLength(form),
        },
      },
      (response) => {
        // Node and DOM ship separate declarations for the same WHATWG stream protocol.
        const body = Readable.toWeb(response) as unknown as ReadableStream<Uint8Array>;
        resolve({
          status: response.statusCode ?? 502,
          contentType: String(response.headers["content-type"] ?? ""),
          contentEncoding: String(response.headers["content-encoding"] ?? ""),
          body,
        });
      }
    );
    request.once("error", reject);
    request.end(form);
  });
}

export async function handleSearch(
  request: Request,
  dependencies: SearchDependencies = {}
): Promise<Response> {
  if (request.method !== "POST") return reply("unavailable", 405);
  const settings = dependencies.settings?.() ?? {
    token: process.env.TEMPO_SEARCH_SERVICE_TOKEN,
    upstreamUrl: process.env.TEMPO_SEARCH_UPSTREAM_URL,
  };
  if (
    !settings.token ||
    settings.token.length < 32 ||
    settings.token.length > 2_048 ||
    /\s/.test(settings.token)
  )
    return reply("off", 503);
  if (!authorized(request, settings.token)) return reply("unavailable", 401);
  const endpoint = upstreamUrl(settings.upstreamUrl);
  if (!endpoint) return reply("off", 503);
  if (
    (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() !==
    "application/json"
  )
    return reply("unavailable", 400);
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > REQUEST_BYTES))
    return reply("unavailable", 413);
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const timer = setTimeout(abort, MAX_REQUEST_MS);
  let retrievalTimer: ReturnType<typeof setTimeout> | undefined;
  let responseBody: ReadableStream<Uint8Array> | undefined;
  try {
    let input: SearchInput;
    try {
      input = parseInput(
        JSON.parse(await readText(request.body, REQUEST_BYTES, controller.signal))
      );
    } catch (error) {
      return reply("unavailable", error instanceof BodyLimitError ? 413 : 400);
    }
    if (
      input.mode === "quality" ||
      input.category !== "web" ||
      input.sources.length !== 1 ||
      input.sources[0] !== "web"
    )
      return reply("unsupported", 422);
    const resolve =
      dependencies.resolve ??
      ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));
    retrievalTimer = setTimeout(abort, input.mode === "speed" ? 8_000 : 12_000);
    const addresses = await abortable(resolve(endpoint.hostname), controller.signal);
    // Reject mixed DNS answers rather than relying on resolver ordering.
    if (
      !addresses.length ||
      addresses.some(
        (address) => !publicAddress(address.address) || isIP(address.address) !== address.family
      )
    )
      return reply("unavailable", 503);
    const query = input.domains.length
      ? `${input.query} (${input.domains.map((domain) => `site:${domain}`).join(" OR ")})`
      : input.query;
    const form = new URLSearchParams({
      q: query,
      format: "json",
      categories: "general",
    }).toString();
    const result = await abortable(
      (dependencies.transport ?? transport)(endpoint, addresses[0]!, form, controller.signal),
      controller.signal
    );
    responseBody = result.body;
    if (result.status === 429) return reply("unavailable", 429);
    if (
      result.status < 200 ||
      result.status >= 300 ||
      result.contentType.split(";")[0]?.trim().toLowerCase() !== "application/json" ||
      (result.contentEncoding && result.contentEncoding.toLowerCase() !== "identity")
    )
      return reply("unavailable", 503);
    const value: unknown = JSON.parse(
      await readText(result.body, RESPONSE_BYTES, controller.signal)
    );
    responseBody = undefined;
    const resultPage = resultRows(value, input, input.mode === "speed" ? 3 : 5);
    return reply("ok", 200, resultPage.rows, resultPage.truncated);
  } catch {
    return reply("unavailable", 503);
  } finally {
    controller.abort();
    clearTimeout(timer);
    if (retrievalTimer !== undefined) clearTimeout(retrievalTimer);
    request.signal.removeEventListener("abort", abort);
    if (responseBody) void responseBody.cancel().catch(() => {});
  }
}
