import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import * as approval from "./approval";
import { VOICE_LIMITS } from "./lib/voicePolicy";
import * as voice from "./voice";

/**
 * Voice mode backend (docs/contracts/VOICE.md defaults): leases with admission, renewal, budgets
 * and revocation; a 30-second Deepgram token per lease; one coach-reply sentence at a time to TTS,
 * resolved on the server. The db is in memory; `fetch` is a stand-in; keys are fake names.
 */

type Row = Record<string, unknown> & { _id: string };

const A = "users:a";
const B = "users:b";

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
  // Every account is granted "max" today (convex/lib/entitlements.ts).
  table("users").set(A, { _id: A, _creationTime: 0, email: "a@example.com", approvalStatus: "approved", entitlementTier: "max" });
  table("users").set(B, { _id: B, _creationTime: 0, email: "b@example.com", approvalStatus: "approved", entitlementTier: "max" });
  function builder(rows: Row[]) {
    return {
      withIndex: (_name: string, fn: (q: unknown) => unknown) => {
        const conds: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq: (field: string, value: unknown) => {
            conds.push({ field, value });
            return q;
          },
        };
        fn(q);
        return builder(rows.filter((row) => conds.every((c) => row[c.field] === c.value)));
      },
      collect: async () => [...rows],
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
    query: (t: string) => builder(Array.from(table(t).values())),
  };
  const as = (userId: string) =>
    ({ auth: { getUserIdentity: async () => ({ subject: `${userId}|session` }) }, db }) as unknown as MutationCtx;
  const handlers: Record<string, unknown> = {
    "approval:assertApprovedForAi": approval.assertApprovedForAi,
    "voice:admitGrant": voice.admitGrant,
    "voice:admitSentence": voice.admitSentence,
  };
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

async function conversation(world: World, userId = A) {
  return (await world.db.insert("conversations", { userId, title: "Chat", createdAt: 1, updatedAt: 1 })) as Id<"conversations">;
}

async function reply(world: World, conversationId: Id<"conversations">, content: string, modelUsed = "test-model") {
  return (await world.db.insert("messages", { conversationId, role: "assistant", content, modelUsed, createdAt: 2 })) as Id<"messages">;
}

const KEYS = { DEEPGRAM_API_KEY: "dg-test-key-not-real", DEEPINFRA_API_KEY: "di-test-key-not-real" };
const saved: Record<string, string | undefined> = {};
let errorLog: ReturnType<typeof spyOn>;
beforeEach(() => {
  for (const [name, value] of Object.entries(KEYS)) {
    saved[name] = process.env[name];
    process.env[name] = value;
  }
  errorLog = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const name of Object.keys(KEYS)) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  errorLog.mockRestore();
});

async function startSession(world: World, conversationId: Id<"conversations">, clientKey = "client_key_1", userId = A) {
  return run(voice.start, world.as(userId), { conversationId, clientKey });
}

describe("starting a voice session", () => {
  test("an approved person with both keys set gets an English lease on their conversation", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    expect(await run(voice.availability, world.as(A), {})).toEqual({
      available: true,
      reason: null,
      minutesLeft: VOICE_LIMITS.dailyMinutesPerUser,
    });
    const started = await startSession(world, conversationId);
    expect(started).toMatchObject({ language: "en", renewEveryMs: VOICE_LIMITS.renewEveryMs, minutesLeft: VOICE_LIMITS.dailyMinutesPerUser });
    expect(world.row(started.sessionId)).toMatchObject({ userId: A, conversationId, status: "active", grants: 0, ttsChars: 0 });
  });

  test("off without either key, and nothing is stored", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    delete process.env.DEEPGRAM_API_KEY;
    expect((await run(voice.availability, world.as(A), {})).reason).toBe("off");
    await expect(startSession(world, conversationId)).rejects.toThrow("isn't switched on");
    process.env.DEEPGRAM_API_KEY = KEYS.DEEPGRAM_API_KEY;
    delete process.env.DEEPINFRA_API_KEY;
    await expect(startSession(world, conversationId)).rejects.toThrow("isn't switched on");
    expect(world.rows("voiceSessions")).toHaveLength(0);
  });

  test("a pending account, someone else's conversation, or Hebrew is refused", async () => {
    const world = makeWorld();
    const mine = await conversation(world);
    const theirs = await conversation(world, B);
    await expect(startSession(world, theirs)).rejects.toThrow();
    await world.db.insert("userPreferences", { userId: A, locale: "he", timeZone: "Asia/Jerusalem", theme: "system", weekStartsOn: 0, emailReminders: false, inAppNotifications: true, createdAt: 1, updatedAt: 1 });
    expect((await run(voice.availability, world.as(A), {})).reason).toBe("language");
    await expect(startSession(world, mine)).rejects.toThrow("this language");
    await world.db.patch(A, { approvalStatus: "pending" });
    await expect(startSession(world, mine)).rejects.toThrow();
    expect(world.rows("voiceSessions")).toHaveLength(0);
  });

  test("the same client key returns the same lease; a new start ends the older one", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const first = await startSession(world, conversationId, "client_key_1");
    expect((await startSession(world, conversationId, "client_key_1")).sessionId).toBe(first.sessionId);
    const second = await startSession(world, conversationId, "client_key_2");
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(world.row(first.sessionId)).toMatchObject({ status: "ended", endReason: "replaced" });
  });

  test("today's minutes and the global ceiling are enforced", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    await world.db.insert("voiceSessions", {
      userId: A, conversationId, clientKey: "old_key_1", status: "ended", language: "en",
      // 14.5 of the 15 minutes used: less than the 1 minute a start needs.
      startedAt: now - 20.5 * 60_000, lastRenewalAt: now - 6 * 60_000, endedAt: now - 6 * 60_000,
      dateKey: today, utcDateKey: today, grants: 1, sentences: 0, ttsChars: 0, createdAt: 1, updatedAt: 1,
    });
    expect(await run(voice.availability, world.as(A), {})).toMatchObject({ available: false, reason: "budget", minutesLeft: 0 });
    await expect(startSession(world, conversationId)).rejects.toThrow("today's voice time");

    const other = await conversation(world, B);
    await world.db.insert("voiceSessions", {
      userId: "users:many", conversationId: other, clientKey: "many_key_1", status: "ended", language: "en",
      startedAt: now - 200 * 60_000, lastRenewalAt: now, endedAt: now - 81 * 60_000,
      dateKey: today, utcDateKey: today, grants: 1, sentences: 0, ttsChars: 0, createdAt: 1, updatedAt: 1,
    });
    await expect(startSession(world, other, "client_key_b", B)).rejects.toThrow("resting for today");
  });

  test("the cap comes from the person's tier, held under the preview cap; no tier gets no live voice", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    await world.db.patch(A, { entitlementTier: "none" });
    expect(await run(voice.availability, world.as(A), {})).toMatchObject({ available: false, reason: "budget", minutesLeft: 0 });
    await expect(startSession(world, conversationId)).rejects.toThrow("today's voice time");
    await world.db.patch(A, { entitlementTier: undefined });
    await expect(startSession(world, conversationId)).rejects.toThrow("today's voice time");
    await world.db.patch(A, { entitlementTier: "basic" });
    expect((await startSession(world, conversationId)).minutesLeft).toBe(Math.min(30, VOICE_LIMITS.dailyMinutesPerUser));
    expect(world.rows("voiceSessions")).toHaveLength(1);
  });

  test("availability says voice is resting once everyone's minutes are spent, while the person still has theirs", async () => {
    const world = makeWorld();
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    await world.db.insert("voiceSessions", {
      userId: B, conversationId: await conversation(world, B), clientKey: "many_key_1", status: "ended", language: "en",
      startedAt: now - 200 * 60_000, lastRenewalAt: now, endedAt: now - 79.5 * 60_000,
      dateKey: "2000-01-01", utcDateKey: today, grants: 1, sentences: 0, ttsChars: 0, createdAt: 1, updatedAt: 1,
    });
    expect(await run(voice.availability, world.as(A), {})).toEqual({
      available: false,
      reason: "resting",
      minutesLeft: VOICE_LIMITS.dailyMinutesPerUser,
    });
  });

  test("a day with more session rows than can be read counts as spent: the global ceiling fails closed", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i <= VOICE_LIMITS.globalRowsPerDay; i += 1) {
      await world.db.insert("voiceSessions", {
        userId: `users:many${i}`, conversationId, clientKey: `many_key_${i}`, status: "ended", language: "en",
        startedAt: 1_000, lastRenewalAt: 1_000, endedAt: 1_001, durationMs: 1,
        dateKey: "2000-01-01", utcDateKey: today, grants: 0, sentences: 0, ttsChars: 0, createdAt: 1, updatedAt: 1,
      });
    }
    expect((await run(voice.availability, world.as(A), {})).reason).toBe("resting");
    await expect(startSession(world, conversationId)).rejects.toThrow("resting for today");
  });

  test("one person can start only so many sessions a day, however short", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    for (let i = 0; i < VOICE_LIMITS.sessionsPerUserPerDay; i += 1) {
      await world.db.insert("voiceSessions", {
        userId: A, conversationId, clientKey: `short_key_${i}`, status: "ended", language: "en",
        startedAt: now - 1_000, lastRenewalAt: now - 1_000, endedAt: now - 999, durationMs: 1,
        dateKey: today, utcDateKey: today, grants: 0, sentences: 0, ttsChars: 0, createdAt: 1, updatedAt: 1,
      });
    }
    await expect(startSession(world, conversationId)).rejects.toThrow("today's voice time");
  });
});

describe("renew and stop", () => {
  test("renewal keeps a lease alive; silence past the window expires it", async () => {
    const world = makeWorld();
    const { sessionId } = await startSession(world, await conversation(world));
    expect((await run(voice.renew, world.as(A), { sessionId })).status).toBe("ok");
    const lease = world.row(sessionId) as Row;
    await world.db.patch(sessionId, { lastRenewalAt: Date.now() - VOICE_LIMITS.leaseExpiresAfterMs - 1, startedAt: Date.now() - 120_000 });
    expect((await run(voice.renew, world.as(A), { sessionId })).status).toBe("expired");
    const ended = world.row(sessionId) as Row;
    expect(ended).toMatchObject({ status: "ended", endReason: "expired" });
    // Counted to the last renewal plus one interval, never to now.
    expect(ended.durationMs as number).toBeLessThan(120_000);
    expect(lease.status).toBe("active");
  });

  test("a revoked account or a deleted conversation ends the lease at the next renewal", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const { sessionId } = await startSession(world, conversationId);
    await world.db.patch(A, { approvalStatus: "revoked" });
    expect((await run(voice.renew, world.as(A), { sessionId })).status).toBe("revoked");
    await world.db.patch(A, { approvalStatus: "approved" });
    const second = await startSession(world, conversationId, "client_key_2");
    await world.db.patch(conversationId, { deletedAt: Date.now() });
    expect((await run(voice.renew, world.as(A), { sessionId: second.sessionId })).status).toBe("revoked");
  });

  test("running out of today's minutes mid-session ends it as exhausted", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const { sessionId } = await startSession(world, conversationId);
    const lease = world.row(sessionId) as Row;
    const now = Date.now();
    // An earlier lease today used all but 30 s; this one has run 2 minutes, far from the session
    // limit, so only the budget can end it (no clock race with the 15-minute maximum).
    await world.db.insert("voiceSessions", {
      userId: A, conversationId, clientKey: "earlier_key", status: "ended", language: "en",
      startedAt: now - 60 * 60_000, lastRenewalAt: now - 46 * 60_000,
      endedAt: now - 60 * 60_000 + VOICE_LIMITS.dailyMinutesPerUser * 60_000 - 30_000,
      dateKey: lease.dateKey, utcDateKey: lease.utcDateKey, grants: 1, sentences: 0, ttsChars: 0, createdAt: 1, updatedAt: 1,
    });
    await world.db.patch(sessionId, { startedAt: now - 120_000, lastRenewalAt: now - 1_000 });
    expect((await run(voice.renew, world.as(A), { sessionId })).status).toBe("exhausted");
    expect(world.row(sessionId)).toMatchObject({ status: "ended", endReason: "exhausted" });
  });

  test("stop is idempotent and someone else can't touch the lease", async () => {
    const world = makeWorld();
    const { sessionId } = await startSession(world, await conversation(world));
    await expect(run(voice.stop, world.as(B), { sessionId })).rejects.toThrow("ended");
    await run(voice.stop, world.as(A), { sessionId });
    await run(voice.stop, world.as(A), { sessionId });
    expect(world.row(sessionId)).toMatchObject({ status: "ended", endReason: "stopped" });
  });
});

function fakeFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const spy = spyOn(globalThis, "fetch").mockImplementation((async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return respond(url, init ?? {});
  }) as typeof fetch);
  return { calls, restore: () => spy.mockRestore() };
}

describe("grant: a 30-second Deepgram token per lease", () => {
  test("mints with the key on the server and returns only the token and the chosen socket URL", async () => {
    const world = makeWorld();
    const { sessionId } = await startSession(world, await conversation(world));
    const net = fakeFetch(() => Response.json({ access_token: "jwt-for-the-browser-0123456789", expires_in: 30 }));
    try {
      const granted = await run(voice.grant, world.actionAs(A), { sessionId });
      expect(granted).toEqual({ token: "jwt-for-the-browser-0123456789", url: "wss://api.deepgram.com/v2/listen?model=flux-general-en" });
      expect(JSON.stringify(granted)).not.toContain(KEYS.DEEPGRAM_API_KEY);
      expect(net.calls[0]?.url).toBe("https://api.deepgram.com/v1/auth/grant");
      expect(new Headers(net.calls[0]?.init.headers).get("authorization")).toBe(`Token ${KEYS.DEEPGRAM_API_KEY}`);
      expect(JSON.parse(String(net.calls[0]?.init.body))).toEqual({ ttl_seconds: 30 });
    } finally {
      net.restore();
    }
  });

  test("a few grants per lease, none for an ended lease, and a provider error says nothing of it", async () => {
    const world = makeWorld();
    const { sessionId } = await startSession(world, await conversation(world));
    const net = fakeFetch(() => Response.json({ access_token: "jwt-for-the-browser-0123456789" }));
    try {
      for (let i = 0; i < VOICE_LIMITS.grantsPerLease; i += 1) await run(voice.grant, world.actionAs(A), { sessionId });
      await expect(run(voice.grant, world.actionAs(A), { sessionId })).rejects.toThrow("ended");
    } finally {
      net.restore();
    }
    const second = await startSession(world, (world.row(sessionId) as Row).conversationId as Id<"conversations">, "client_key_2");
    const failing = fakeFetch(() => new Response("bad key dg-secret-in-body", { status: 401 }));
    try {
      const error = await run(voice.grant, world.actionAs(A), { sessionId: second.sessionId }).catch((e: Error) => e);
      expect(String(error)).toContain("couldn't connect");
      expect(String(error)).not.toContain("dg-secret");
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain("dg-secret");
    } finally {
      failing.restore();
    }
    await run(voice.stop, world.as(A), { sessionId: second.sessionId });
    await expect(run(voice.grant, world.actionAs(A), { sessionId: second.sessionId })).rejects.toThrow("ended");
  });

  test("a pending account gets no token and no provider call", async () => {
    const world = makeWorld();
    const { sessionId } = await startSession(world, await conversation(world));
    await world.db.patch(A, { approvalStatus: "pending" });
    const net = fakeFetch(() => Response.json({ access_token: "never" }));
    try {
      await expect(run(voice.grant, world.actionAs(A), { sessionId })).rejects.toThrow();
      expect(net.calls).toHaveLength(0);
    } finally {
      net.restore();
    }
  });
});

describe("speak: one sentence of a coach reply, resolved on the server", () => {
  const WAV = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);

  test("sends the server's sentence to Chatterbox and returns the audio; past the end is done", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const messageId = await reply(world, conversationId, "Start with Dana. Then the **report**.");
    const { sessionId } = await startSession(world, conversationId);
    const net = fakeFetch(() => new Response(WAV, { headers: { "content-type": "audio/wav" } }));
    try {
      const first = await run(voice.speak, world.actionAs(A), { sessionId, messageId, index: 0 });
      expect(first.status).toBe("audio");
      expect(first.mime).toBe("audio/wav");
      expect(first.count).toBe(2);
      expect(new Uint8Array(first.audio)).toEqual(WAV);
      expect(net.calls[0]?.url).toBe(voice.CHATTERBOX_URL);
      expect(JSON.parse(String(net.calls[0]?.init.body))).toEqual({ text: "Start with Dana.", language_id: "en" });
      expect(new Headers(net.calls[0]?.init.headers).get("authorization")).toBe(`Bearer ${KEYS.DEEPINFRA_API_KEY}`);
      await run(voice.speak, world.actionAs(A), { sessionId, messageId, index: 1 });
      expect(JSON.parse(String(net.calls[1]?.init.body)).text).toBe("Then the report.");
      expect(await run(voice.speak, world.actionAs(A), { sessionId, messageId, index: 2 })).toEqual({ status: "done" });
      expect(net.calls).toHaveLength(2);
      expect(world.row(sessionId)).toMatchObject({ sentences: 2, ttsChars: "Start with Dana.".length + "Then the report.".length });
    } finally {
      net.restore();
    }
  });

  test("JSON with a base64 data URL is decoded", async () => {
    const res = Response.json({ audio: `data:audio/mpeg;base64,${btoa(String.fromCharCode(...WAV))}` });
    const audio = await voice.audioFrom(res);
    expect(audio?.mime).toBe("audio/mpeg");
    expect(new Uint8Array(audio?.bytes ?? new ArrayBuffer(0))).toEqual(WAV);
    expect(await voice.audioFrom(Response.json({ nothing: true }))).toBeNull();
  });

  test("the crisis card is never read aloud and makes no provider call", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const card = await reply(world, conversationId, "You deserve support right now. Please reach out.", "crisis-card");
    const { sessionId } = await startSession(world, conversationId);
    const net = fakeFetch(() => new Response(WAV, { headers: { "content-type": "audio/wav" } }));
    try {
      expect(await run(voice.speak, world.actionAs(A), { sessionId, messageId: card, index: 0 })).toEqual({ status: "done" });
      expect(net.calls).toHaveLength(0);
    } finally {
      net.restore();
    }
  });

  test("another conversation's message, a user message, or a bad index is refused", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const elsewhere = await reply(world, await conversation(world), "Not this one.");
    const userMessage = (await world.db.insert("messages", { conversationId, role: "user", content: "Hi.", createdAt: 1 })) as Id<"messages">;
    const ok = await reply(world, conversationId, "Fine.");
    const { sessionId } = await startSession(world, conversationId);
    const net = fakeFetch(() => new Response(WAV, { headers: { "content-type": "audio/wav" } }));
    try {
      await expect(run(voice.speak, world.actionAs(A), { sessionId, messageId: elsewhere, index: 0 })).rejects.toThrow();
      await expect(run(voice.speak, world.actionAs(A), { sessionId, messageId: userMessage, index: 0 })).rejects.toThrow();
      await expect(run(voice.speak, world.actionAs(A), { sessionId, messageId: ok, index: -1 })).rejects.toThrow();
      await expect(run(voice.speak, world.actionAs(A), { sessionId, messageId: ok, index: 0.5 })).rejects.toThrow();
      expect(net.calls).toHaveLength(0);
    } finally {
      net.restore();
    }
  });

  test("today's read-aloud characters are capped", async () => {
    const world = makeWorld();
    const conversationId = await conversation(world);
    const messageId = await reply(world, conversationId, "One more sentence.");
    const { sessionId } = await startSession(world, conversationId);
    await world.db.patch(sessionId, { ttsChars: VOICE_LIMITS.dailyTtsCharsPerUser - 5 });
    const net = fakeFetch(() => new Response(WAV, { headers: { "content-type": "audio/wav" } }));
    try {
      expect(await run(voice.speak, world.actionAs(A), { sessionId, messageId, index: 0 })).toEqual({ status: "exhausted" });
      expect(net.calls).toHaveLength(0);
    } finally {
      net.restore();
    }
  });
});
