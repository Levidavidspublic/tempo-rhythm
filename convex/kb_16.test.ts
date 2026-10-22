import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import * as approval from "./approval";
import * as coach from "./coach";
import * as search from "./search";
import type { AiCallOptions, AiResult, callLLM } from "./lib/ai_router";
import { DEFAULT_SEARCH_OPTIONS, emptySearchLookup, kbSearchCapabilities, lookupConfiguredSearch, normalizeSearchOptions, searchHostname, validateLookupQuery, type SearchOptions } from "./lib/webSearch";
type Row = Record<string, unknown> & { _id: string };

const A = "users:a";
const B = "users:b";
const PENDING = "users:pending";

function makeWorld() {
  const tables = new Map<string, Map<string, Row>>();
  let nextId = 1;
  const table = (name: string) => {
    let t = tables.get(name);
    if (!t) {
      t = new Map();
      tables.set(name, t);
    }
    return t;
  };
  for (const user of [
    { _id: A, email: "a@example.com", approvalStatus: "approved" },
    { _id: B, email: "b@example.com", approvalStatus: "approved" },
    { _id: PENDING, email: "p@example.com", approvalStatus: "pending" },
  ]) {
    table("users").set(user._id, { _creationTime: 0, ...user });
  }
  function builder(rows: Row[]) {
    return {
      withIndex: (_name: string, fn: (q: unknown) => unknown) => {
        const conds: Array<(row: Row) => boolean> = [];
        // Index order for numbers and strings (a UTC date key); anything else never matches a range.
        const order = (a: unknown, b: number | string) =>
          typeof a === "number" && typeof b === "number"
            ? a - b
            : typeof a === "string" && typeof b === "string"
              ? a < b ? -1 : a > b ? 1 : 0
              : Number.NaN;
        const cmp = (test: (diff: number) => boolean) => (field: string, value: number | string) => {
          conds.push((row) => test(order(row[field], value)));
          return q;
        };
        const q = {
          eq: (field: string, value: unknown) => {
            conds.push((row) => row[field] === value);
            return q;
          },
          gte: cmp((diff) => diff >= 0),
          lt: cmp((diff) => diff < 0),
        };
        fn(q);
        return builder(rows.filter((row) => conds.every((c) => c(row))));
      },
      order: (direction: "asc" | "desc") => builder(direction === "desc" ? [...rows].reverse() : rows),
      collect: async () => [...rows],
      [Symbol.asyncIterator]: async function* () {
        yield* rows;
      },
      take: async (n: number) => rows.slice(0, n),
      first: async () => rows[0] ?? null,
    };
  }
  const db = {
    normalizeId: (t: string, id: string) => (table(t).has(id) ? id : null),
    get: async (id: string) => table(id.split(":")[0] as string).get(id) ?? null,
    insert: async (t: string, doc: Record<string, unknown>) => {
      const id = `${t}:${nextId}`;
      table(t).set(id, { _id: id, _creationTime: nextId, ...doc });
      nextId += 1;
      return id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const t = table(id.split(":")[0] as string);
      const existing = t.get(id);
      if (!existing) throw new Error(`patch on missing row ${id}`);
      t.set(id, { ...existing, ...patch });
    },
    delete: async (id: string) => {
      table(id.split(":")[0] as string).delete(id);
    },
    query: (t: string) => builder(Array.from(table(t).values())),
  };
  const as = (userId: string) =>
    ({ auth: { getUserIdentity: async () => ({ subject: `${userId}|session` }) }, db }) as unknown as MutationCtx;
  const handlers: Record<string, unknown> = {
    "approval:assertApprovedForAi": approval.assertApprovedForAi,
    "coach:claimTurn": coach.claimTurn,
    "coach:releaseTurn": coach.releaseTurn,
    "coach:saveReply": coach.saveReply,
    "coach:reserveWebSearch": coach.reserveWebSearch,
    "coach:researchRequestState": coach.researchRequestState,
    "search:reserveLookup": search.reserveLookup,
  };
  /** An action ctx whose runQuery / runMutation run the named handler as the same user. */
  const actionAs = (userId: string) => {
    const dispatch = (ref: unknown, args: unknown) => {
      const handler = handlers[getFunctionName(ref as never)];
      if (!handler) throw new Error(`unexpected call ${getFunctionName(ref as never)}`);
      return run(handler, as(userId), args);
    };
    return { runQuery: dispatch, runMutation: dispatch } as unknown as ActionCtx;
  };
  return { db, as, actionAs, rows: (t: string) => Array.from(table(t).values()), row: (id: string) => table(id.split(":")[0] as string).get(id) };
}

// biome-ignore lint/suspicious/noExplicitAny: handler results are inspected field by field below.
type Handler = { _handler: (ctx: unknown, args: unknown) => Promise<any> };
const run = (fn: unknown, ctx: unknown, args: unknown) => (fn as Handler)._handler(ctx, args);

type World = ReturnType<typeof makeWorld>;

async function seedConversation(world: World, userId = A) {
  return (await world.db.insert("conversations", {
    userId,
    title: "Chat",
    createdAt: 1,
    updatedAt: 1,
  })) as Id<"conversations">;
}

/** A stand-in for `callLLM` that records each call and answers with `content`. */
function fakeModel(content: string | (() => never)) {
  const calls: AiCallOptions[] = [];
  const call = (async (opts: AiCallOptions): Promise<AiResult> => {
    calls.push(opts);
    if (typeof content === "function") content();
    return {
      tier: opts.tier,
      requestedTier: opts.tier,
      model: "test-model",
      content: content as string,
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      escalated: false,
    };
  }) as typeof callLLM;
  return { call, calls };
}

const OPTIONS = DEFAULT_SEARCH_OPTIONS;
const ENV = { TEMPO_SEARCH_SERVICE_URL: "https://fictional-tempo.vercel.app/api/search", TEMPO_SEARCH_SERVICE_TOKEN: "fictional-test-token-with-32-characters" };
const ROW = { title: "Source", site: "example.com", url: "https://example.com/article", snippet: "RAM_ONLY_SNIPPET", imageUrl: null, thumbnailUrl: null, durationSeconds: null, publishedAt: null };
function response(rows: unknown[] = [ROW]) { return Response.json({ status: "ok", rows, retrievedAt: 123, truncated: false }); }
async function ready() {
  const world = makeWorld(), conversationId = await seedConversation(world);
  await world.db.insert("userPreferences", { userId: A, theme: "system", locale: "en", weekStartsOn: 1, timeZone: "UTC", emailReminders: true, inAppNotifications: true, coachWebSearch: true });
  await run(coach.sendMessage, world.as(A), { conversationId, content: "Find a source about planning" });
  return { world, conversationId };
}
let old: (string | undefined)[];
let logs: ReturnType<typeof spyOn>;
beforeEach(() => { old = Object.keys(ENV).map((key) => process.env[key]); Object.assign(process.env, ENV); logs = spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { Object.keys(ENV).forEach((key, i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; }); logs.mockRestore(); });
describe.serial("KB-16 capability-gated retrieval", () => {
  test("capabilities advertise only configured web Speed and Balanced", () => {
    expect(kbSearchCapabilities({})).toEqual({ enabled: false, modes: [], sources: [], categories: [] });
    expect(kbSearchCapabilities(ENV)).toEqual({ enabled: true, modes: ["speed", "balanced"], sources: ["web"], categories: ["web"] });
    expect(OPTIONS).toEqual({ mode: "balanced", sources: ["web"], domains: [] });
  });
  test("IDNA domains normalize and refuse credentials, paths, ports and IP forms", () => {
    expect(normalizeSearchOptions({ ...OPTIONS, domains: ["EXAMPLE.com.", "bücher.de"] }).domains).toEqual(["example.com", "xn--bcher-kva.de"]);
    for (const host of ["user@host.com", "example.com/path", "example.com:8080", "127.0.0.1", "2130706433", "0x7f000001", "[::1]", "localhost", "host.local"]) expect(searchHostname(host)).toBeNull();
    expect(() => normalizeSearchOptions({ ...OPTIONS, sources: ["web", "web"] })).toThrow("invalid_search_options");
    expect(() => normalizeSearchOptions({ ...OPTIONS, domains: ["example.com:8080"] })).toThrow("invalid_search_options");
  });
  test("queries count Unicode code points, support Hebrew and reject controls", () => {
    expect(validateLookupQuery(" שלום ")).toBe("שלום"); expect(validateLookupQuery("🙂".repeat(200))).toHaveLength(400);
    for (const text of ["", "a".repeat(201), "a\nb"]) expect(() => validateLookupQuery(text)).toThrow("invalid_query");
  });
  test("Speed caps three results and forwards exact modes/domains", async () => {
    let sent: unknown;
    const out = await lookupConfiguredSearch("שלום", { ...OPTIONS, mode: "speed", domains: ["example.com"] }, "web", undefined, ENV,
      (async (_url, init) => { sent = JSON.parse(String(init?.body)); return response(Array.from({ length: 6 }, (_, i) => ({ ...ROW, url: `https://example.com/${i}` }))); }) as typeof fetch);
    expect(out.rows).toHaveLength(3); expect(out.truncated).toBe(true); expect(sent).toMatchObject({ query: "שלום", mode: "speed", domains: ["example.com"], category: "web" });
  });
  test("Balanced caps five; strips HTML and rejects domain suffix spoofing", async () => {
    const out = await lookupConfiguredSearch("query", { ...OPTIONS, domains: ["example.com"] }, "web", undefined, ENV,
      (async () => response([{ ...ROW, url: "https://example.com.evil.net/" }, ...Array.from({ length: 7 }, (_, i) => ({ ...ROW, title: "<b>Title</b>", snippet: "<script>bad</script><p>text</p>", url: `https://sub.example.com/${i}` }))])) as typeof fetch);
    expect(out.rows).toHaveLength(5); expect(out.rows[0]).toMatchObject({ title: "Title", snippet: "text", site: "sub.example.com" });
  });
  test("unset configuration never falls back to a model or network", async () => {
    let called = false;
    expect((await lookupConfiguredSearch("query", OPTIONS, "web", undefined, {}, (async () => { called = true; return response(); }) as typeof fetch)).status).toBe("off");
    expect(called).toBe(false);
  });
  test("Quality/media/Discover/source families are unsupported without a fetch", async () => {
    let calls = 0; const transport = (async () => { calls++; return response(); }) as typeof fetch;
    for (const category of ["images", "videos", "discover"] as const) expect((await lookupConfiguredSearch("query", OPTIONS, category, undefined, ENV, transport)).status).toBe("unsupported");
    for (const sources of [["academic"], ["discussions"], ["web", "academic"]] as SearchOptions["sources"][]) expect((await lookupConfiguredSearch("query", { ...OPTIONS, sources }, "web", undefined, ENV, transport)).status).toBe("unsupported");
    expect((await lookupConfiguredSearch("query", { ...OPTIONS, mode: "quality" }, "web", undefined, ENV, transport)).status).toBe("unsupported"); expect(calls).toBe(0);
  });
  test("private/rebinding-capable arbitrary gateway hosts are refused before fetch", async () => {
    let calls = 0;
    for (const url of ["http://127.0.0.1/api/search", "https://[::ffff:127.0.0.1]/api/search", "https://169.254.169.254/api/search", "https://attacker.com/api/search", "https://tempo.vercel.app.evil.com/api/search", "https://tempo.vercel.app:444/api/search"]) {
      expect((await lookupConfiguredSearch("query", OPTIONS, "web", undefined, { ...ENV, TEMPO_SEARCH_SERVICE_URL: url }, (async () => { calls++; return response(); }) as typeof fetch)).status).toBe("off");
    }
    expect(calls).toBe(0);
  });
  test("redirects never follow a private destination or forward credentials", async () => {
    let calls = 0;
    const result = await lookupConfiguredSearch("query", OPTIONS, "web", undefined, ENV, (async (_url, init) => {
      calls++; expect(init?.redirect).toBe("error"); return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/" } });
    }) as typeof fetch);
    expect(result.status).toBe("unavailable"); expect(calls).toBe(1);
  });
  test("unsafe source URLs and all media payloads are discarded", async () => {
    const credentialUrl = new URL("https://example.com");
    credentialUrl.username = "fixture-user"; credentialUrl.password = "fixture-password";
    const result = await lookupConfiguredSearch("query", OPTIONS, "web", undefined, ENV, (async () => response([
      ...["http://127.0.0.1/a", "https://[::1]/", "javascript:alert(1)", credentialUrl.href].map((url) => ({ ...ROW, url })),
      { ...ROW, imageUrl: "http://127.0.0.1", thumbnailUrl: "data:bad" },
    ])) as typeof fetch);
    expect(result.rows).toEqual([ROW]);
  });
  test("deadlines use real fetch and body cancellation for both supported modes", async () => {
    for (const mode of ["speed", "balanced"] as const) {
      let timer!: () => void, milliseconds = 0, cancelled = false;
      const timeout = spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms: number) => { timer = fn; milliseconds = ms; return 1; }) as typeof setTimeout);
      let entered!: () => void; const started = new Promise<void>((resolve) => { entered = resolve; });
      try {
        const result = lookupConfiguredSearch("query", { ...OPTIONS, mode }, "web", undefined, ENV, (async (_url, init) => {
          init?.signal?.addEventListener("abort", () => { cancelled = true; });
          return new Response(new ReadableStream<Uint8Array>({ pull() { entered(); }, cancel() { cancelled = true; } }), { headers: { "Content-Type": "application/json" } });
        }) as typeof fetch);
        await started; timer(); expect((await result).status).toBe("unavailable"); expect(cancelled).toBe(true); expect(milliseconds).toBe(mode === "speed" ? 8000 : 12000);
      } finally { timeout.mockRestore(); }
    }
  });
  test("pre-cancelled transport starts no request; excessive body is unavailable", async () => {
    const controller = new AbortController(); controller.abort(); let calls = 0;
    await expect(lookupConfiguredSearch("query", OPTIONS, "web", controller.signal, ENV, (async () => { calls++; return response(); }) as typeof fetch)).rejects.toMatchObject({ kind: "cancelled" }); expect(calls).toBe(0);
    expect((await lookupConfiguredSearch("query", OPTIONS, "web", undefined, ENV, (async () => new Response("x".repeat(65537), { headers: { "Content-Type": "application/json" } })) as typeof fetch)).status).toBe("unavailable");
  });
  test("lookup crisis uses no reservation, network or model; unsupported Discover is explicit", async () => {
    const { world } = await ready(); let calls = 0;
    const lookup = (async () => { calls++; return emptySearchLookup("ok"); }) as typeof lookupConfiguredSearch;
    expect((await search.runSearchLookup(world.actionAs(A), { query: "I want to kill myself", options: OPTIONS, category: "web" }, lookup)).status).toBe("crisis");
    expect((await search.runSearchLookup(world.actionAs(A), { query: "query", options: OPTIONS, category: "discover" }, lookup)).status).toBe("unsupported");
    expect(calls).toBe(0); expect(world.rows("coachWebSearches")).toHaveLength(0);
  });
  test("lookup and coach share the existing ten-per-UTC-day counter", async () => {
    const { world, conversationId } = await ready();
    const turn = await run(coach.claimTurn, world.as(A), { conversationId });
    expect(await run(coach.reserveWebSearch, world.as(A), { conversationId, replyTo: turn.replyTo, claim: turn.claim })).toBe("reserved");
    for (let i = 0; i < 9; i++) expect(await run(search.reserveLookup, world.as(A), {})).toEqual({ status: "reserved" });
    expect(await run(search.reserveLookup, world.as(A), {})).toEqual({ status: "limit" });
    expect(world.rows("coachWebSearches")).toHaveLength(10);
    for (const row of world.rows("coachWebSearches")) expect(Object.keys(row).sort()).toEqual(["_id", "_creationTime", "userId", "utcDateKey", "createdAt", "updatedAt"].sort());
  });
  test("pending lookup is refused before provider; a disabled preference returns off", async () => {
    const { world } = await ready(); let calls = 0;
    const lookup = (async () => { calls++; return emptySearchLookup("ok"); }) as typeof lookupConfiguredSearch;
    await expect(search.runSearchLookup(world.actionAs(PENDING), { query: "query", options: OPTIONS, category: "web" }, lookup)).rejects.toThrow();
    await world.db.patch(world.rows("userPreferences")[0]!._id, { coachWebSearch: false });
    expect((await search.runSearchLookup(world.actionAs(A), { query: "query", options: OPTIONS, category: "web" }, lookup)).status).toBe("off"); expect(calls).toBe(0);
  });
  test("strict unsupported and limit return unavailable before a model call", async () => {
    const { world, conversationId } = await ready(), model = fakeModel('{"reply":"answer","proposal":null}');
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId, searchOptions: { ...OPTIONS, mode: "quality" } }, model.call, null)).toBe("unavailable");
    for (let i = 0; i < 10; i++) await run(search.reserveLookup, world.as(A), {});
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId, searchOptions: OPTIONS }, model.call, null)).toBe("unavailable"); expect(model.calls).toHaveLength(0);
  });
  test("strict retrieval ok uses the same tier/tokens and stores citations without snippets", async () => {
    const { world, conversationId } = await ready();
    const first = fakeModel('{"reply":"Looking","proposal":null,"search":"planning"}'), second = fakeModel('{"reply":"Source says this [1]."}');
    const call = (async (args: AiCallOptions) => first.calls.length ? second.call(args) : first.call(args)) as typeof callLLM;
    const lookup = (async () => ({ status: "ok", rows: [ROW], retrievedAt: 123, truncated: false })) as typeof lookupConfiguredSearch;
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId, searchOptions: OPTIONS }, call, null, undefined, lookup)).toBe("replied");
    expect(first.calls).toHaveLength(1); expect(second.calls).toHaveLength(1); expect(second.calls[0]).toMatchObject({ tier: "balanced", maxTokens: 900 });
    expect(JSON.stringify(world.rows("messages"))).not.toContain("RAM_ONLY_SNIPPET");
    expect(world.rows("messages").at(-1)?.sources).toEqual([{ title: ROW.title, site: ROW.site, url: ROW.url }]);
  });
  test("strict provider off continues plain reply; other outcomes do not add model calls", async () => {
    for (const status of ["off", "limit", "unsupported", "unavailable"] as const) {
      const { world, conversationId } = await ready(), model = fakeModel('{"reply":"Looking","proposal":null,"search":"planning"}');
      const lookup = (async () => emptySearchLookup(status)) as typeof lookupConfiguredSearch;
      expect(await coach.runCoachReply(world.actionAs(A), { conversationId, searchOptions: OPTIONS }, model.call, null, undefined, lookup)).toBe(status === "off" ? "replied" : "unavailable");
      expect(model.calls).toHaveLength(1); expect(world.rows("messages")).toHaveLength(status === "off" ? 2 : 1);
    }
  });
  test("strict crisis history commits only the existing safe card with zero model calls", async () => {
    const { world, conversationId } = await ready();
    const user = world.rows("messages")[0]!; await world.db.patch(user._id, { content: "I want to kill myself" });
    await run(coach.sendMessage, world.as(A), { conversationId, content: "Help me now" });
    const model = fakeModel("unused");
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId, searchOptions: OPTIONS }, model.call, null)).toBe("replied");
    expect(model.calls).toHaveLength(0); expect(world.rows("messages").at(-1)?.modelUsed).toBe("crisis-card");
  });
  test("idle, busy and superseded keep their original ownership meanings", async () => {
    const { world, conversationId } = await ready(), model = fakeModel('{"reply":"Looking","proposal":null,"search":"planning"}');
    const turn = await run(coach.claimTurn, world.as(A), { conversationId });
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId, searchOptions: OPTIONS }, model.call, null)).toBe("busy");
    await run(coach.releaseTurn, world.as(A), { conversationId, messageId: turn.replyTo, claim: turn.claim });
    const lookup = (async () => { await run(coach.sendMessage, world.as(A), { conversationId, content: "New turn" }); return { status: "ok", rows: [ROW], retrievedAt: 1, truncated: false }; }) as typeof lookupConfiguredSearch;
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId, searchOptions: OPTIONS }, model.call, null, undefined, lookup)).toBe("superseded");
    const empty = await seedConversation(world); expect(await coach.runCoachReply(world.actionAs(A), { conversationId: empty, searchOptions: OPTIONS }, model.call, null)).toBe("idle");
  });
  test("owned gateway research cancellation cannot persist or start a second model call", async () => {
    const { world, conversationId } = await ready();
    const requestId = "00000000-0000-4000-8000-000000000016";
    const begun = await run(coach.beginReply, world.as(A), { conversationId, requestId, research: { useWeb: true, thinkHard: false } });
    const key = { conversationId, requestId, replyTo: begun.replyTo as Id<"messages"> };
    let entered!: () => void, body!: ReadableStreamDefaultController<Uint8Array>;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const transport = spyOn(globalThis, "fetch").mockImplementation((async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { body = controller; entered(); } }),
      { headers: { "Content-Type": "application/json" } })) as typeof fetch);
    const model = fakeModel('{"reply":"Looking","proposal":null,"search":"planning"}');
    try {
      const result = coach.runControlledReply(world.actionAs(A), key, model.call, null);
      await started; await run(coach.cancelReply, world.as(A), key);
      body.enqueue(new TextEncoder().encode(JSON.stringify({ status: "ok", rows: [ROW], retrievedAt: 1, truncated: false }))); body.close();
      expect(await result).toBe("cancelled"); expect(model.calls).toHaveLength(1); expect(world.rows("messages")).toHaveLength(1);
    } finally { transport.mockRestore(); }
  });
});

