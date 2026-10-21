import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import * as approval from "../approval";
import * as coach from "../coach";
import type { AiCallOptions, AiResult, callLLM } from "./ai_router";
import { type CoachProposal, readProposal } from "./coachPrompt";
import {
  ALREADY_ON_TODAY_NOTE,
  duplicateOfOpenTask,
  MAX_OPEN_TASKS_CHECKED,
  normalizeTitle,
} from "./coachProposalGuard";
import { stubWebSearch, WebSearchError, type WebSearchResult } from "./webSearch";

/**
 * The coach doesn't propose a task that's already open on Today (TEMPO-B07-29, #1031). The pure
 * guard first, then whole turns through `coach.runCoachReply`, with the db in memory and a
 * stand-in for the model (the same setup as convex/coach_chat.test.ts).
 */

const task = (title: string): CoachProposal => ({
  kind: "task",
  title,
  minutes: 10,
  when: "today",
});

describe("normalizeTitle", () => {
  test("case, spaces and punctuation are set aside", () => {
    const plain = normalizeTitle("call mom");
    expect(plain).toBe("callmom");
    for (const title of [
      "Call Mom",
      "CALL MOM",
      "  call\tmom \n",
      "call   mom",
      "callmom",
      "Call mom!",
      "call-mom.",
      "“Call mom”",
      "call, mom?",
      "Ｃａｌｌ ｍｏｍ",
    ]) {
      expect(normalizeTitle(title)).toBe(plain);
    }
  });

  test("Hebrew niqqud, and Hebrew punctuation, are set aside", () => {
    const pointed = "לְהִתְקַשֵּׁר לְאִמָּא";
    expect(/[\u05B0-\u05C7]/.test(pointed)).toBe(true);
    expect(normalizeTitle(pointed)).toBe(normalizeTitle("להתקשר לאמא"));
    expect(normalizeTitle(pointed)).toBe("להתקשרלאמא");
    // A letter with its point in one presentation form (U+FB2A, shin with its dot).
    expect(normalizeTitle("\uFB2Aבת")).toBe("שבת");
    // Maqaf, geresh and gershayim, as typed on a Hebrew or an English keyboard.
    expect(normalizeTitle("בית־ספר")).toBe(normalizeTitle("בית ספר"));
    expect(normalizeTitle("צ׳יפס")).toBe(normalizeTitle("צ'יפס"));
    expect(normalizeTitle("יו״ר הוועד")).toBe(normalizeTitle('יו"ר הוועד'));
  });

  test("emoji are set aside, joined and skin-toned ones too", () => {
    for (const title of ["📞 Call mom", "Call mom ☎️", "Call mom 👩🏽‍👧", "#️⃣ call mom 🇮🇱"]) {
      expect(normalizeTitle(title)).toBe("callmom");
    }
  });

  test("other words stay different", () => {
    expect(normalizeTitle("Call mom back")).not.toBe(normalizeTitle("Call mom"));
    expect(normalizeTitle("Call dad")).not.toBe(normalizeTitle("Call mom"));
    expect(normalizeTitle("Pay rent 2")).not.toBe(normalizeTitle("Pay rent 3"));
  });

  test("a title with no letters or digits is empty", () => {
    expect(normalizeTitle("🎉!! …")).toBe("");
  });
});

describe("duplicateOfOpenTask", () => {
  const open = [{ title: "Water the plants" }, { title: "Call mom 📞" }];

  test("a task card matching an open task gives that task", () => {
    expect(duplicateOfOpenTask(task("call mom"), open)).toBe(open[1] as { title: string });
    expect(duplicateOfOpenTask(task("Call mom back"), open)).toBeNull();
    expect(duplicateOfOpenTask(task("Call dad"), [])).toBeNull();
    expect(duplicateOfOpenTask(null, open)).toBeNull();
  });

  test("decision, page and template cards pass, even with an open task's title", () => {
    const cards: CoachProposal[] = [
      { kind: "note", title: "Call mom", body: "- ask about Sunday" },
      { kind: "template", name: "Call mom", body: "- ask about Sunday", period: "none" },
      {
        kind: "decision",
        title: "Call mom",
        steps: [
          { title: "Call mom", minutes: 10 },
          { title: "Water the plants", minutes: 5 },
        ],
      },
    ];
    for (const card of cards) {
      expect(duplicateOfOpenTask(card, open)).toBeNull();
    }
  });

  test("titles with no letters or digits never match each other", () => {
    expect(duplicateOfOpenTask(task("🎉"), [{ title: "🎂" }, { title: "!!" }])).toBeNull();
  });

  test("a long title matches the card the model cut from it", () => {
    const long = `Write the grant report ${"and the appendix ".repeat(20)}`.trim();
    const card = readProposal({ kind: "task", title: long, minutes: 30, when: "today" });
    expect(card?.kind === "task" && card.title.endsWith("…")).toBe(true);
    expect(duplicateOfOpenTask(card, [{ title: long }])).toEqual({ title: long });
  });

  test(`at most ${MAX_OPEN_TASKS_CHECKED} open tasks are checked`, () => {
    const many = Array.from({ length: MAX_OPEN_TASKS_CHECKED }, (_, i) => ({ title: `Task ${i}` }));
    expect(duplicateOfOpenTask(task("Call mom"), [...many, { title: "Call mom" }])).toBeNull();
    expect(
      duplicateOfOpenTask(task("Call mom"), [...many.slice(1), { title: "Call mom" }])
    ).toEqual({
      title: "Call mom",
    });
  });
});

// ---------------------------------------------------------------------------
// Whole turns: the in-memory db and model stand-in of convex/coach_chat.test.ts
// ---------------------------------------------------------------------------

type Row = Record<string, unknown> & { _id: string };

const A = "users:a";
const B = "users:b";
const DAY_START = Date.UTC(2026, 9, 16, 0, 0);
const DAY_END = DAY_START + 24 * 60 * 60_000;
const HOUR = 60 * 60_000;

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
  for (const _id of [A, B]) {
    table("users").set(_id, {
      _id,
      _creationTime: 0,
      email: `${_id}@example.com`,
      approvalStatus: "approved",
    });
  }
  function builder(rows: Row[]) {
    return {
      withIndex: (_name: string, fn: (q: unknown) => unknown) => {
        const conds: Array<(row: Row) => boolean> = [];
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
        const cmp =
          (check: (diff: number) => boolean) => (field: string, value: number | string) => {
            conds.push((row) => check(order(row[field], value)));
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
      order: (direction: "asc" | "desc") =>
        builder(direction === "desc" ? [...rows].reverse() : rows),
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
  };
  const actionAs = (userId: string) => {
    const dispatch = (ref: unknown, args: unknown) => {
      const handler = handlers[getFunctionName(ref as never)];
      if (!handler) throw new Error(`unexpected call ${getFunctionName(ref as never)}`);
      return run(handler, as(userId), args);
    };
    return { runQuery: dispatch, runMutation: dispatch } as unknown as ActionCtx;
  };
  return { db, as, actionAs, rows: (t: string) => Array.from(table(t).values()) };
}

type Handler = { _handler: (ctx: unknown, args: unknown) => Promise<unknown> };
const run = (fn: unknown, ctx: unknown, args: unknown) => (fn as Handler)._handler(ctx, args);

type World = ReturnType<typeof makeWorld>;

/** A stand-in for `callLLM`: answers each call with the next of `contents`, and records it. */
function fakeModel(...contents: Array<string | (() => never)>) {
  const calls: AiCallOptions[] = [];
  const call = (async (opts: AiCallOptions): Promise<AiResult> => {
    const content = contents[Math.min(calls.length, contents.length - 1)] as string | (() => never);
    calls.push(opts);
    if (typeof content === "function") content();
    return {
      tier: opts.tier,
      requestedTier: opts.tier,
      model: `test-model-${calls.length}`,
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

async function seedPreferences(world: World, locale: "en" | "he", coachWebSearch = false) {
  await world.db.insert("userPreferences", {
    userId: A,
    theme: "system",
    locale,
    weekStartsOn: 1,
    timeZone: "UTC",
    emailReminders: true,
    inAppNotifications: true,
    coachWebSearch,
    createdAt: 1,
    updatedAt: 1,
  });
}

/**
 * One coach turn on a new message in a new conversation, for the person's day. Returns the saved
 * reply and the model's calls.
 */
async function turn(
  world: World,
  answers: string[],
  search: ReturnType<typeof stubWebSearch> | null = null
) {
  const conversationId = (await world.db.insert("conversations", {
    userId: A,
    title: "Chat",
    createdAt: 1,
    updatedAt: 1,
  })) as Id<"conversations">;
  await run(coach.sendMessage, world.as(A), { conversationId, content: "Help me with today" });
  const model = fakeModel(...answers);
  const status = await coach.runCoachReply(
    world.actionAs(A),
    { conversationId, dayStartMs: DAY_START, dayEndMs: DAY_END },
    model.call,
    search?.provider ?? null
  );
  const reply = world
    .rows("messages")
    .filter((m) => m.conversationId === conversationId && m.role === "assistant");
  expect(reply).toHaveLength(1);
  return { status, reply: reply[0] as Row, calls: model.calls };
}

/** A model answer offering `proposal`, with `reply` as its words. */
const offering = (
  proposal: object,
  reply = "Here is a task for today. Nothing changes until you accept it."
) => JSON.stringify({ reply, proposal });

describe("a coach turn whose task card is already open on Today", () => {
  test("the card goes; the reply goes out with one fixed line, and the model is called once", async () => {
    const world = makeWorld();
    await seedTask(world, { title: "Call the bank", dueAt: DAY_START + 9 * HOUR });
    const { status, reply, calls } = await turn(world, [offering(task("call the bank!"))]);
    expect(status).toBe("replied");
    expect(calls).toHaveLength(1);
    expect(reply.toolCalls).toBeUndefined();
    // No card, so no promise about one.
    expect(reply.content).toBe(`Here is a task for today.\n\n${ALREADY_ON_TODAY_NOTE.en}`);
    expect(ALREADY_ON_TODAY_NOTE.en).toBe(
      "(That task is already on Today, so there's nothing new to add.)"
    );
    expect(world.rows("tasks")).toHaveLength(1);
  });

  test("in Hebrew, the line is in Hebrew, and niqqud doesn't hide the match", async () => {
    const world = makeWorld();
    await seedPreferences(world, "he");
    await seedTask(world, { title: "להתקשר לבנק", dueAt: DAY_START + 9 * HOUR });
    const { reply } = await turn(world, [offering(task("לְהִתְקַשֵּׁר לַבַּנְק"), "הנה משימה להיום.")]);
    expect(reply.toolCalls).toBeUndefined();
    expect(reply.content).toBe(`הנה משימה להיום.\n\n${ALREADY_ON_TODAY_NOTE.he}`);
    expect(ALREADY_ON_TODAY_NOTE.he).toBe("(המשימה הזו כבר מופיעה בהיום, אז אין מה להוסיף.)");
  });

  test("done and deleted tasks don't count; an open one does", async () => {
    const world = makeWorld();
    await seedTask(world, { title: "Call the bank", dueAt: DAY_START + 9 * HOUR, status: "done" });
    await seedTask(world, { title: "Pay rent", dueAt: DAY_START + 10 * HOUR, deletedAt: 5 });
    await seedTask(world, {
      title: "Water the plants",
      dueAt: DAY_START + 11 * HOUR,
      status: "in_progress",
    });
    for (const title of ["Call the bank", "Pay rent"]) {
      const { reply } = await turn(world, [offering(task(title))]);
      expect(coach.storedProposal(reply.toolCalls)).toMatchObject({
        kind: "task",
        title,
        status: "pending",
      });
      expect(reply.content).toBe("Here is a task for today. Nothing changes until you accept it.");
    }
    const { reply } = await turn(world, [offering(task("water the plants"))]);
    expect(reply.toolCalls).toBeUndefined();
    expect(reply.content).toBe(`Here is a task for today.\n\n${ALREADY_ON_TODAY_NOTE.en}`);
  });

  test("tomorrow's tasks, and someone else's, don't count; today's does", async () => {
    const world = makeWorld();
    await seedTask(world, { title: "Call the bank", dueAt: DAY_END + HOUR });
    await seedTask(world, { title: "Call the bank", dueAt: DAY_START + 9 * HOUR, userId: B });
    const kept = await turn(world, [offering(task("Call the bank"))]);
    expect(coach.storedProposal(kept.reply.toolCalls)).toMatchObject({
      kind: "task",
      title: "Call the bank",
    });
    expect(kept.reply.content).not.toContain(ALREADY_ON_TODAY_NOTE.en);

    await seedTask(world, { title: "Call the bank", dueAt: DAY_END - HOUR });
    const dropped = await turn(world, [offering(task("Call the bank"))]);
    expect(dropped.reply.toolCalls).toBeUndefined();
    expect(dropped.reply.content).toBe(`Here is a task for today.\n\n${ALREADY_ON_TODAY_NOTE.en}`);
  });

  test("decision, page and template cards pass with an open task's title; a task card doesn't", async () => {
    const world = makeWorld();
    await seedTask(world, { title: "Call the bank", dueAt: DAY_START + 9 * HOUR });
    await seedTask(world, { title: "Water the plants", dueAt: DAY_START + 10 * HOUR });
    const cards = [
      { kind: "note", title: "Call the bank", body: "- ask about the fee" },
      { kind: "template", name: "Call the bank", body: "- ask about the fee", period: "none" },
      {
        kind: "decision",
        steps: [
          { title: "Call the bank", minutes: 10 },
          { title: "Water the plants", minutes: 5 },
        ],
      },
    ];
    for (const card of cards) {
      const { reply } = await turn(world, [offering(card, "Here is what I would change.")]);
      expect(coach.storedProposal(reply.toolCalls)).toMatchObject({
        kind: card.kind,
        status: "pending",
      });
      expect(reply.content).toBe("Here is what I would change.");
    }
    const { reply } = await turn(world, [
      offering(task("Call the bank"), "Here is what I would change."),
    ]);
    expect(reply.toolCalls).toBeUndefined();
    expect(reply.content).toBe(`Here is what I would change.\n\n${ALREADY_ON_TODAY_NOTE.en}`);
  });
});

describe("a duplicate task card on a turn with web search (#988)", () => {
  const RESULTS: WebSearchResult[] = [
    {
      title: "Pharmacy hours",
      site: "pharmacy.example",
      url: "https://pharmacy.example/hours",
      snippet: "Opens at 8:30.",
    },
    {
      title: "Holiday hours",
      site: "news.example",
      url: "https://news.example/holiday",
      snippet: "Closed Monday.",
    },
  ];
  const FIRST = JSON.stringify({
    reply:
      "Here is a task for today. Pharmacies often open at 9. Nothing changes until you accept it.",
    proposal: task("Call the pharmacy"),
    search: "pharmacy opening hours",
  });

  test("the card goes before the search, so the second call never mentions it; no model call is added", async () => {
    const world = makeWorld();
    await seedPreferences(world, "en", true);
    await seedTask(world, { title: "Call the pharmacy", dueAt: DAY_START + 9 * HOUR });
    const search = stubWebSearch(RESULTS);
    const second = '{"reply":"It opens at 8:30 [1].","proposal":null}';
    const { status, reply, calls } = await turn(world, [FIRST, second], search);
    expect(status).toBe("replied");
    expect(search.calls).toHaveLength(1);
    expect(calls).toHaveLength(2);
    const sent = calls[1]?.messages.map((m) => m.content).join("\n") ?? "";
    expect(sent).not.toContain("Your first answer already offered a card");
    expect(sent).toContain('Leave "proposal" null: a card is never made from web results.');
    expect(reply.toolCalls).toBeUndefined();
    expect(reply.content).toBe(`It opens at 8:30 [1].\n\n${ALREADY_ON_TODAY_NOTE.en}`);
    expect(reply.sources).toHaveLength(2);
  });

  test("when the search fails, the first answer goes out without its card, then both lines", async () => {
    const world = makeWorld();
    await seedPreferences(world, "en", true);
    await seedTask(world, { title: "Call the pharmacy", dueAt: DAY_START + 9 * HOUR });
    const search = stubWebSearch(() => {
      throw new WebSearchError("upstream");
    });
    const { reply, calls } = await turn(world, [FIRST], search);
    expect(calls).toHaveLength(1);
    expect(reply.toolCalls).toBeUndefined();
    expect(reply.content).toBe(
      `Here is a task for today. Pharmacies often open at 9.\n\n${ALREADY_ON_TODAY_NOTE.en}\n\n${coach.WEB_SEARCH_NOTES.failed.en}`
    );
  });
});
