import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import * as approval from "./approval";
import * as coach from "./coach";
import * as voice from "./voice";
import type { AiCallOptions, AiResult, callLLM } from "./lib/ai_router";
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
              ? a < b
                ? -1
                : a > b
                  ? 1
                  : 0
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
    ({
      auth: { getUserIdentity: async () => ({ subject: `${userId}|session` }) },
      db,
    }) as unknown as MutationCtx;
  const handlers: Record<string, unknown> = {
    "approval:assertApprovedForAi": approval.assertApprovedForAi,
    "coach:claimTurn": coach.claimTurn,
    "coach:releaseTurn": coach.releaseTurn,
    "coach:saveReply": coach.saveReply,
    "coach:reserveWebSearch": coach.reserveWebSearch,
    "coach:researchRequestState": coach.researchRequestState,
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

beforeEach(() => {
  process.env.DEEPGRAM_API_KEY = "fixture-not-a-key";
  process.env.DEEPINFRA_API_KEY = "fixture-not-a-key";
});
afterEach(() => {
  delete process.env.DEEPGRAM_API_KEY;
  delete process.env.DEEPINFRA_API_KEY;
});
const text = "Help plan a fictional practice task";
const bounds = { dayStartMs: 1, dayEndMs: 86_400_001, todayDate: "2026-10-22" };
async function fixture() {
  const world = makeWorld();
  await world.db.patch(A, { userType: "paid", entitlementTier: "max" });
  const conversationId = await world.db.insert("conversations", {
    userId: A,
    title: "Fixture",
    createdAt: 1,
    updatedAt: 1,
  });
  const { sessionId } = await run(voice.start, world.as(A), { conversationId, clientKey: "fixture_voice_1" });
  const { capability } = await run(voice.agentCapability, world.as(A), { sessionId });
  return { world, conversationId, sessionId, capability };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function prepare(f: Fixture, input = text, parentId?: string) {
  return run(voice.prepareAgentFunction, f.world.as(A), {
    sessionId: f.sessionId,
    capability: f.capability,
    text: input,
    ...(parentId ? { parentId } : {}),
  });
}
async function begin(f: Fixture, prepared: { functionId: string; receipt: string }, input = text) {
  return run(voice.beginAgentTurn, f.world.as(A), {
    sessionId: f.sessionId,
    ...prepared,
    text: input,
    ...bounds,
  });
}
async function complete(
  f: Fixture,
  prepared: { functionId: string; receipt: string },
  begun: { requestId: string; replyTo: string },
) {
  const claimed = await run(coach.claimTurn, f.world.as(A), {
    conversationId: f.conversationId,
    requestId: begun.requestId,
    replyTo: begun.replyTo,
  });
  expect(claimed).toBeTruthy();
  const saved = await run(coach.saveReply, f.world.as(A), {
    conversationId: f.conversationId,
    replyTo: begun.replyTo,
    claim: claimed.claim,
    content: "A fictional answer",
    modelUsed: "fixture",
    proposal: { kind: "task", title: "Fictional practice", minutes: 5, when: "today" },
  });
  expect(saved).toBe(true);
  return run(voice.completeAgentTurn, f.world.as(A), {
    sessionId: f.sessionId,
    functionId: prepared.functionId,
    ...begun,
  });
}

describe("durable deferred voice bridge", () => {
  test("stores only a capability hash and no transcript in the lease", async () => {
    const f = await fixture();
    const p = await prepare(f);
    expect(p.status).toBe("ready");
    const stored = JSON.stringify(f.world.row(f.sessionId));
    expect(stored).not.toContain(f.capability);
    expect(stored).not.toContain(text);
    expect(f.world.rows("messages")).toHaveLength(0);
  });
  test("capability cannot rotate or migrate to another owner", async () => {
    const f = await fixture();
    await expect(run(voice.agentCapability, f.world.as(A), { sessionId: f.sessionId })).rejects.toThrow();
    await expect(run(voice.agentCapability, f.world.as(B), { sessionId: f.sessionId })).rejects.toThrow();
  });
  test("wrong capability and cross-lease capability cannot prepare", async () => {
    const f = await fixture();
    expect(
      await run(voice.prepareAgentFunction, f.world.as(A), {
        sessionId: f.sessionId,
        capability: "x".repeat(73),
        text,
      }),
    ).toEqual({ status: "unavailable" });
    expect(
      await run(voice.prepareAgentFunction, f.world.as(A), {
        sessionId: "voiceSessions:missing",
        capability: f.capability,
        text,
      }),
    ).toEqual({ status: "unavailable" });
  });
  test("same normalized speech and parent reuse one pending receipt", async () => {
    const f = await fixture();
    const p = await prepare(f);
    expect(await prepare(f, `  ${text}  `)).toEqual(p);
    expect((f.world.row(f.sessionId)?.agentBridge as { receipts: unknown[] }).receipts).toHaveLength(1);
  });
  test("conflicting speech cannot replace an outstanding receipt", async () => {
    const f = await fixture();
    await prepare(f);
    expect(await prepare(f, "Different speech")).toEqual({ status: "unavailable" });
  });
  test("unknown completed parent is refused", async () => {
    const f = await fixture();
    expect(await prepare(f, text, "unknown-parent")).toEqual({ status: "unavailable" });
  });
  test("begin saves exactly one user message and repeating does not save another", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    expect(b.status).toBe("ready");
    expect(await begin(f, p)).toEqual(b);
    expect(f.world.rows("messages")).toHaveLength(1);
  });
  test("a forged receipt or conflicting text cannot save a user message", async () => {
    const f = await fixture();
    const p = await prepare(f);
    await expect(begin(f, { ...p, receipt: "forged" })).rejects.toThrow();
    await expect(begin(f, p, "Different speech")).rejects.toThrow();
    expect(f.world.rows("messages")).toHaveLength(0);
  });
  test("another owner cannot begin or cancel the receipt", async () => {
    const f = await fixture();
    const p = await prepare(f);
    await expect(
      run(voice.beginAgentTurn, f.world.as(B), { sessionId: f.sessionId, ...p, text, ...bounds }),
    ).rejects.toThrow();
    await expect(
      run(voice.cancelAgentTurn, f.world.as(B), { sessionId: f.sessionId, functionId: p.functionId }),
    ).rejects.toThrow();
  });
  test("foreign and deleted page context refuse before any message is saved", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const noteId = await f.world.db.insert("notes", { userId: B, title: "Fixture", body: "" });
    await expect(
      run(voice.beginAgentTurn, f.world.as(A), { sessionId: f.sessionId, ...p, text, ...bounds, noteId }),
    ).rejects.toThrow();
    await f.world.db.patch(noteId, { userId: A, deletedAt: 1 });
    await expect(
      run(voice.beginAgentTurn, f.world.as(A), { sessionId: f.sessionId, ...p, text, ...bounds, noteId }),
    ).rejects.toThrow();
    expect(f.world.rows("messages")).toHaveLength(0);
  });
  test("invalid day bounds and dates refuse before admission", async () => {
    const f = await fixture();
    const p = await prepare(f);
    await expect(
      run(voice.beginAgentTurn, f.world.as(A), {
        sessionId: f.sessionId,
        ...p,
        text,
        ...bounds,
        dayEndMs: 0,
      }),
    ).rejects.toThrow();
    await expect(
      run(voice.beginAgentTurn, f.world.as(A), {
        sessionId: f.sessionId,
        ...p,
        text,
        ...bounds,
        todayDate: "2026-02-30",
      }),
    ).rejects.toThrow();
    expect(f.world.rows("messages")).toHaveLength(0);
  });
  test("pending cancellation prevents later user admission", async () => {
    const f = await fixture();
    const p = await prepare(f);
    expect(
      await run(voice.cancelAgentTurn, f.world.as(A), { sessionId: f.sessionId, functionId: p.functionId }),
    ).toEqual({ status: "cancelled" });
    expect(await begin(f, p)).toEqual({ status: "cancelled" });
    expect(f.world.rows("messages")).toHaveLength(0);
    expect(await prepare(f)).toEqual({ status: "unavailable" });
  });
  test("running cancellation fences legacy reclaim and late save", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const claim = await run(coach.claimTurn, f.world.as(A), {
      conversationId: f.conversationId,
      requestId: b.requestId,
      replyTo: b.replyTo,
    });
    await run(voice.cancelAgentTurn, f.world.as(A), { sessionId: f.sessionId, functionId: p.functionId });
    expect(await run(coach.claimTurn, f.world.as(A), { conversationId: f.conversationId })).toBeNull();
    expect(
      await run(coach.saveReply, f.world.as(A), {
        conversationId: f.conversationId,
        replyTo: b.replyTo,
        claim: claim.claim,
        content: "Late",
        modelUsed: "fixture",
      }),
    ).toBe(false);
  });
  test("stop invalidates capability and prepared claims", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    await run(voice.stop, f.world.as(A), { sessionId: f.sessionId });
    expect(await prepare(f)).toEqual({ status: "unavailable" });
    expect(
      (
        await run(coach.researchRequestState, f.world.as(A), {
          conversationId: f.conversationId,
          requestId: b.requestId,
          replyTo: b.replyTo,
        })
      ).state,
    ).toBe("cancelled");
  });
  test("expiry stops a prepared coach turn before any model call", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    await f.world.db.patch(f.sessionId, { lastRenewalAt: 0 });
    const key = { conversationId: f.conversationId, requestId: b.requestId, replyTo: b.replyTo };
    expect((await run(coach.researchRequestState, f.world.as(A), key)).state).toBe("superseded");
    expect(await run(coach.claimTurn, f.world.as(A), key)).toBeNull();
    expect(await prepare(f)).toEqual({ status: "unavailable" });
  });
  test("approval revoked during a lease denies admission", async () => {
    const f = await fixture();
    const p = await prepare(f);
    await f.world.db.patch(A, { approvalStatus: "revoked" });
    expect(await prepare(f)).toEqual({ status: "unavailable" });
    await expect(begin(f, p)).rejects.toThrow();
    expect(f.world.rows("messages")).toHaveLength(0);
  });
  test("paid entitlement removal denies a new receipt and pending admission", async () => {
    const f = await fixture();
    const p = await prepare(f);
    await f.world.db.patch(A, { userType: "free" });
    expect(await prepare(f)).toEqual({ status: "unavailable" });
    expect(await begin(f, p)).toEqual({ status: "cancelled" });
  });
  test("global time cap is checked again at callback and save boundaries", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const claim = await run(coach.claimTurn, f.world.as(A), {
      conversationId: f.conversationId,
      requestId: b.requestId,
      replyTo: b.replyTo,
    });
    const lease = f.world.row(f.sessionId)!;
    const { _id: _leaseId, _creationTime: _created, ...fields } = lease;
    for (let i = 0; i < 8; i++)
      await f.world.db.insert("voiceSessions", {
        ...fields,
        userId: B,
        status: "ended",
        startedAt: Date.now() - 15 * 60_000,
        endedAt: Date.now(),
      });
    expect(await prepare(f)).toEqual({ status: "unavailable" });
    expect(
      await run(coach.saveReply, f.world.as(A), {
        conversationId: f.conversationId,
        replyTo: b.replyTo,
        claim: claim.claim,
        content: "Late",
        modelUsed: "fixture",
      }),
    ).toBe(false);
  });
  test("crisis produces only the fixed card and ends the voice lease", async () => {
    const f = await fixture();
    const input = "I want to die";
    const p = await prepare(f, input);
    expect(await begin(f, p, input)).toEqual({ status: "crisis" });
    expect(f.world.row(f.sessionId)?.status).toBe("ended");
    expect(f.world.rows("messages")).toHaveLength(2);
    expect(f.world.rows("messages")[1]?.modelUsed).toBe("crisis-card");
    expect(
      await run(voice.canonicalAgentAnswer, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        capability: f.capability,
      }),
    ).toEqual({ status: "unavailable" });
  });
  test("Hebrew voice stays off even if a lease locale changes", async () => {
    const f = await fixture();
    await f.world.db.insert("userPreferences", { userId: A, locale: "he" });
    expect(await prepare(f)).toEqual({ status: "unavailable" });
  });
  test("saved answer is linked exactly and proposals remain pending", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const done = await complete(f, p, b);
    expect(done.status).toBe("ready");
    const answer = f.world.row(done.assistantMessageId)!;
    expect(answer.toolCalls).toMatchObject({ coachProposal: { status: "pending" } });
    expect(f.world.rows("tasks")).toHaveLength(0);
    await run(coach.sendMessage, f.world.as(A), {
      conversationId: f.conversationId,
      content: "An unrelated typed turn",
    });
    await f.world.db.insert("messages", {
      conversationId: f.conversationId,
      role: "assistant",
      content: "Unrelated answer",
      createdAt: Date.now() + 10,
    });
    expect(
      await run(voice.canonicalAgentAnswer, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        capability: f.capability,
      }),
    ).toEqual({
      status: "ready",
      content: "A fictional answer",
      assistantMessageId: done.assistantMessageId,
    });
  });
  test("complete refuses another request or user message identity", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    await complete(f, p, b);
    expect(
      await run(voice.completeAgentTurn, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        requestId: "wrong",
        replyTo: b.replyTo,
      }),
    ).toEqual({ status: "unavailable" });
  });
  test("a newer typed turn prevents the voice turn from saving", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const c = await run(coach.claimTurn, f.world.as(A), {
      conversationId: f.conversationId,
      requestId: b.requestId,
      replyTo: b.replyTo,
    });
    await run(coach.sendMessage, f.world.as(A), {
      conversationId: f.conversationId,
      content: "New typed turn",
    });
    expect(
      await run(coach.saveReply, f.world.as(A), {
        conversationId: f.conversationId,
        replyTo: b.replyTo,
        claim: c.claim,
        content: "Stale",
        modelUsed: "fixture",
      }),
    ).toBe(false);
  });
  test("same speech after a completed parent gets a new turn; stale parents cannot mint new speech", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    await complete(f, p, b);
    expect(await prepare(f)).toEqual(p);
    const next = await prepare(f, text, p.functionId);
    expect(next.status).toBe("ready");
    expect(next.functionId).not.toBe(p.functionId);
    expect(await prepare(f, "Another speech")).toEqual({ status: "unavailable" });
  });
  test("reconnect replaces the old lease without replaying old receipts", async () => {
    const f = await fixture();
    const p = await prepare(f);
    await begin(f, p);
    const next = await run(voice.start, f.world.as(A), {
      conversationId: f.conversationId,
      clientKey: "fixture_voice_2",
    });
    expect(next.sessionId).not.toBe(f.sessionId);
    expect(await prepare(f)).toEqual({ status: "unavailable" });
    expect(f.world.row(f.sessionId)?.status).toBe("ended");
  });
  test("128 receipts fail closed without eviction", async () => {
    const f = await fixture();
    const bridge = f.world.row(f.sessionId)?.agentBridge as { version: 1; capabilityHash: string };
    const receipts = Array.from({ length: 128 }, (_, i) => ({
      id: `receipt-${i}`,
      inputDigest: `digest-${i}`,
      state: "done",
    }));
    await f.world.db.patch(f.sessionId, { agentBridge: { ...bridge, receipts } });
    expect(await prepare(f, text, "receipt-127")).toEqual({ status: "unavailable" });
    expect((f.world.row(f.sessionId)?.agentBridge as { receipts: unknown[] }).receipts).toHaveLength(128);
  });
  test("deleted canonical answer cannot be read aloud", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const d = await complete(f, p, b);
    await f.world.db.patch(d.assistantMessageId, { deletedAt: Date.now() });
    expect(
      await run(voice.canonicalAgentAnswer, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        capability: f.capability,
      }),
    ).toEqual({ status: "unavailable" });
  });
  test("concurrent delivery is serialized by the mutation boundary and admits one message", async () => {
    const f = await fixture();
    const p = await prepare(f);
    // Convex serializes conflicting lease-row mutations. Model that transaction boundary here.
    let queue = Promise.resolve();
    const transaction = () => {
      const result = queue.then(() => begin(f, p));
      queue = result.then(() => undefined);
      return result;
    };
    const [first, second] = await Promise.all([transaction(), transaction()]);
    expect(second).toEqual(first);
    expect(f.world.rows("messages")).toHaveLength(1);
  });
  test("a daily cap consumed elsewhere rejects an already prepared callback", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const lease = f.world.row(f.sessionId)!;
    const { _id: _leaseId, _creationTime: _created, ...fields } = lease;
    await f.world.db.insert("voiceSessions", {
      ...fields,
      status: "ended",
      startedAt: Date.now() - 15 * 60_000,
      endedAt: Date.now(),
    });
    expect(await begin(f, p)).toEqual({ status: "cancelled" });
  });
  test("a finished failed coach execution cannot be retried as a new voice model call", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const claim = await run(coach.claimTurn, f.world.as(A), {
      conversationId: f.conversationId,
      requestId: b.requestId,
      replyTo: b.replyTo,
    });
    await run(coach.releaseTurn, f.world.as(A), {
      conversationId: f.conversationId,
      messageId: b.replyTo,
      claim: claim.claim,
    });
    expect(
      await run(voice.completeAgentTurn, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        requestId: b.requestId,
        replyTo: b.replyTo,
      }),
    ).toEqual({ status: "unavailable" });
    expect(await begin(f, p)).toEqual({ status: "cancelled" });
  });
  test("an old completed callback is unavailable after another voice turn is prepared", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    await complete(f, p, b);
    await prepare(f, "Next speech", p.functionId);
    expect(
      await run(voice.canonicalAgentAnswer, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        capability: f.capability,
      }),
    ).toEqual({ status: "unavailable" });
  });
  test("a reconnect can admit new speech after stop fenced the old user message", async () => {
    const f = await fixture();
    const p = await prepare(f);
    await begin(f, p);
    const next = await run(voice.start, f.world.as(A), {
      conversationId: f.conversationId,
      clientKey: "fixture_restart_2",
    });
    const { capability } = await run(voice.agentCapability, f.world.as(A), { sessionId: next.sessionId });
    const nextFixture = { ...f, sessionId: next.sessionId, capability };
    const prepared = await prepare(nextFixture, "New speech");
    expect((await begin(nextFixture, prepared, "New speech")).status).toBe("ready");
  });

  test("duplicate action delivery calls one model; cancellation discards its late result", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const key = {
      conversationId: f.conversationId as Id<"conversations">,
      requestId: b.requestId,
      replyTo: b.replyTo,
    };
    let started!: () => void;
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (value: AiResult) => void;
    const pending = new Promise<AiResult>((resolve) => {
      finish = resolve;
    });
    let calls = 0;
    let options: AiCallOptions | undefined;
    const call = (async (opts: AiCallOptions) => {
      calls++;
      options = opts;
      started();
      return pending;
    }) as typeof callLLM;
    const first = coach.runControlledReply(f.world.actionAs(A), key, call, null);
    await entered;
    expect(await coach.runControlledReply(f.world.actionAs(A), key, call, null)).toBe("busy");
    await run(voice.cancelAgentTurn, f.world.as(A), { sessionId: f.sessionId, functionId: p.functionId });
    finish({
      tier: options!.tier,
      requestedTier: options!.tier,
      model: "fixture",
      content: '{"reply":"Late","proposal":null}',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      escalated: false,
    });
    expect(await first).toBe("cancelled");
    expect(calls).toBe(1);
    expect(f.world.rows("messages")).toHaveLength(1);
  });
  test("crisis bypasses a busy typed turn, ends voice and fences that late reply", async () => {
    const f = await fixture();
    const input = "I want to die";
    const p = await prepare(f, input);
    await run(coach.sendMessage, f.world.as(A), {
      conversationId: f.conversationId,
      content: "A typed turn is pending",
    });
    const claim = await run(coach.claimTurn, f.world.as(A), { conversationId: f.conversationId });
    expect(await begin(f, p, input)).toEqual({ status: "crisis" });
    expect(f.world.row(f.sessionId)?.status).toBe("ended");
    expect(f.world.rows("messages")[2]?.modelUsed).toBe("crisis-card");
    expect(
      await run(coach.saveReply, f.world.as(A), {
        conversationId: f.conversationId,
        replyTo: claim.replyTo,
        claim: claim.claim,
        content: "Late typed answer",
        modelUsed: "fixture",
      }),
    ).toBe(false);
    expect(f.world.row(f.sessionId)?.ttsChars).toBe(0);
  });
  test("canonical speech reserves characters once and retry retrieval never reserves again", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const done = await complete(f, p, b);
    const chars = "A fictional answer".length;
    expect(f.world.row(f.sessionId)?.ttsChars).toBe(chars);
    for (let i = 0; i < 3; i++)
      expect(
        await run(voice.canonicalAgentAnswer, f.world.as(A), {
          sessionId: f.sessionId,
          functionId: p.functionId,
          capability: f.capability,
        }),
      ).toEqual({
        status: "ready",
        content: "A fictional answer",
        assistantMessageId: done.assistantMessageId,
      });
    expect(f.world.row(f.sessionId)?.ttsChars).toBe(chars);
    await run(voice.stop, f.world.as(A), { sessionId: f.sessionId });
    expect(f.world.row(f.sessionId)?.ttsChars).toBe(chars);
    expect(
      await run(voice.canonicalAgentAnswer, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        capability: f.capability,
      }),
    ).toEqual({ status: "unavailable" });
  });
  test("exact remaining speech allowance can be reserved and delivered", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    await f.world.db.patch(f.sessionId, { ttsChars: 20_000 - "A fictional answer".length });
    const done = await complete(f, p, b);
    expect(done.status).toBe("ready");
    expect(f.world.row(f.sessionId)?.ttsChars).toBe(20_000);
    expect(
      (
        await run(voice.canonicalAgentAnswer, f.world.as(A), {
          sessionId: f.sessionId,
          functionId: p.functionId,
          capability: f.capability,
        })
      ).status,
    ).toBe("ready");
  });
  test("exhausted daily speech allowance saves text but never exposes voice content", async () => {
    const f = await fixture();
    const p = await prepare(f);
    const b = await begin(f, p);
    const lease = f.world.row(f.sessionId)!;
    const { _id: _leaseId, _creationTime: _created, ...fields } = lease;
    await f.world.db.insert("voiceSessions", {
      ...fields,
      status: "ended",
      endedAt: Date.now(),
      ttsChars: 19_999,
    });
    const done = await complete(f, p, b);
    expect(done).toEqual({ status: "unavailable" });
    expect(f.world.row(f.sessionId)?.ttsChars).toBe(0);
    expect(f.world.rows("messages")[1]?.content).toBe("A fictional answer");
    expect(f.world.rows("messages")[1]?.toolCalls).toMatchObject({ coachProposal: { status: "pending" } });
    expect(
      await run(voice.canonicalAgentAnswer, f.world.as(A), {
        sessionId: f.sessionId,
        functionId: p.functionId,
        capability: f.capability,
      }),
    ).toEqual({ status: "unavailable" });
    expect(await begin(f, p)).toEqual({ status: "cancelled" });
  });
});
