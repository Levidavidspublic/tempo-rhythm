import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import * as approval from "./approval";
import * as coach from "./coach";
import { AiAuthError, AiUpstreamError } from "./lib/ai_errors";
import { parseTempoBlocks } from "@tempo/utils";
import type { AiCallOptions, AiResult, callLLM } from "./lib/ai_router";
import { PENDING_APPROVAL_MESSAGE } from "./lib/approval";
import { dayName } from "./lib/coachPrompt";

/**
 * The real-AI coach turn (OVERNIGHT-RUN.md run 2, item 2): the user's message is saved first, an
 * action checks approval and calls the model seam with the page and the thread, crisis text never
 * reaches a model, a failure is logged and answered kindly, and a proposal changes nothing until
 * Accept, with a 5-minute Undo. The db is in memory; the model is a stand-in for `callLLM`.
 */

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
        const cmp = (test: (a: number, b: number) => boolean) => (field: string, value: number) => {
          conds.push((row) => typeof row[field] === "number" && test(row[field] as number, value));
          return q;
        };
        const q = {
          eq: (field: string, value: unknown) => {
            conds.push((row) => row[field] === value);
            return q;
          },
          gte: cmp((a, b) => a >= b),
          lt: cmp((a, b) => a < b),
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
    query: (t: string) => builder(Array.from(table(t).values())),
  };
  const as = (userId: string) =>
    ({ auth: { getUserIdentity: async () => ({ subject: `${userId}|session` }) }, db }) as unknown as MutationCtx;
  const handlers: Record<string, unknown> = {
    "approval:assertApprovedForAi": approval.assertApprovedForAi,
    "coach:claimTurn": coach.claimTurn,
    "coach:releaseTurn": coach.releaseTurn,
    "coach:saveReply": coach.saveReply,
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

let errorLog: ReturnType<typeof spyOn>;
beforeEach(() => {
  errorLog = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorLog.mockRestore();
});

async function say(world: World, conversationId: Id<"conversations">, content: string, userId = A) {
  return run(coach.sendMessage, world.as(userId), { conversationId, content });
}

function messages(world: World, conversationId: string) {
  return world.rows("messages").filter((m) => m.conversationId === conversationId);
}

describe("a coach turn", () => {
  test("the message is saved, then the model's reply is stored", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    expect(await say(world, conversationId, " I can't start today ")).toEqual({ success: true });
    expect(messages(world, conversationId).map((m) => m.role)).toEqual(["user"]);

    const model = fakeModel('{"reply":"What is the smallest piece?","proposal":null}');
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call)).toBe("replied");

    const stored = messages(world, conversationId);
    expect(stored.map((m) => [m.role, m.content])).toEqual([
      ["user", "I can't start today"],
      ["assistant", "What is the smallest piece?"],
    ]);
    expect(stored[1]?.modelUsed).toBe("test-model");
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]?.tier).toBe("balanced");
    expect(model.calls[0]?.responseFormat).toBe("json_object");
    expect(model.calls[0]?.messages.at(-1)).toEqual({ role: "user", content: "I can't start today" });
  });

  test("the person's local date reaches the model; a date that is today nowhere is left out", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "add Call Dana Friday");
    const today = new Date().toISOString().slice(0, 10);
    const model = fakeModel('{"reply":"Added for today?","proposal":null}');
    await coach.runCoachReply(world.actionAs(A), { conversationId, todayDate: today }, model.call);
    expect(model.calls[0]?.messages[1]?.content).toBe(`For them it is ${dayName(today)}.`);

    await say(world, conversationId, "and the report");
    const stale = fakeModel('{"reply":"Sure.","proposal":null}');
    await coach.runCoachReply(world.actionAs(A), { conversationId, todayDate: "2001-01-01" }, stale.call);
    expect(stale.calls[0]?.messages.map((m) => m.content).join("\n")).not.toContain("For them it is");
  });

  test("the open page's text goes to the model; its Tempo block JSON does not", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    const noteId = (await world.db.insert("notes", {
      userId: A,
      title: "Tue 13 Oct",
      body: '```json tempo\n{"id":"blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2X","v":1,"type":"page-meta","data":{"pageType":"daily","date":"2026-10-13","tags":[]}}\n```\n## Intention\nCall the bank\n',
      pinned: false,
      periodType: "daily",
      createdAt: 1,
      updatedAt: 1,
    })) as Id<"notes">;
    await say(world, conversationId, "help me start");
    const model = fakeModel('{"reply":"Start with the bank.","proposal":null}');
    await coach.runCoachReply(world.actionAs(A), { conversationId, noteId }, model.call);
    const page = model.calls[0]?.messages[1]?.content ?? "";
    expect(page).toContain('<page title="Tue 13 Oct">');
    expect(page).toContain("Call the bank");
    expect(page).not.toContain("page-meta");
    expect(page).not.toContain("blk_");
  });

  test("someone else's page is never sent", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    const noteId = (await world.db.insert("notes", {
      userId: B,
      title: "B's secrets",
      body: "secret",
      pinned: false,
      periodType: "none",
      createdAt: 1,
      updatedAt: 1,
    })) as Id<"notes">;
    await say(world, conversationId, "hi");
    const model = fakeModel('{"reply":"Hi.","proposal":null}');
    await coach.runCoachReply(world.actionAs(A), { conversationId, noteId }, model.call);
    expect(model.calls[0]?.messages.map((m) => m.content).join("\n")).not.toContain("secret");
    expect(model.calls[0]?.messages).toHaveLength(2);
  });

  test("crisis text gets the fixed card and never reaches a model", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    expect(await say(world, conversationId, "I want to kill myself")).toEqual({ success: true, crisis: true });
    const model = fakeModel('{"reply":"x","proposal":null}');
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call)).toBe("idle");
    expect(model.calls).toHaveLength(0);
    expect(messages(world, conversationId).at(-1)?.modelUsed).toBe("crisis-card");
  });

  test("a missing key is logged and answered kindly; the message stays saved", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "plan my morning");
    const model = fakeModel(() => {
      throw new AiAuthError("DEEPINFRA_API_KEY not set in Convex env");
    });
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call)).toBe("unavailable");
    expect(messages(world, conversationId).map((m) => m.role)).toEqual(["user"]);
    expect(errorLog).toHaveBeenCalledWith("coach.reply: the model could not be reached (AiAuthError)");
  });

  test("a provider error is logged without its text", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "plan my morning");
    const model = fakeModel(() => {
      throw new AiUpstreamError("DeepInfra returned HTTP 503", 503, "upstream body with details");
    });
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call)).toBe("unavailable");
    const logged = errorLog.mock.calls.flat().join(" ");
    expect(logged).toContain("AiUpstreamError");
    expect(logged).not.toContain("upstream body");
  });

  test("an empty answer is unavailable, not a blank message", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "hi");
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, fakeModel("   ").call)).toBe("unavailable");
    expect(messages(world, conversationId)).toHaveLength(1);
  });

  test("a pending account is refused before any model call", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world, PENDING);
    const model = fakeModel('{"reply":"x","proposal":null}');
    await expect(coach.runCoachReply(world.actionAs(PENDING), { conversationId }, model.call)).rejects.toThrow(
      PENDING_APPROVAL_MESSAGE,
    );
    expect(model.calls).toHaveLength(0);
  });

  test("an answered thread is idle; a second reply is never stored", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "hi");
    const model = fakeModel('{"reply":"Hello.","proposal":null}');
    await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call);
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call)).toBe("idle");
    expect(messages(world, conversationId)).toHaveLength(2);
  });

  test("a newer message while the model runs: the reply isn't saved and says superseded, not replied", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "help me start");
    const call = (async (opts: AiCallOptions): Promise<AiResult> => {
      // Another tab sends a message while this turn's model call is out.
      await say(world, conversationId, "actually, one more thing");
      return {
        tier: opts.tier,
        requestedTier: opts.tier,
        model: "test-model",
        content: '{"reply":"Start small.","proposal":null}',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        escalated: false,
      };
    }) as typeof callLLM;
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, call)).toBe("superseded");
    expect(messages(world, conversationId).filter((m) => m.role === "assistant")).toHaveLength(0);
  });

  test("overlapping replies claim the turn once: one model call, the other is busy", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "plan my morning");
    let finish: (value: string) => void = () => {};
    const slow = new Promise<string>((resolve) => {
      finish = resolve;
    });
    let calls = 0;
    const blocking = (async (opts: AiCallOptions): Promise<AiResult> => {
      calls += 1;
      const content = await slow;
      return { tier: opts.tier, requestedTier: opts.tier, model: "test-model", content, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, escalated: false };
    }) as typeof callLLM;
    const first = coach.runCoachReply(world.actionAs(A), { conversationId }, blocking);
    // Let the first reply claim the turn and reach the model before the second starts.
    while (calls === 0) await new Promise((r) => setTimeout(r, 1));
    const second = await coach.runCoachReply(world.actionAs(A), { conversationId }, blocking);
    expect(second).toBe("busy");
    finish('{"reply":"Start with breakfast.","proposal":null}');
    expect(await first).toBe("replied");
    expect(calls).toBe(1);
    expect(messages(world, conversationId).map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  test("a failed reply gives the turn back, so Try again reaches the model at once", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "plan my morning");
    const failing = fakeModel(() => {
      throw new AiUpstreamError("DeepInfra returned HTTP 503", 503, "x");
    });
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, failing.call)).toBe("unavailable");
    const retry = fakeModel('{"reply":"Here now.","proposal":null}');
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, retry.call)).toBe("replied");
    expect(retry.calls).toHaveLength(1);
  });

  test("a claim outlasts the model's slowest answer", () => {
    // callLLM's timeout stops at the response headers; only the action's own limit bounds the body.
    expect(coach.TURN_CLAIM_MS).toBeGreaterThanOrEqual(10 * 60_000);
  });

  test("a reply whose claim was taken over neither saves nor frees the newer claim", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "plan my morning");
    const userMessage = messages(world, conversationId)[0] as Row;
    let failFirst: (error: Error) => void = () => {};
    let calls = 0;
    const slowFirst = (async (opts: AiCallOptions): Promise<AiResult> => {
      calls += 1;
      const content = await new Promise<string>((_resolve, reject) => {
        failFirst = reject;
      });
      return { tier: opts.tier, requestedTier: opts.tier, model: "test-model", content, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, escalated: false };
    }) as typeof callLLM;
    const first = coach.runCoachReply(world.actionAs(A), { conversationId }, slowFirst);
    while (calls === 0) await new Promise((r) => setTimeout(r, 1));
    // The first claim lapses (the reply was killed, say) and a retry claims the turn anew.
    const firstClaim = (world.row(userMessage._id) as Row).toolCalls as { coachClaim: string };
    await world.db.patch(userMessage._id, { toolCalls: { ...firstClaim, coachClaimUntil: Date.now() - 1 } });
    let finishSecond: (value: string) => void = () => {};
    const slowSecond = (async (opts: AiCallOptions): Promise<AiResult> => {
      calls += 1;
      const content = await new Promise<string>((resolve) => {
        finishSecond = resolve;
      });
      return { tier: opts.tier, requestedTier: opts.tier, model: "test-model", content, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, escalated: false };
    }) as typeof callLLM;
    const second = coach.runCoachReply(world.actionAs(A), { conversationId }, slowSecond);
    while (calls === 1) await new Promise((r) => setTimeout(r, 1));
    const secondClaim = ((world.row(userMessage._id) as Row).toolCalls as { coachClaim: string }).coachClaim;
    expect(secondClaim).not.toBe(firstClaim.coachClaim);

    // The first reply fails: it must not free the second reply's claim, so a third is still busy.
    failFirst(new AiUpstreamError("DeepInfra returned HTTP 503", 503, "x"));
    expect(await first).toBe("unavailable");
    const third = fakeModel('{"reply":"Third.","proposal":null}');
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, third.call)).toBe("busy");
    expect(third.calls).toHaveLength(0);

    finishSecond('{"reply":"Start with breakfast.","proposal":null}');
    expect(await second).toBe("replied");
    expect(messages(world, conversationId).map((m) => m.content)).toEqual(["plan my morning", "Start with breakfast."]);
  });

  test("a reply that lost its claim does not save its answer", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "plan my morning");
    const userMessage = messages(world, conversationId)[0] as Row;
    const takeover = (async (opts: AiCallOptions): Promise<AiResult> => {
      // While this reply waits on the model, its claim lapses and another reply takes the turn.
      await world.db.patch(userMessage._id, { toolCalls: { coachClaimUntil: Date.now() + 60_000, coachClaim: "newer" } });
      return { tier: opts.tier, requestedTier: opts.tier, model: "test-model", content: '{"reply":"Late.","proposal":null}', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, escalated: false };
    }) as typeof callLLM;
    await coach.runCoachReply(world.actionAs(A), { conversationId }, takeover);
    expect(messages(world, conversationId).map((m) => m.role)).toEqual(["user"]);
  });

  test("a reply that cannot be saved gives the turn back", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "plan my morning");
    const ctx = world.actionAs(A);
    const failingSave = {
      runQuery: ctx.runQuery,
      runMutation: (ref: unknown, args: unknown) =>
        getFunctionName(ref as never) === "coach:saveReply"
          ? Promise.reject(new Error("transient"))
          : ctx.runMutation(ref as never, args as never),
    } as unknown as ActionCtx;
    const model = fakeModel('{"reply":"Lost.","proposal":null}');
    expect(await coach.runCoachReply(failingSave, { conversationId }, model.call)).toBe("unavailable");
    const retry = fakeModel('{"reply":"Here now.","proposal":null}');
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, retry.call)).toBe("replied");
    expect(retry.calls).toHaveLength(1);
  });

  test("a claim left by a reply that died expires", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "hi");
    const userMessage = messages(world, conversationId)[0] as Row;
    await world.db.patch(userMessage._id, { toolCalls: { coachClaimUntil: Date.now() - 1, coachClaim: "old" } });
    const model = fakeModel('{"reply":"Hello.","proposal":null}');
    expect(await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call)).toBe("replied");
    expect(model.calls).toHaveLength(1);
  });

  test("someone else's conversation is refused", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world, B);
    await expect(say(world, conversationId, "hi")).rejects.toThrow();
    await expect(
      coach.runCoachReply(world.actionAs(A), { conversationId }, fakeModel("{}").call),
    ).rejects.toThrow();
  });
});

async function proposalTurn(world: World, proposal: object) {
  const conversationId = await seedConversation(world);
  await say(world, conversationId, "help");
  await coach.runCoachReply(
    world.actionAs(A),
    { conversationId },
    fakeModel(JSON.stringify({ reply: "Here is what I would add.", proposal })).call,
  );
  const reply = messages(world, conversationId).at(-1) as Row;
  return { conversationId, messageId: reply._id as Id<"messages"> };
}

describe("proposals change nothing until Accept, and Accept has a 5-minute Undo", () => {
  test("a proposal is stored pending and nothing is created", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "task", title: "Call the bank", minutes: 10, when: "today" });
    expect(coach.storedProposal(world.row(messageId)?.toolCalls)).toEqual({
      kind: "task",
      title: "Call the bank",
      minutes: 10,
      when: "today",
      status: "pending",
    });
    expect(world.rows("tasks")).toHaveLength(0);
  });

  test("Accept adds the task, due today when asked; Undo removes it", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "task", title: "Call the bank", minutes: 10, when: "today" });
    const dueTodayAt = Date.now() + 60_000;
    const accepted = await run(coach.acceptProposal, world.as(A), { messageId, dueTodayAt });
    expect(accepted.kind).toBe("task");
    expect(accepted.undoUntilMs - Date.now()).toBeGreaterThan(4 * 60_000);
    const task = world.row(accepted.createdId) as Row;
    expect(task).toMatchObject({ userId: A, title: "Call the bank", timeEstimate: 600_000, dueAt: dueTodayAt, status: "todo" });

    await expect(run(coach.acceptProposal, world.as(A), { messageId })).rejects.toThrow("already decided");

    await run(coach.undoProposal, world.as(A), { messageId });
    expect(typeof (world.row(accepted.createdId) as Row).deletedAt).toBe("number");
    expect(coach.storedProposal(world.row(messageId)?.toolCalls)?.status).toBe("undone");
  });

  test("the next turn tells the model what happened to an earlier card: here, added then undone", async () => {
    const world = makeWorld();
    const { conversationId, messageId } = await proposalTurn(world, { kind: "task", title: "Call the bank", minutes: 10, when: "today" });
    await run(coach.acceptProposal, world.as(A), { messageId, dueTodayAt: Date.now() + 60_000 });
    await run(coach.undoProposal, world.as(A), { messageId });
    await say(world, conversationId, "Plan my afternoon");
    const model = fakeModel('{"reply":"Start with the bank call.","proposal":null}');
    await coach.runCoachReply(world.actionAs(A), { conversationId }, model.call);
    const earlier = model.calls[0]?.messages.find((m) => m.role === "assistant")?.content ?? "";
    expect(earlier).toBe(
      'Here is what I would add.\n[Card: a task "Call the bank" for today. They added it, then undid it; nothing is left of it.]',
    );
    // The stored message itself is unchanged: the note is only for the model.
    expect(messages(world, conversationId).find((m) => m._id === messageId)?.content).toBe("Here is what I would add.");
  });

  test("a 'later' task, or a due time far from now, has no due date", async () => {
    const world = makeWorld();
    const later = await proposalTurn(world, { kind: "task", title: "Sort photos", minutes: 30, when: "later" });
    const a = await run(coach.acceptProposal, world.as(A), { messageId: later.messageId, dueTodayAt: Date.now() });
    expect((world.row(a.createdId) as Row).dueAt).toBeUndefined();
    const far = await proposalTurn(world, { kind: "task", title: "Call", minutes: 5, when: "today" });
    const b = await run(coach.acceptProposal, world.as(A), { messageId: far.messageId, dueTodayAt: Date.now() + 9 * 86_400_000 });
    expect((world.row(b.createdId) as Row).dueAt).toBeUndefined();
  });

  test("Accept makes a note page marked as coach-made", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "note", title: "Packing", body: "- [ ] Passport" });
    const accepted = await run(coach.acceptProposal, world.as(A), { messageId });
    expect(world.row(accepted.createdId)).toMatchObject({
      userId: A,
      title: "Packing",
      body: "- [ ] Passport",
      aiGenerated: true,
      pageType: "plain",
    });
  });

  test("Accept makes a template", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "template", name: "Gentle Monday", body: "## {{weekday}}", period: "weekly" });
    const accepted = await run(coach.acceptProposal, world.as(A), { messageId });
    expect(world.row(accepted.createdId)).toMatchObject({ userId: A, name: "Gentle Monday", periodType: "weekly" });
  });

  test("Accept with the person's edits creates the edited row and stores what was accepted", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "task", title: "Call the bank", minutes: 10, when: "today" });
    const accepted = await run(coach.acceptProposal, world.as(A), {
      messageId,
      edit: { title: "Call the bank about the card", minutes: 25, when: "later" },
    });
    expect(world.row(accepted.createdId)).toMatchObject({ title: "Call the bank about the card", timeEstimate: 25 * 60_000 });
    expect((world.row(accepted.createdId) as Row).dueAt).toBeUndefined();
    expect(coach.storedProposal(world.row(messageId)?.toolCalls)).toMatchObject({
      kind: "task",
      title: "Call the bank about the card",
      minutes: 25,
      when: "later",
      status: "accepted",
    });
  });

  test("edits pass the same checks and never change the kind", async () => {
    const world = makeWorld();
    const note = await proposalTurn(world, { kind: "note", title: "Packing", body: "- [ ] Passport" });
    await expect(run(coach.acceptProposal, world.as(A), { messageId: note.messageId, edit: { body: "   " } })).rejects.toThrow(
      "Give it a name",
    );
    expect(world.rows("notes")).toHaveLength(0);
    expect(coach.storedProposal(world.row(note.messageId)?.toolCalls)?.status).toBe("pending");
    // A task-only field on a note is ignored; the note stays a note.
    const accepted = await run(coach.acceptProposal, world.as(A), {
      messageId: note.messageId,
      edit: { title: "Trip", body: "- [ ] Passport\n- [ ] Charger", minutes: 5 },
    });
    expect(accepted.kind).toBe("note");
    expect(world.row(accepted.createdId)).toMatchObject({ title: "Trip", body: "- [ ] Passport\n- [ ] Charger" });
  });

  test("Reject changes nothing and cannot be accepted after", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "note", title: "Plan", body: "text" });
    await run(coach.rejectProposal, world.as(A), { messageId });
    expect(world.rows("notes")).toHaveLength(0);
    await expect(run(coach.acceptProposal, world.as(A), { messageId })).rejects.toThrow("already decided");
  });

  test("Undo after 5 minutes is refused and the row stays", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "note", title: "Plan", body: "text" });
    const accepted = await run(coach.acceptProposal, world.as(A), { messageId });
    const stored = coach.storedProposal(world.row(messageId)?.toolCalls);
    await world.db.patch(messageId, { toolCalls: { coachProposal: { ...stored, undoUntilMs: Date.now() - 1 } } });
    await expect(run(coach.undoProposal, world.as(A), { messageId })).rejects.toThrow("5 minutes");
    expect((world.row(accepted.createdId) as Row).deletedAt).toBeUndefined();
  });

  test("someone else cannot accept, reject or undo", async () => {
    const world = makeWorld();
    const { messageId } = await proposalTurn(world, { kind: "note", title: "Plan", body: "text" });
    for (const fn of [coach.acceptProposal, coach.rejectProposal, coach.undoProposal]) {
      await expect(run(fn, world.as(B), { messageId })).rejects.toThrow("Proposal not found");
    }
    expect(world.rows("notes")).toHaveLength(0);
  });
});

const DAY_START = Date.UTC(2026, 9, 15, 0, 0);
const DAY_END = DAY_START + 24 * 60 * 60_000;
/** Today's UTC date: Save only writes to a page dated today somewhere on Earth. */
const TODAY = new Date().toISOString().slice(0, 10);
const DAYS_AGO = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);

async function seedTask(world: World, fields: Record<string, unknown>) {
  return world.db.insert("tasks", {
    userId: A,
    status: "todo",
    priority: "medium",
    createdAt: 1,
    updatedAt: 1,
    ...fields,
  });
}

async function seedDailyPage(world: World, body: string, userId = A, date = TODAY) {
  return (await world.db.insert("notes", {
    userId,
    title: "Thu 15 Oct",
    body,
    pinned: false,
    periodType: "daily",
    pageType: "daily",
    date,
    createdAt: 1,
    updatedAt: 1,
  })) as Id<"notes">;
}

const DECISION = {
  kind: "decision",
  title: "This afternoon",
  steps: [
    { title: "Reply to Dana", minutes: 10, reason: "Quick, and it unblocks her" },
    { title: "Draft the report", minutes: 45 },
    { title: "Laundry", minutes: 20 },
  ],
};

/** The task blocks on a page, in order: title and status. */
function pageTasks(body: string) {
  return parseTempoBlocks(body).flatMap((segment) =>
    segment.kind === "valid" && segment.block.type === "task"
      ? [{ title: segment.block.data.title, status: segment.block.data.status }]
      : [],
  );
}

describe("a decision: the coach orders today's tasks, and saving it writes to today's page", () => {
  test("the model sees the caller's open tasks for their day, and only those", async () => {
    const world = makeWorld();
    await seedTask(world, { title: "Reply to Dana", dueAt: DAY_START + 9 * 3_600_000, timeEstimate: 10 * 60_000 });
    await seedTask(world, { title: "Draft the report", dueAt: DAY_START + 10 * 3_600_000, status: "in_progress" });
    await seedTask(world, { title: "Already done", dueAt: DAY_START + 3_600_000, status: "done" });
    await seedTask(world, { title: "Deleted", dueAt: DAY_START + 3_600_000, deletedAt: 5 });
    await seedTask(world, { title: "Tomorrow", dueAt: DAY_END + 3_600_000 });
    await seedTask(world, { title: "Someone else's", dueAt: DAY_START + 3_600_000, userId: B });
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "What order should I do these in?");
    const model = fakeModel(JSON.stringify({ reply: "Dana first.", proposal: DECISION }));
    await coach.runCoachReply(world.actionAs(A), { conversationId, dayStartMs: DAY_START, dayEndMs: DAY_END }, model.call);
    const sent = model.calls[0]?.messages.map((m) => m.content).join("\n") ?? "";
    expect(sent).toContain("<tasks>\n- Reply to Dana (10 min)\n- Draft the report\n</tasks>");
    for (const hidden of ["Already done", "Deleted", "Tomorrow", "Someone else's"]) {
      expect(sent).not.toContain(hidden);
    }
  });

  test("a step the model shortened or re-cased is stored with the person's own task title", async () => {
    const world = makeWorld();
    await seedTask(world, { title: "Reply to Dana about Friday's draft", dueAt: DAY_START + 9 * 3_600_000 });
    await seedTask(world, { title: "Draft the report", dueAt: DAY_START + 10 * 3_600_000 });
    await seedTask(world, { title: "Laundry: towels", dueAt: DAY_START + 11 * 3_600_000 });
    await seedTask(world, { title: "Laundry: sheets", dueAt: DAY_START + 12 * 3_600_000 });
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "What order should I do these in?");
    const steps = [
      { title: "Reply to Dana", minutes: 10 },
      { title: "draft the report.", minutes: 45 },
      { title: "Laundry", minutes: 20 },
      { title: "Stretch", minutes: 5 },
    ];
    const model = fakeModel(JSON.stringify({ reply: "Dana first.", proposal: { kind: "decision", steps } }));
    await coach.runCoachReply(world.actionAs(A), { conversationId, dayStartMs: DAY_START, dayEndMs: DAY_END }, model.call);
    const reply = messages(world, conversationId).find((m) => m.role === "assistant");
    const stored = coach.storedProposal(reply?.toolCalls);
    expect(stored?.kind === "decision" ? stored.steps.map((step) => step.title) : null).toEqual([
      "Reply to Dana about Friday's draft",
      "Draft the report",
      // Two tasks begin with "Laundry": which one is meant can't be told, so the step stays as written.
      "Laundry",
      "Stretch",
    ]);
  });

  test("closed tasks never crowd open ones out of the cap", async () => {
    const world = makeWorld();
    for (let i = 0; i < 120; i += 1) {
      await seedTask(world, { title: `Done ${i}`, dueAt: DAY_START + i * 1_000, status: "done" });
    }
    await seedTask(world, { title: "Still open", dueAt: DAY_START + 200_000 });
    const conversationId = await seedConversation(world);
    await say(world, conversationId, "What order should I do these in?");
    const model = fakeModel('{"reply":"Open one first.","proposal":null}');
    await coach.runCoachReply(world.actionAs(A), { conversationId, dayStartMs: DAY_START, dayEndMs: DAY_END }, model.call);
    const sent = model.calls[0]?.messages.map((m) => m.content).join("\n") ?? "";
    expect(sent).toContain("<tasks>\n- Still open\n</tasks>");
  });

  test("without a day, or with bounds that are not one day, no tasks are sent", async () => {
    const world = makeWorld();
    await seedTask(world, { title: "Reply to Dana", dueAt: DAY_START + 3_600_000 });
    for (const bounds of [{}, { dayStartMs: DAY_START, dayEndMs: DAY_START + 7 * 86_400_000 }, { dayStartMs: DAY_END, dayEndMs: DAY_START }]) {
      const conversationId = await seedConversation(world);
      await say(world, conversationId, "what first?");
      const model = fakeModel('{"reply":"Start small.","proposal":null}');
      await coach.runCoachReply(world.actionAs(A), { conversationId, ...bounds }, model.call);
      expect(model.calls[0]?.messages.some((m) => m.content.startsWith("Their open tasks"))).toBe(false);
    }
  });

  test("a decision is stored pending and the page is untouched", async () => {
    const world = makeWorld();
    const pageId = await seedDailyPage(world, "## Intention\n");
    const { messageId } = await proposalTurn(world, DECISION);
    expect(coach.storedProposal(world.row(messageId)?.toolCalls)).toEqual({ ...DECISION, status: "pending" } as never);
    expect((world.row(pageId) as Row).body).toBe("## Intention\n");
  });

  test("Save adds the title and one task block per step, in order, to the end of today's page; Undo takes them off", async () => {
    const world = makeWorld();
    const pageId = await seedDailyPage(world, "## Intention\nRest after lunch\n");
    const { messageId } = await proposalTurn(world, DECISION);
    const accepted = await run(coach.acceptProposal, world.as(A), { messageId, todayDate: TODAY });
    expect(accepted).toMatchObject({ kind: "decision", createdId: pageId });
    expect(accepted.undoUntilMs - Date.now()).toBeGreaterThan(4 * 60_000);

    const body = (world.row(pageId) as Row).body as string;
    expect(body.startsWith("## Intention\nRest after lunch\n\n### This afternoon\n\n```json tempo\n")).toBe(true);
    expect(pageTasks(body)).toEqual([
      { title: "Reply to Dana", status: "now" },
      { title: "Draft the report", status: "later" },
      { title: "Laundry", status: "later" },
    ]);
    expect(parseTempoBlocks(body).some((segment) => segment.kind === "broken")).toBe(false);
    const stored = coach.storedProposal(world.row(messageId)?.toolCalls);
    expect(stored?.status).toBe("accepted");
    expect(stored?.blockIds).toHaveLength(3);
    expect(world.rows("tasks")).toHaveLength(0);

    await run(coach.undoProposal, world.as(A), { messageId });
    expect((world.row(pageId) as Row).body).toBe("## Intention\nRest after lunch\n");
    expect((world.row(pageId) as Row).deletedAt).toBeUndefined();
    expect(coach.storedProposal(world.row(messageId)?.toolCalls)?.status).toBe("undone");
  });

  test("Undo after the person wrote more keeps their words and removes only the decision's blocks", async () => {
    const world = makeWorld();
    const pageId = await seedDailyPage(world, "## Intention\n");
    const { messageId } = await proposalTurn(world, DECISION);
    await run(coach.acceptProposal, world.as(A), { messageId, todayDate: TODAY });
    const saved = (world.row(pageId) as Row).body as string;
    await world.db.patch(pageId, { body: `${saved}Then a walk.\n` });
    await run(coach.undoProposal, world.as(A), { messageId });
    const body = (world.row(pageId) as Row).body as string;
    expect(body).toBe("## Intention\nThen a walk.\n");
  });

  test("Undo after a step was ticked removes the decision's blocks and its heading, by id", async () => {
    const world = makeWorld();
    const pageId = await seedDailyPage(world, "## Intention\n");
    const { messageId } = await proposalTurn(world, DECISION);
    await run(coach.acceptProposal, world.as(A), { messageId, todayDate: TODAY });
    const saved = (world.row(pageId) as Row).body as string;
    // The person ticks the first step in the editor: that fence's JSON changes.
    const ticked = saved.replace('"status":"now"', '"status":"done"');
    expect(ticked).not.toBe(saved);
    await world.db.patch(pageId, { body: `${ticked}A note.\n` });
    await run(coach.undoProposal, world.as(A), { messageId });
    const body = (world.row(pageId) as Row).body as string;
    expect(pageTasks(body)).toEqual([]);
    expect(body).not.toContain("### This afternoon");
    expect(body).toContain("## Intention\n");
    expect(body).toContain("A note.\n");
  });

  test("fallback Undo removes only the heading right above the decision's blocks", async () => {
    const world = makeWorld();
    const pageId = await seedDailyPage(world, "## Intention\n");
    const first = await proposalTurn(world, DECISION);
    await run(coach.acceptProposal, world.as(A), { messageId: first.messageId, todayDate: TODAY });
    const saved = (world.row(pageId) as Row).body as string;
    // The first decision's step is ticked, then a second decision with the same title is saved.
    await world.db.patch(pageId, { body: saved.replace('"status":"now"', '"status":"done"') });
    const second = await proposalTurn(world, DECISION);
    await run(coach.acceptProposal, world.as(A), { messageId: second.messageId, todayDate: TODAY });
    const both = (world.row(pageId) as Row).body as string;
    expect(both.split("### This afternoon\n\n")).toHaveLength(3);

    await run(coach.undoProposal, world.as(A), { messageId: first.messageId });
    const body = (world.row(pageId) as Row).body as string;
    expect(body.split("### This afternoon\n\n")).toHaveLength(2);
    // The heading left is the second decision's: what its Save added is still there, unchanged.
    const added = (coach.storedProposal(world.row(second.messageId)?.toolCalls) as { appended?: string }).appended;
    expect(added?.includes("### This afternoon\n\n")).toBe(true);
    expect(body.endsWith(added as string)).toBe(true);
    expect(pageTasks(body)).toEqual([
      { title: "Reply to Dana", status: "now" },
      { title: "Draft the report", status: "later" },
      { title: "Laundry", status: "later" },
    ]);
    // The second decision is whole: its own Undo still takes it off exactly.
    await run(coach.undoProposal, world.as(A), { messageId: second.messageId });
    expect(pageTasks((world.row(pageId) as Row).body as string)).toEqual([]);
    expect((world.row(pageId) as Row).body).not.toContain("### This afternoon");
  });

  test("fallback Undo keeps a heading the person rewrote, and their own heading with the same title", async () => {
    const world = makeWorld();
    const pageId = await seedDailyPage(world, "## Intention\n");
    const { messageId } = await proposalTurn(world, DECISION);
    await run(coach.acceptProposal, world.as(A), { messageId, todayDate: TODAY });
    const saved = (world.row(pageId) as Row).body as string;
    const edited = saved.replace("### This afternoon\n", "### Afternoon plan\n");
    await world.db.patch(pageId, { body: `${edited}### This afternoon\n\nMy notes.\n` });
    await run(coach.undoProposal, world.as(A), { messageId });
    const body = (world.row(pageId) as Row).body as string;
    expect(pageTasks(body)).toEqual([]);
    expect(body).toContain("### Afternoon plan\n");
    expect(body).toContain("### This afternoon\n\nMy notes.\n");
  });

  test("Save needs today's date and today's own page; nothing changes when either is missing", async () => {
    const world = makeWorld();
    await seedDailyPage(world, "B's day\n", B);
    const { messageId } = await proposalTurn(world, DECISION);
    await expect(run(coach.acceptProposal, world.as(A), { messageId })).rejects.toThrow("Open Today");
    await expect(run(coach.acceptProposal, world.as(A), { messageId, todayDate: "2026-02-30" })).rejects.toThrow("Open Today");
    // A real page on another day is never written to by "Save to today".
    await seedDailyPage(world, "Monday\n", A, DAYS_AGO);
    await expect(run(coach.acceptProposal, world.as(A), { messageId, todayDate: DAYS_AGO })).rejects.toThrow("Open Today");
    await expect(run(coach.acceptProposal, world.as(A), { messageId, todayDate: TODAY })).rejects.toThrow("isn't ready");
    expect(coach.storedProposal(world.row(messageId)?.toolCalls)?.status).toBe("pending");
    expect(world.rows("notes").map((n) => n.body)).toEqual(["B's day\n", "Monday\n"]);
  });

  test("a full page refuses the save instead of writing broken blocks", async () => {
    const world = makeWorld();
    const fences = Array.from({ length: 255 }, (_, i) =>
      `\`\`\`json tempo\n${JSON.stringify({ id: `blk_01JQ8Z3K4M5N6P7Q8R9S${String(i).padStart(6, "0")}`, v: 1, type: "task", data: { title: `t${i}`, durationMin: 5, status: "later", order: i, inelastic: false } })}\n\`\`\`\n`,
    ).join("");
    const pageId = await seedDailyPage(world, fences);
    const { messageId } = await proposalTurn(world, DECISION);
    await expect(run(coach.acceptProposal, world.as(A), { messageId, todayDate: TODAY })).rejects.toThrow("full");
    expect((world.row(pageId) as Row).body).toBe(fences);
  });
});
