import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import * as approval from "./approval";
import * as coach from "./coach";
import { AiAuthError, AiUpstreamError } from "./lib/ai_errors";
import type { AiCallOptions, AiResult, callLLM } from "./lib/ai_router";
import { PENDING_APPROVAL_MESSAGE } from "./lib/approval";

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
      order: (direction: "asc" | "desc") => builder(direction === "desc" ? [...rows].reverse() : rows),
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
    "coach:replyContext": coach.replyContext,
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
