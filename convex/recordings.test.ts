import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import * as approval from "./approval";
import { UNDO_WINDOW_MS } from "./lib/softDelete";
import { VOICE_LIMITS } from "./lib/voicePolicy";
import * as recordings from "./recordings";

/**
 * Record a meeting or lecture (kitchen T8): the content-free lease and its budget (shared with
 * voice), the Deepgram token, proposals from the transcript, save and Undo. The db is in memory;
 * `fetch` is a stand-in; keys are fake names.
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
  const granted = { approvalStatus: "approved", entitlementTier: "max", userType: "paid" };
  table("users").set(A, { _id: A, _creationTime: 0, email: "a@example.com", ...granted });
  table("users").set(B, { _id: B, _creationTime: 0, email: "b@example.com", ...granted });
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
    "recordings:admitGrant": recordings.admitGrant,
    "recordings:releaseGrant": recordings.releaseGrant,
  };
  const actionAs = (userId: string) => {
    const dispatch = (ref: unknown, args: unknown) => {
      const handler = handlers[getFunctionName(ref as never)];
      if (!handler) throw new Error(`unexpected call ${getFunctionName(ref as never)}`);
      return run(handler, as(userId), args);
    };
    return { runQuery: dispatch, runMutation: dispatch } as unknown as ActionCtx;
  };
  return {
    db,
    as,
    actionAs,
    rows: (t: string) => Array.from(table(t).values()),
    row: (id: string) => table(id.split(":")[0] as string).get(id),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: handler results are inspected field by field below.
type Handler = { _handler: (ctx: unknown, args: unknown) => Promise<any> };
const run = (fn: unknown, ctx: unknown, args: unknown) => (fn as Handler)._handler(ctx, args);
type World = ReturnType<typeof makeWorld>;

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

const today = () => new Date(Date.now()).toISOString().slice(0, 10);

async function usedVoice(world: World, userId: string, minutes: number) {
  const now = Date.now();
  await world.db.insert("voiceSessions", {
    userId,
    conversationId: "conversations:x",
    clientKey: "old_key_1",
    status: "ended",
    language: "en",
    startedAt: now - minutes * 60_000 - 60_000,
    lastRenewalAt: now - 60_000,
    endedAt: now - 60_000,
    dateKey: today(),
    utcDateKey: today(),
    grants: 1,
    sentences: 0,
    ttsChars: 0,
    createdAt: 1,
    updatedAt: 1,
  });
}

describe("availability and start", () => {
  test("English with the key: live words, today's minutes, one active lease", async () => {
    const world = makeWorld();
    expect(await run(recordings.availability, world.as(A), { lang: "en" })).toEqual({
      live: true,
      reason: null,
      minutesLeft: VOICE_LIMITS.dailyMinutesPerUser,
      proposals: true,
    });
    const started = await run(recordings.start, world.as(A), { lang: "en" });
    expect(started).toMatchObject({ ok: true, renewEveryMs: VOICE_LIMITS.renewEveryMs, minutesLeft: VOICE_LIMITS.dailyMinutesPerUser });
    const row = world.row(started.sessionId);
    expect(row).toMatchObject({ userId: A, status: "active", lang: "en", grants: 0 });
    // Content-free: no words, audio or token fields on the lease.
    expect(Object.keys(row ?? {}).sort()).toEqual(
      ["_creationTime", "_id", "createdAt", "dateKey", "grants", "lang", "lastRenewalAt", "startedAt", "status", "updatedAt", "userId", "utcDateKey"].sort(),
    );
    const again = await run(recordings.start, world.as(A), { lang: "en" });
    expect(world.row(started.sessionId)).toMatchObject({ status: "ended", endReason: "replaced" });
    expect(world.row(again.sessionId)).toMatchObject({ status: "active" });
  });

  test("Hebrew is a typed language refusal and nothing is stored", async () => {
    const world = makeWorld();
    expect((await run(recordings.availability, world.as(A), { lang: "he" })).reason).toBe("language");
    expect(await run(recordings.start, world.as(A), { lang: "he" })).toEqual({ ok: false, reason: "language" });
    expect(world.rows("recordingSessions")).toHaveLength(0);
  });

  test("without the Deepgram key: no_key, typing still works", async () => {
    const world = makeWorld();
    delete process.env.DEEPGRAM_API_KEY;
    expect(await run(recordings.availability, world.as(A), { lang: "en" })).toMatchObject({ live: false, reason: "no_key", proposals: true });
    expect(await run(recordings.start, world.as(A), { lang: "en" })).toEqual({ ok: false, reason: "no_key" });
    expect(world.rows("recordingSessions")).toHaveLength(0);
  });

  test("a pending account cannot start", async () => {
    const world = makeWorld();
    await world.db.patch(A, { approvalStatus: "pending" });
    expect((await run(recordings.availability, world.as(A), { lang: "en" })).reason).toBe("pending");
    await expect(run(recordings.start, world.as(A), { lang: "en" })).rejects.toThrow();
  });
});

describe("the daily budget is shared with voice", () => {
  test("voice minutes used today leave less for recording", async () => {
    const world = makeWorld();
    await usedVoice(world, A, VOICE_LIMITS.dailyMinutesPerUser - 5);
    expect((await run(recordings.availability, world.as(A), { lang: "en" })).minutesLeft).toBe(5);
  });

  test("with under a minute left, start is a typed budget refusal", async () => {
    const world = makeWorld();
    await usedVoice(world, A, VOICE_LIMITS.dailyMinutesPerUser - 0.5);
    expect(await run(recordings.availability, world.as(A), { lang: "en" })).toMatchObject({ live: false, reason: "budget" });
    expect(await run(recordings.start, world.as(A), { lang: "en" })).toEqual({ ok: false, reason: "budget" });
  });

  test("recording minutes count too, and someone else's minutes don't", async () => {
    const world = makeWorld();
    const now = Date.now();
    await world.db.insert("recordingSessions", {
      userId: A,
      status: "ended",
      lang: "en",
      startedAt: now - (VOICE_LIMITS.dailyMinutesPerUser + 1) * 60_000,
      lastRenewalAt: now - 60_000,
      endedAt: now - 60_000,
      dateKey: today(),
      utcDateKey: today(),
      grants: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    expect((await run(recordings.availability, world.as(A), { lang: "en" })).reason).toBe("budget");
    expect((await run(recordings.availability, world.as(B), { lang: "en" })).live).toBe(true);
  });

  test("a renewal past today's minutes ends the lease as exhausted", async () => {
    const world = makeWorld();
    const started = await run(recordings.start, world.as(A), { lang: "en" });
    await usedVoice(world, A, VOICE_LIMITS.dailyMinutesPerUser);
    expect((await run(recordings.renew, world.as(A), { sessionId: started.sessionId })).status).toBe("exhausted");
    expect(world.row(started.sessionId)).toMatchObject({ status: "ended", endReason: "exhausted" });
  });
});

describe("owner isolation", () => {
  test("someone else cannot renew, stop or get a token for my lease", async () => {
    const world = makeWorld();
    const started = await run(recordings.start, world.as(A), { lang: "en" });
    expect((await run(recordings.renew, world.as(B), { sessionId: started.sessionId })).status).toBe("expired");
    await run(recordings.stop, world.as(B), { sessionId: started.sessionId });
    expect(world.row(started.sessionId)).toMatchObject({ status: "active" });
    const fetchSpy = spyOn(globalThis, "fetch");
    try {
      expect(await run(recordings.grant, world.actionAs(B), { sessionId: started.sessionId })).toEqual({ ok: false, reason: "ended" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
    await run(recordings.stop, world.as(A), { sessionId: started.sessionId });
    expect(world.row(started.sessionId)).toMatchObject({ status: "ended", endReason: "stopped" });
  });

  test("someone else cannot undo my save", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), { title: "Standup", body: "Notes", tasks: [{ title: "Send the deck" }] });
    await expect(run(recordings.undoSave, world.as(B), saved)).rejects.toThrow("no longer here");
    expect(world.row(saved.noteId)?.deletedAt).toBeUndefined();
    expect(world.row(saved.taskIds[0])?.deletedAt).toBeUndefined();
  });
});

describe("grant", () => {
  test("no Deepgram key: a typed no_key, never an error, and no request", async () => {
    const world = makeWorld();
    const started = await run(recordings.start, world.as(A), { lang: "en" });
    delete process.env.DEEPGRAM_API_KEY;
    const fetchSpy = spyOn(globalThis, "fetch");
    try {
      expect(await run(recordings.grant, world.actionAs(A), { sessionId: started.sessionId })).toEqual({ ok: false, reason: "no_key" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("mints a short-lived token for the Flux lane, the way voice does", async () => {
    const world = makeWorld();
    const started = await run(recordings.start, world.as(A), { lang: "en" });
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async () =>
      new Response(JSON.stringify({ access_token: "token-abcdefghijklmnop" }), { status: 200 })) as unknown as typeof fetch);
    try {
      const result = await run(recordings.grant, world.actionAs(A), { sessionId: started.sessionId });
      expect(result).toEqual({ ok: true, token: "token-abcdefghijklmnop", url: "wss://api.eu.deepgram.com/v2/listen?model=flux-general-en&mip_opt_out=true" });
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.eu.deepgram.com/v1/auth/grant");
      expect(JSON.parse(String(init.body))).toEqual({ ttl_seconds: VOICE_LIMITS.tokenTtlSeconds });
      expect(world.row(started.sessionId)?.grants).toBe(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("a provider error is a typed connect result and gives the grant back", async () => {
    const world = makeWorld();
    const started = await run(recordings.start, world.as(A), { lang: "en" });
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async () => new Response("nope", { status: 500 })) as unknown as typeof fetch);
    try {
      expect(await run(recordings.grant, world.actionAs(A), { sessionId: started.sessionId })).toEqual({ ok: false, reason: "connect" });
      expect(world.row(started.sessionId)?.grants).toBe(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("proposeFromTranscript", () => {
  const transcript = "We talked about the launch. I'll send the deck to Dana by Friday. We need to book the room.";

  test("no model key: unavailable, so the screen uses the local extractor", async () => {
    const world = makeWorld();
    const result = await recordings.runPropose(world.actionAs(A), { transcript, pins: [], lang: "en" }, { hasKey: () => false });
    expect(result).toEqual({ status: "unavailable", reason: "no_key" });
  });

  test("validates the model's reply: title, summary, at most 10 unique tasks", async () => {
    const world = makeWorld();
    const tasks = Array.from({ length: 14 }, (_, i) => ({ title: `Task ${i % 12}`, minutes: i === 0 ? 30 : 9999 }));
    const call = async () =>
      ({ content: JSON.stringify({ title: "  Launch sync ", summary: "We planned the launch.", tasks }) }) as unknown as Awaited<
        ReturnType<typeof import("./lib/ai_router").callLLM>
      >;
    const result = await recordings.runPropose(world.actionAs(A), { transcript, pins: [{ atMs: 1000, note: "deck" }], lang: "en" }, { hasKey: () => true, call });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.title).toBe("Launch sync");
    expect(result.tasks).toHaveLength(10);
    expect(result.tasks[0]).toEqual({ title: "Task 0", minutes: 30 });
    expect(result.tasks[1]).toEqual({ title: "Task 1" });
  });

  test("a reply that isn't the shape is unavailable, not saved", async () => {
    const world = makeWorld();
    const call = async () => ({ content: "not json" }) as unknown as Awaited<ReturnType<typeof import("./lib/ai_router").callLLM>>;
    const result = await recordings.runPropose(world.actionAs(A), { transcript, pins: [], lang: "en" }, { hasKey: () => true, call });
    expect(result).toEqual({ status: "unavailable", reason: "failed" });
    expect(world.rows("notes")).toHaveLength(0);
  });
});

describe("save and undo", () => {
  test("saves the page and the accepted tasks, with a 5-minute Undo", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), {
      title: " Standup ",
      body: "## Transcript\n\nWe met.",
      tasks: [{ title: "Send the deck", minutes: 15 }, { title: "Book the room" }],
    });
    expect(saved.taskIds).toHaveLength(2);
    expect(saved.undoUntil - Date.now()).toBeLessThanOrEqual(UNDO_WINDOW_MS);
    expect(world.row(saved.noteId)).toMatchObject({ userId: A, title: "Standup", body: "## Transcript\n\nWe met." });
    expect(world.row(saved.taskIds[0])).toMatchObject({ userId: A, title: "Send the deck", timeEstimate: 15 * 60_000, status: "todo" });
    expect(await run(recordings.undoSave, world.as(A), saved)).toEqual({ success: true, removedTasks: 2 });
    expect(world.row(saved.noteId)?.deletedAt).toBeNumber();
    expect(world.row(saved.taskIds[1])?.deletedAt).toBeNumber();
  });

  test("after 5 minutes Undo says so and changes nothing", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), { title: "Lecture", body: "x", tasks: [{ title: "Read chapter 3" }] });
    const old = Date.now() - UNDO_WINDOW_MS - 1_000;
    await world.db.patch(saved.noteId, { createdAt: old });
    await expect(run(recordings.undoSave, world.as(A), saved)).rejects.toThrow("5 minutes");
    expect(world.row(saved.noteId)?.deletedAt).toBeUndefined();
  });

  test("an empty title, a bad minutes value or too many tasks is refused before anything is written", async () => {
    const world = makeWorld();
    await expect(run(recordings.saveSession, world.as(A), { title: "  ", body: "x", tasks: [] })).rejects.toThrow("title");
    await expect(run(recordings.saveSession, world.as(A), { title: "T", body: "x", tasks: [{ title: "a", minutes: 0.5 }] })).rejects.toThrow("Minutes");
    const many = Array.from({ length: 21 }, (_, i) => ({ title: `t${i}` }));
    await expect(run(recordings.saveSession, world.as(A), { title: "T", body: "x", tasks: many })).rejects.toThrow("20");
    expect(world.rows("notes")).toHaveLength(0);
    expect(world.rows("tasks")).toHaveLength(0);
  });

  test("Undo leaves someone else's task alone even if its id is passed", async () => {
    const world = makeWorld();
    const theirs = await run(recordings.saveSession, world.as(B), { title: "Theirs", body: "x", tasks: [{ title: "Their task" }] });
    const mine = await run(recordings.saveSession, world.as(A), { title: "Mine", body: "x", tasks: [] });
    const result = await run(recordings.undoSave, world.as(A), { noteId: mine.noteId, taskIds: theirs.taskIds as Id<"tasks">[] });
    expect(result).toEqual({ success: true, removedTasks: 0 });
    expect(world.row(theirs.taskIds[0])?.deletedAt).toBeUndefined();
  });
});

describe("Undo removes only what that save made (whole-run review)", () => {
  test("each save keeps a record of its page and tasks on a row that counts against no day", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), {
      title: "Lecture",
      body: "x",
      tasks: [{ title: "Read chapter 3" }],
      lang: "he",
    });
    const receipts = world.rows("recordingSessions");
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      userId: A,
      status: "ended",
      lang: "he",
      durationMs: 0,
      grants: 0,
      dateKey: "",
      utcDateKey: "",
      savedNoteId: saved.noteId,
      savedTaskIds: saved.taskIds,
    });
    // Typed saves never use up the day's recordings: after 40 of them a recording still starts.
    for (let i = 0; i < VOICE_LIMITS.sessionsPerUserPerDay; i++) {
      await run(recordings.saveSession, world.as(A), { title: `Notes ${i}`, body: "x", tasks: [] });
    }
    expect(await run(recordings.start, world.as(A), { lang: "en" })).toMatchObject({ ok: true });
  });

  test("a page made another way in the same minutes is not a save, so Undo leaves it", async () => {
    const world = makeWorld();
    const now = Date.now();
    const page = await world.db.insert("notes", { userId: A, title: "My own page", body: "x", createdAt: now, updatedAt: now });
    await expect(run(recordings.undoSave, world.as(A), { noteId: page, taskIds: [] })).rejects.toThrow("no longer here");
    expect(world.row(page)?.deletedAt).toBeUndefined();
  });

  test("only the save's own tasks go, even when the person's other tasks are passed", async () => {
    const world = makeWorld();
    const now = Date.now();
    const other = await world.db.insert("tasks", { userId: A, title: "Made by hand", status: "todo", createdAt: now, updatedAt: now });
    const saved = await run(recordings.saveSession, world.as(A), { title: "Standup", body: "x", tasks: [{ title: "Send the deck" }] });
    const result = await run(recordings.undoSave, world.as(A), { noteId: saved.noteId, taskIds: [...saved.taskIds, other] });
    expect(result).toEqual({ success: true, removedTasks: 1 });
    expect(world.row(saved.taskIds[0])?.deletedAt).toBeNumber();
    expect(world.row(other)?.deletedAt).toBeUndefined();
    // Undone once: a second Undo finds nothing to take back.
    await expect(run(recordings.undoSave, world.as(A), saved)).rejects.toThrow("no longer here");
  });

  test("Undo always takes the save back in one click, and says when that took changes made since (HARD_RULES §1)", async () => {
    const world = makeWorld();
    const edited = await run(recordings.saveSession, world.as(A), { title: "Edited", body: "x", tasks: [{ title: "One" }] });
    const note = world.row(edited.noteId) as Row & { createdAt: number };
    await world.db.patch(edited.noteId, { body: "x and more", updatedAt: note.createdAt + 60_000 });
    const first = await run(recordings.undoSave, world.as(A), edited);
    expect(first).toMatchObject({ success: true, removedTasks: 1, removedEdits: true });
    expect(first.redoUntil - Date.now()).toBeLessThanOrEqual(UNDO_WINDOW_MS);
    expect(first.removedDone).toBeUndefined();
    expect(world.row(edited.noteId)?.deletedAt).toBeNumber();
    expect(world.row(edited.taskIds[0])?.deletedAt).toBeNumber();

    const done = await run(recordings.saveSession, world.as(A), { title: "Done", body: "x", tasks: [{ title: "Two" }, { title: "Three" }] });
    await world.db.patch(done.taskIds[0], { status: "done" });
    const second = await run(recordings.undoSave, world.as(A), done);
    expect(second).toMatchObject({ success: true, removedTasks: 2, removedDone: 1 });
    expect(second.removedEdits).toBeUndefined();
    expect(second.redoUntil).toBeNumber();
    expect(world.row(done.noteId)?.deletedAt).toBeNumber();
    for (const id of done.taskIds) expect(world.row(id)?.deletedAt).toBeNumber();

    // A task renamed after the first seconds is a change too.
    const renamed = await run(recordings.saveSession, world.as(A), { title: "Renamed", body: "x", tasks: [{ title: "Four" }] });
    const task = world.row(renamed.taskIds[0]) as Row & { createdAt: number };
    await world.db.patch(renamed.taskIds[0], { title: "Four, by Friday", updatedAt: task.createdAt + 30_000 });
    expect(await run(recordings.undoSave, world.as(A), renamed)).toMatchObject({ success: true, removedEdits: true });
  });

  test("Bring it back returns exactly what the Undo removed, as it was, and the save's Undo works again", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), { title: "Lecture", body: "x", tasks: [{ title: "One" }, { title: "Two" }] });
    await world.db.patch(saved.taskIds[0], { status: "done" });
    // A task left out of the Undo (the toast named only the first) is not the Undo's to bring back.
    await run(recordings.undoSave, world.as(A), { noteId: saved.noteId, taskIds: [saved.taskIds[0]] });
    // Deleted on purpose a second after the Undo. (A stamp near Date.now() could equal the Undo's own
    // to the millisecond, and Bring it back takes back rows by that stamp.)
    const undoneAt = (world.rows("recordingSessions").find((row) => row.savedNoteId === saved.noteId) as Row).deletedAt as number;
    await world.db.patch(saved.taskIds[1], { deletedAt: undoneAt + 1_000 });
    await expect(run(recordings.redoUndo, world.as(B), { noteId: saved.noteId })).rejects.toThrow("nothing here to bring back");
    expect(await run(recordings.redoUndo, world.as(A), { noteId: saved.noteId })).toEqual({ success: true, restoredTasks: 1 });
    expect(world.row(saved.noteId)?.deletedAt).toBeUndefined();
    expect(world.row(saved.taskIds[0])).toMatchObject({ status: "done", deletedAt: undefined });
    expect(world.row(saved.taskIds[1])?.deletedAt).toBeNumber();
    // Already back: nothing changes. The save's own Undo finds its record again.
    expect(await run(recordings.redoUndo, world.as(A), { noteId: saved.noteId })).toEqual({ success: true, restoredTasks: 0 });
    expect(await run(recordings.undoSave, world.as(A), { noteId: saved.noteId, taskIds: [saved.taskIds[0]] })).toMatchObject({
      success: true,
      removedTasks: 1,
    });
  });

  test("Bring it back after 5 minutes, or with no Undo to take back, says so and changes nothing", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), { title: "Lecture", body: "x", tasks: [{ title: "One" }] });
    await expect(run(recordings.redoUndo, world.as(A), { noteId: saved.noteId })).resolves.toEqual({ success: true, restoredTasks: 0 });
    const page = await world.db.insert("notes", { userId: A, title: "Mine", body: "x", createdAt: Date.now(), updatedAt: Date.now() });
    await expect(run(recordings.redoUndo, world.as(A), { noteId: page })).rejects.toThrow("nothing here to bring back");
    await run(recordings.undoSave, world.as(A), saved);
    const receipt = world.rows("recordingSessions").find((row) => row.savedNoteId === saved.noteId) as Row;
    const long = Date.now() - UNDO_WINDOW_MS - 1_000;
    for (const id of [receipt._id, saved.noteId, saved.taskIds[0]]) await world.db.patch(id, { deletedAt: long });
    await expect(run(recordings.redoUndo, world.as(A), { noteId: saved.noteId })).rejects.toThrow("5 minutes");
    expect(world.row(saved.noteId)?.deletedAt).toBe(long);
    expect(world.row(saved.taskIds[0])?.deletedAt).toBe(long);
  });
});

describe("forUser: the account the screen was opened for", () => {
  const code = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return (error as { data?: { code?: string } }).data?.code;
    }
    return "no error";
  };

  test("a save for another account writes nothing and throws accountChanged", async () => {
    const world = makeWorld();
    expect(
      await code(run(recordings.saveSession, world.as(B), { title: "Standup", body: "x", tasks: [{ title: "One" }], forUser: A })),
    ).toBe("accountChanged");
    expect(world.rows("notes")).toHaveLength(0);
    expect(world.rows("tasks")).toHaveLength(0);
    expect(world.rows("recordingSessions")).toHaveLength(0);
  });

  test("Undo and Bring it back for another account change nothing and throw accountChanged", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), { title: "Standup", body: "x", tasks: [{ title: "One" }], forUser: A });
    expect(await code(run(recordings.undoSave, world.as(A), { noteId: saved.noteId, taskIds: saved.taskIds, forUser: B }))).toBe("accountChanged");
    expect(world.row(saved.noteId)?.deletedAt).toBeUndefined();
    expect(world.row(saved.taskIds[0])?.deletedAt).toBeUndefined();
    await run(recordings.undoSave, world.as(A), { noteId: saved.noteId, taskIds: saved.taskIds, forUser: A });
    expect(world.row(saved.noteId)?.deletedAt).toBeNumber();
    expect(await code(run(recordings.redoUndo, world.as(A), { noteId: saved.noteId, forUser: B }))).toBe("accountChanged");
    expect(world.row(saved.noteId)?.deletedAt).toBeNumber();
    expect(await run(recordings.redoUndo, world.as(A), { noteId: saved.noteId, forUser: A })).toEqual({
      success: true,
      restoredTasks: 1,
    });
    expect(world.row(saved.noteId)?.deletedAt).toBeUndefined();
  });

  test("without forUser, save, Undo and Bring it back work as before", async () => {
    const world = makeWorld();
    const saved = await run(recordings.saveSession, world.as(A), { title: "Standup", body: "x", tasks: [{ title: "One" }] });
    expect(await run(recordings.undoSave, world.as(A), { noteId: saved.noteId, taskIds: saved.taskIds })).toMatchObject({
      success: true,
      removedTasks: 1,
    });
    expect(await run(recordings.redoUndo, world.as(A), { noteId: saved.noteId })).toMatchObject({ success: true });
  });
});
