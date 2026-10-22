import { describe, expect, test } from "bun:test";
import type { LookupAddress } from "node:dns";
import {
  handleSearch,
  pinnedRequestOptions,
  publicAddress,
  publicHostname,
  type SearchDependencies,
} from "./search-service";

// Deliberately synthetic, local-only bearer fixture; never a deployed credential.
const fixtureToken = "fictional-local-search-fixture-0001";
const defaults = {
  query: "gardening",
  mode: "balanced",
  sources: ["web"],
  domains: [],
  category: "web",
};
const publicIp = { address: "93.184.216.34", family: 4 };
const encoder = new TextEncoder();
function stream(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(value));
      controller.close();
    },
  });
}
function request(patch: Record<string, unknown> = {}, options: RequestInit = {}): Request {
  return new Request("https://tempo.acme.org/api/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${fixtureToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...defaults, ...patch }),
    ...options,
  });
}
function fixture(overrides: SearchDependencies = {}) {
  const calls: {
    resolve: string[];
    transport: { url: URL; address: typeof publicIp; form: string; signal: AbortSignal }[];
  } = { resolve: [], transport: [] };
  const dependencies: SearchDependencies = {
    settings: () => ({ token: fixtureToken, upstreamUrl: "https://search.acme.org/search" }),
    resolve: async (hostname) => {
      calls.resolve.push(hostname);
      return [publicIp];
    },
    transport: async (url, address, form, signal) => {
      calls.transport.push({ url, address, form, signal });
      return {
        status: 200,
        contentType: "application/json",
        body: stream(
          JSON.stringify({
            results: [
              { title: "Garden", url: "https://allowed.org/garden", content: "Grow herbs" },
            ],
          })
        ),
      };
    },
    ...overrides,
  };
  return { calls, dependencies };
}
function provider(
  results: unknown[],
  extras: Partial<{ status: number; contentType: string; contentEncoding: string }> = {}
): SearchDependencies["transport"] {
  return async () => ({
    status: 200,
    contentType: "application/json",
    body: stream(JSON.stringify({ results })),
    ...extras,
  });
}
const row = (index: number) => ({
  title: `Garden ${index}`,
  url: `https://allowed.org/${index}`,
  content: "Plants",
});

describe("search gateway configuration, auth and input boundaries", () => {
  test("missing token is OFF without DNS or retrieval", async () => {
    const f = fixture({ settings: () => ({}) });
    const response = await handleSearch(request(), f.dependencies);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "off",
      rows: [],
      retrievedAt: null,
      truncated: false,
    });
    expect(f.calls).toEqual({ resolve: [], transport: [] });
  });
  test.each([
    "short",
    "x".repeat(2049),
    "a ".repeat(32),
  ])("invalid configured token stays OFF (%#)", async (token) => {
    const f = fixture({
      settings: () => ({ token, upstreamUrl: "https://search.acme.org/search" }),
    });
    expect((await handleSearch(request(), f.dependencies)).status).toBe(503);
    expect(f.calls.resolve).toEqual([]);
  });
  test.each([
    "",
    "Bearer wrong",
    `Basic ${fixtureToken}`,
    `Bearer ${"x".repeat(4097)}`,
  ])("rejects unauthorized before DNS/body (%#)", async (authorization) => {
    const f = fixture();
    const response = await handleSearch(
      request({}, { headers: { Authorization: authorization }, body: "not json" }),
      f.dependencies
    );
    expect(response.status).toBe(401);
    expect(f.calls).toEqual({ resolve: [], transport: [] });
  });
  test.each([
    undefined,
    "http://search.acme.org/search",
    "https://127.0.0.1/search",
    "https://localhost/search",
    "https://search.acme.org:444/search",
    "https://user:pass@search.acme.org/search",
    "https://search.acme.org/search?q=hi",
    "https://search.acme.org/anything",
    "https://search.acme.org/search#fragment",
  ])("invalid upstream config is OFF (%#)", async (upstreamUrl) => {
    const f = fixture({ settings: () => ({ token: fixtureToken, upstreamUrl }) });
    const response = await handleSearch(request(), f.dependencies);
    expect((await response.json()).status).toBe("off");
    expect(f.calls.resolve).toEqual([]);
  });
  test("only POST is supported", async () => {
    const f = fixture();
    expect(
      (await handleSearch(new Request("https://tempo.acme.org/api/search"), f.dependencies)).status
    ).toBe(405);
    expect(f.calls.resolve).toEqual([]);
  });
  test.each([
    { query: "" },
    { query: "  " },
    { query: "x".repeat(201) },
    { query: "hello\nworld" },
    { query: "hello\u202Eworld" },
    { mode: "turbo" },
    { category: "news" },
    { sources: [] },
    { sources: ["web", "web"] },
    { sources: ["unknown"] },
    { domains: ["localhost"] },
    { domains: ["127.0.0.1"] },
    { domains: ["allowed.org/path"] },
    { domains: ["allowed.org", "ALLOWED.ORG."] },
    { domains: Array.from({ length: 6 }, (_, i) => `host${i}.org`) },
    { upstream: "https://attacker.org/search" },
  ])("invalid input rejected before DNS (%#)", async (patch) => {
    const f = fixture();
    expect((await handleSearch(request(patch), f.dependencies)).status).toBe(400);
    expect(f.calls.resolve).toEqual([]);
  });
  test("valid 200-codepoint query and IDNA domain normalize", async () => {
    const f = fixture();
    expect(
      (
        await handleSearch(
          request({ query: "🌱".repeat(200), domains: ["BÜCHER.org."] }),
          f.dependencies
        )
      ).status
    ).toBe(200);
    expect(new URLSearchParams(f.calls.transport[0]!.form).get("q")).toContain(
      "site:xn--bcher-kva.org"
    );
  });
  test("malformed JSON and non-JSON content type are rejected", async () => {
    const f = fixture();
    expect((await handleSearch(request({}, { body: "{" }), f.dependencies)).status).toBe(400);
    expect(
      (
        await handleSearch(
          request(
            {},
            { headers: { Authorization: `Bearer ${fixtureToken}`, "Content-Type": "text/plain" } }
          ),
          f.dependencies
        )
      ).status
    ).toBe(400);
    expect(f.calls.resolve).toEqual([]);
  });
  test("oversized Content-Length rejected before body parse", async () => {
    const f = fixture();
    const response = await handleSearch(
      request(
        {},
        {
          headers: {
            Authorization: `Bearer ${fixtureToken}`,
            "Content-Type": "application/json",
            "Content-Length": "8193",
          },
        }
      ),
      f.dependencies
    );
    expect(response.status).toBe(413);
    expect(f.calls.resolve).toEqual([]);
  });
  test("streaming request byte limit does not trust Content-Length", async () => {
    const f = fixture();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8193));
      },
      cancel() {
        cancelled = true;
      },
    });
    expect((await handleSearch(request({}, { body }), f.dependencies)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(f.calls.resolve).toEqual([]);
  });
  test.each([
    { mode: "quality" },
    { sources: ["academic"] },
    { sources: ["discussions"] },
    { sources: ["web", "academic"] },
    { category: "images" },
    { category: "videos" },
    { category: "discover" },
  ])("unsupported capability is explicit and makes no provider call (%#)", async (patch) => {
    const f = fixture();
    const response = await handleSearch(request(patch), f.dependencies);
    expect(response.status).toBe(422);
    expect((await response.json()).status).toBe("unsupported");
    expect(f.calls).toEqual({ resolve: [], transport: [] });
  });
});

describe("DNS binding and private-address protection", () => {
  test.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "100.127.255.255",
    "0.0.0.0",
    "192.0.0.8",
    "192.0.2.1",
    "192.88.99.1",
    "198.18.0.1",
    "198.19.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "2002:7f00:1::",
    "2001::1",
    "2001:db8::1",
    "3fff::1",
    "64:ff9b::7f00:1",
    "2606:4700::1%eth0",
  ])("rejects special-use address %s", (address) => expect(publicAddress(address)).toBe(false));
  test.each([
    "93.184.216.34",
    "100.63.255.255",
    "100.128.0.1",
    "172.15.255.255",
    "172.32.0.1",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
  ])("accepts public unicast %s", (address) => expect(publicAddress(address)).toBe(true));
  test.each([
    "localhost",
    "router.local",
    "a.internal",
    "x.home.arpa",
    "a.onion",
    "a.test",
    "a.invalid",
    "a.example",
    "127.1",
    "2130706433",
    "0x7f000001",
    "[::1]",
    "user@allowed.org",
    "allowed.org:443",
    "a..org",
    "-a.org",
  ])("rejects unsafe hostname %s", (hostname) => expect(publicHostname(hostname)).toBeNull());
  test.each([
    { addresses: [] },
    { addresses: [{ address: "127.0.0.1", family: 4 }] },
    { addresses: [publicIp, { address: "10.0.0.1", family: 4 }] },
    { addresses: [{ address: publicIp.address, family: 6 }] },
  ])("rejects empty, private, mixed or inconsistent DNS answers (%#)", async ({ addresses }) => {
    const f = fixture({ resolve: async () => [...addresses] });
    expect((await handleSearch(request(), f.dependencies)).status).toBe(503);
    expect(f.calls.transport).toEqual([]);
  });
  test.each([
    publicIp,
    { address: "2606:4700:4700::1111", family: 6 },
  ])("pins socket lookup to validated address while keeping TLS verification (%#)", async (address) => {
    const signal = new AbortController().signal;
    const options = pinnedRequestOptions(
      new URL("https://search.acme.org/search"),
      address,
      signal
    );
    expect(options).toMatchObject({
      agent: false,
      servername: "search.acme.org",
      rejectUnauthorized: true,
      signal,
      maxHeaderSize: 8192,
      method: "POST",
    });
    const lookup = options.lookup!;
    const single = await new Promise<{ address: string; family: number }>((resolve, reject) =>
      lookup("search.acme.org", { family: 0 }, (error, resolved, family) =>
        error ? reject(error) : resolve({ address: resolved as string, family: family! })
      )
    );
    expect(single).toEqual(address);
    const all = await new Promise<LookupAddress[]>((resolve, reject) =>
      lookup("search.acme.org", { all: true }, (error, resolved) =>
        error ? reject(error) : resolve(resolved as LookupAddress[])
      )
    );
    expect(all).toEqual([address]);
    // Both lookup forms return the checked address without a second resolver call.
  });
  test("pinned options refuse private or mismatched injected addresses", () => {
    const url = new URL("https://search.acme.org/search");
    expect(() =>
      pinnedRequestOptions(url, { address: "127.0.0.1", family: 4 }, new AbortController().signal)
    ).toThrow();
    expect(() =>
      pinnedRequestOptions(url, { ...publicIp, family: 6 }, new AbortController().signal)
    ).toThrow();
  });
});

describe("verified retrieval contract and bounded results", () => {
  test("uses fixed endpoint, pinned DNS result, documented POST fields and no-store response", async () => {
    const f = fixture();
    const response = await handleSearch(
      request({ domains: ["allowed.org", "second.org"] }),
      f.dependencies
    );
    expect(response.status).toBe(200);
    expect(f.calls.resolve).toEqual(["search.acme.org"]);
    const call = f.calls.transport[0]!;
    expect(call.url.href).toBe("https://search.acme.org/search");
    expect(call.address).toEqual(publicIp);
    expect(Object.fromEntries(new URLSearchParams(call.form))).toEqual({
      q: "gardening (site:allowed.org OR site:second.org)",
      format: "json",
      categories: "general",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const result = await response.json();
    expect(result).toMatchObject({
      status: "ok",
      truncated: false,
      rows: [
        {
          title: "Garden",
          snippet: "Grow herbs",
          site: "allowed.org",
          url: "https://allowed.org/garden",
          imageUrl: null,
          thumbnailUrl: null,
          durationSeconds: null,
          publishedAt: null,
        },
      ],
    });
    expect(typeof result.retrievedAt).toBe("number");
  });
  test.each([
    ["speed", 3],
    ["balanced", 5],
  ] as const)("%s returns top %i and reports truncation", async (mode, count) => {
    const f = fixture({ transport: provider(Array.from({ length: 6 }, (_, i) => row(i))) });
    const body = await (await handleSearch(request({ mode }), f.dependencies)).json();
    expect(body.rows).toHaveLength(count);
    expect(body.truncated).toBe(true);
  });
  test("empty provider results honestly return empty OK", async () => {
    const f = fixture({ transport: provider([]) });
    const body = await (await handleSearch(request(), f.dependencies)).json();
    expect(body).toMatchObject({ status: "ok", rows: [], truncated: false });
  });
  test("filters spoof domains, unsafe URLs, duplicates and empty titles", async () => {
    const entries = [
      row(1),
      row(1),
      { ...row(2), url: "https://news.allowed.org/article" },
      ...[
        "https://notallowed.org/",
        "https://allowed.org.evil.org/",
        "https://127.0.0.1/",
        "https://localhost/",
        "javascript:alert(1)",
        "https://user:pass@allowed.org/",
        "https://allowed.org:444/",
      ].map((url) => ({ title: "Unsafe", url })),
      { url: "https://allowed.org/empty", title: "<script>bad</script>" },
      null,
    ];
    const f = fixture({ transport: provider(entries) });
    const body = await (
      await handleSearch(request({ domains: ["allowed.org"] }), f.dependencies)
    ).json();
    expect(body.rows.map((item: { url: string }) => item.url)).toEqual([
      "https://allowed.org/1",
      "https://news.allowed.org/article",
    ]);
    expect(body.truncated).toBe(false);
  });
  test("strips provider markup and bounds title/snippet without splitting Unicode", async () => {
    const f = fixture({
      transport: provider([
        {
          ...row(1),
          title: "<script>ignore me</script><b>Garden</b> &amp; <i>herbs</i>",
          content: `<style>hidden</style>${"🌱".repeat(500)}`,
        },
      ]),
    });
    const body = await (await handleSearch(request(), f.dependencies)).json();
    expect(body.rows[0].title).toBe("Garden & herbs");
    expect([...body.rows[0].snippet]).toHaveLength(400);
  });
  test.each([
    301, 302, 307, 400, 403, 500,
  ])("does not follow redirects or accept upstream HTTP %i", async (status) => {
    const f = fixture({ transport: provider([row(1)], { status }) });
    expect((await handleSearch(request(), f.dependencies)).status).toBe(503);
  });
  test("preserves upstream rate limiting without leaking upstream content", async () => {
    const f = fixture({
      transport: provider([{ content: "private upstream diagnostic" }], { status: 429 }),
    });
    const response = await handleSearch(request(), f.dependencies);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      status: "unavailable",
      rows: [],
      retrievedAt: null,
      truncated: false,
    });
  });
  test.each([
    { contentType: "text/html" },
    { contentType: "application/json-evil" },
    { contentEncoding: "gzip" },
  ])("rejects non-JSON or compressed upstream bodies (%#)", async (extras) => {
    const f = fixture({ transport: provider([row(1)], extras) });
    expect((await handleSearch(request(), f.dependencies)).status).toBe(503);
  });
  test.each([
    "not-json",
    "{}",
    '{"results":{}}',
  ])("fails closed on malformed upstream payload (%#)", async (body) => {
    const f = fixture({
      transport: async () => ({ status: 200, contentType: "application/json", body: stream(body) }),
    });
    expect((await handleSearch(request(), f.dependencies)).status).toBe(503);
  });
  test("cancels response over 1 MiB and never returns partial data", async () => {
    let cancelled = false;
    const f = fixture({
      transport: async () => ({
        status: 200,
        contentType: "application/json",
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1_048_577));
          },
          cancel() {
            cancelled = true;
          },
        }),
      }),
    });
    const response = await handleSearch(request(), f.dependencies);
    expect(response.status).toBe(503);
    expect(cancelled).toBe(true);
    expect((await response.json()).rows).toEqual([]);
  });
  test("DNS and provider exceptions expose neither raw diagnostics nor credentials", async () => {
    for (const overrides of [
      {
        resolve: async () => {
          throw new Error(fixtureToken);
        },
      },
      {
        transport: async () => {
          throw new Error("sensitive query or upstream diagnostic");
        },
      },
    ]) {
      const f = fixture(overrides);
      const response = await handleSearch(request(), f.dependencies);
      expect(response.status).toBe(503);
      expect(await response.text()).toBe(
        '{"status":"unavailable","rows":[],"retrievedAt":null,"truncated":false}'
      );
    }
  });
});

describe.serial("cancellation and request deadlines", () => {
  test("pre-aborted request never resolves DNS or retrieves", async () => {
    const controller = new AbortController();
    controller.abort();
    const f = fixture();
    expect(
      (await handleSearch(request({}, { signal: controller.signal }), f.dependencies)).status
    ).toBe(400);
    expect(f.calls).toEqual({ resolve: [], transport: [] });
  });
  test("abort during DNS settles promptly and cannot start a late provider call", async () => {
    const controller = new AbortController();
    let release!: (value: (typeof publicIp)[]) => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const f = fixture({
      resolve: () => {
        started();
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    const pending = handleSearch(request({}, { signal: controller.signal }), f.dependencies);
    await began;
    controller.abort();
    expect((await pending).status).toBe(503);
    release([publicIp]);
    await Promise.resolve();
    expect(f.calls.transport).toEqual([]);
  });
  test("abort while waiting for upstream headers reaches transport signal", async () => {
    const controller = new AbortController();
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    let upstreamSignal: AbortSignal | undefined;
    const f = fixture({
      transport: (_url, _address, _form, signal) => {
        upstreamSignal = signal;
        started();
        return new Promise(() => {});
      },
    });
    const pending = handleSearch(request({}, { signal: controller.signal }), f.dependencies);
    await began;
    controller.abort();
    expect((await pending).status).toBe(503);
    expect(upstreamSignal?.aborted).toBe(true);
  });
  test("abort while streaming cancels body and never returns a partial success", async () => {
    const controller = new AbortController();
    let reading!: () => void;
    const began = new Promise<void>((resolve) => {
      reading = resolve;
    });
    let cancelled = false;
    const f = fixture({
      transport: async () => ({
        status: 200,
        contentType: "application/json",
        body: new ReadableStream<Uint8Array>({
          pull() {
            reading();
          },
          cancel() {
            cancelled = true;
          },
        }),
      }),
    });
    const pending = handleSearch(request({}, { signal: controller.signal }), f.dependencies);
    await began;
    await Promise.resolve();
    controller.abort();
    expect((await pending).status).toBe(503);
    expect(cancelled).toBe(true);
  });
  test.each([
    ["speed", 8000],
    ["balanced", 12000],
  ] as const)("%s timer covers slow upstream body with %i ms retrieval budget", async (mode, timeoutMs) => {
    const realSetTimeout = globalThis.setTimeout;
    const scheduled: { callback: () => void; delay: number }[] = [];
    globalThis.setTimeout = ((callback: () => void, delay: number) => {
      scheduled.push({ callback, delay });
      return realSetTimeout(() => {}, 60_000);
    }) as typeof setTimeout;
    try {
      let started!: () => void;
      const began = new Promise<void>((resolve) => {
        started = resolve;
      });
      let cancelled = false;
      const f = fixture({
        transport: async () => ({
          status: 200,
          contentType: "application/json",
          body: new ReadableStream<Uint8Array>({
            pull() {
              started();
            },
            cancel() {
              cancelled = true;
            },
          }),
        }),
      });
      const pending = handleSearch(request({ mode }), f.dependencies);
      await began;
      await Promise.resolve();
      expect(scheduled.map((item) => item.delay)).toEqual([12000, timeoutMs]);
      scheduled[1]!.callback();
      expect((await pending).status).toBe(503);
      expect(cancelled).toBe(true);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });
});
