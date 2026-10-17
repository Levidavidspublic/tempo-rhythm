import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { softDeleteUserAccount } from "./lib/accountDeletion";
import { UNDO_WINDOW_MS } from "./lib/softDelete";
import { parseTempoBlocks } from "./lib/blocks";
import {
  findStudyBlock,
  liveStates,
  newStudyBlockId,
  readStudySets,
  STATE_SCAN_LIMIT,
  STUDY_READ_BUDGET,
  STUDY_SET_ROW_LIMIT,
  STUDY_SET_SCAN_LIMIT,
  studyBlockFence,
} from "./lib/study";
import appSchema from "./schema";
import { runGenerate } from "./study";

/**
 * Study layer (kitchen T3) on `convex-test` with the real schema and function bodies. All ids,
 * titles and card text are synthetic. Nothing here calls a model or the network: `generate`'s
 * no-key path returns before any provider call, and the ready path uses a stand-in `call`.
 */

const modules: Record<string, () => Promise<unknown>> = {
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./_generated/server.js": () => import("./_generated/server.js"),
  "./approval.ts": () => import("./approval"),
  "./study.ts": () => import("./study"),
};

const NOW = Date.UTC(2026, 9, 16, 9, 0, 0);
const MIN = 60_000;

beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => setSystemTime());

const deck = {
  title: "Cell biology",
  cards: [
    { id: "c1", front: "Mitochondria", back: "Makes ATP" },
    { id: "c2", front: "Ribosome", back: "Makes proteins", hint: "Starts with R" },
    { id: "c3", front: "Nucleus", back: "Holds DNA" },
  ],
  origin: "outline",
};

const quiz = {
  title: "Cells quiz",
  mode: "fixed",
  questions: [
    {
      id: "q1",
      prompt: "What makes ATP?",
      choices: [
        { id: "a", text: "Mitochondria" },
        { id: "b", text: "Nucleus" },
      ],
      answerId: "a",
      difficulty: 1,
    },
  ],
  origin: "user",
};

const bagrutTest = {
  title: "Practice paper",
  style: "bagrut",
  sections: [
    {
      id: "s1",
      title: "Part one",
      questions: [
        {
          plugin: "short",
          id: "t1",
          prompt: "Name the powerhouse of the cell.",
          points: 10,
          accepted: ["mitochondria"],
        },
      ],
    },
  ],
  origin: "user",
};

function setup() {
  const t = convexTest(appSchema, modules);
  return t;
}

type T = ReturnType<typeof setup>;

async function addUser(t: T, email: string) {
  return t.run((ctx) =>
    ctx.db.insert("users", { email, approvalStatus: "approved", createdAt: NOW, updatedAt: NOW }),
  );
}

function as(t: T, userId: Id<"users">) {
  return t.withIdentity({ subject: userId });
}

async function addPage(t: T, userId: Id<"users">, title: string, body: string) {
  return t.run((ctx) =>
    ctx.db.insert("notes", {
      userId,
      title,
      body,
      pinned: false,
      periodType: "none",
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
}

async function twoUsers() {
  const t = setup();
  const a = await addUser(t, "a@example.com");
  const b = await addUser(t, "b@example.com");
  return { t, a, b, asA: as(t, a), asB: as(t, b) };
}

describe("block ids and fences", () => {
  test("newStudyBlockId matches the codec grammar and the fence parses back", () => {
    const id = newStudyBlockId(NOW);
    expect(id).toMatch(/^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    const body = `Intro\n\n${studyBlockFence(id, "flashcards", deck)}`;
    const block = findStudyBlock(body, id);
    expect(block?.type).toBe("flashcards");
    expect(findStudyBlock(body, newStudyBlockId(NOW + 1))).toBeNull();
  });
});

describe("createFromPreview and undoCreate", () => {
  test("happy path: makes a page with the block, a set, and an undo window", async () => {
    const { t, a, asA } = await twoUsers();
    const source = await addPage(t, a, "Biology notes", "Mitochondria make ATP.");
    const out = await asA.mutation(api.study.createFromPreview, {
      kind: "flashcards",
      title: "Cell cards",
      data: deck,
      sourceNoteId: source,
    });
    expect(out.undoUntil).toBe(NOW + UNDO_WINDOW_MS);
    const note = await t.run((ctx) => ctx.db.get(out.noteId));
    expect(note?.title).toBe("Cell cards");
    expect(note?.body.startsWith("Made from [[Biology notes]]\n\n```json tempo\n")).toBe(true);
    const set = await t.run((ctx) => ctx.db.get(out.setId));
    expect(set).toMatchObject({
      userId: a,
      noteId: out.noteId,
      kind: "flashcards",
      title: "Cell biology",
      itemCount: 3,
      sourceNoteId: source,
      createdByTempo: true,
    });

    const view = await asA.query(api.study.getSet, { setId: out.setId });
    expect(view?.block.type).toBe("flashcards");
    expect(view?.note).toEqual({ id: out.noteId, title: "Cell cards" });
    expect(view?.states).toEqual({});
    expect(view?.attempts).toEqual([]);
  });

  test("error: data that fails the codec schema is refused and nothing is written", async () => {
    const { t, asA } = await twoUsers();
    await expect(
      asA.mutation(api.study.createFromPreview, {
        kind: "flashcards",
        title: "Bad",
        data: { ...deck, cards: [] },
      }),
    ).rejects.toThrow("can't be saved");
    await expect(
      asA.mutation(api.study.createFromPreview, { kind: "quiz", title: "Wrong kind", data: deck }),
    ).rejects.toThrow("can't be saved");
    const counts = await t.run(async (ctx) => ({
      notes: (await ctx.db.query("notes").collect()).length,
      sets: (await ctx.db.query("studySets").collect()).length,
    }));
    expect(counts).toEqual({ notes: 0, sets: 0 });
  });

  test("error: another person's source page is refused", async () => {
    const { t, b, asA } = await twoUsers();
    const foreign = await addPage(t, b, "B's notes", "secret");
    await expect(
      asA.mutation(api.study.createFromPreview, {
        kind: "flashcards",
        title: "Steal",
        data: deck,
        sourceNoteId: foreign,
      }),
    ).rejects.toThrow("This page isn't available.");
  });

  test("undoCreate inside 5 minutes removes the set and the page it made", async () => {
    const { t, asA } = await twoUsers();
    const out = await asA.mutation(api.study.createFromPreview, {
      kind: "flashcards",
      title: "Cards",
      data: deck,
    });
    setSystemTime(new Date(NOW + 4 * MIN));
    expect(await asA.mutation(api.study.undoCreate, { setId: out.setId })).toEqual({
      success: true,
      pageRemoved: true,
    });
    const [note, set] = await t.run(async (ctx) => [
      await ctx.db.get(out.noteId),
      await ctx.db.get(out.setId),
    ]);
    expect(note?.deletedAt).toBe(NOW + 4 * MIN);
    expect(set?.deletedAt).toBe(NOW + 4 * MIN);
    expect(await asA.query(api.study.getSet, { setId: out.setId })).toBeNull();
  });

  test("error: undoCreate after 5 minutes is refused and keeps everything", async () => {
    const { t, asA } = await twoUsers();
    const out = await asA.mutation(api.study.createFromPreview, {
      kind: "flashcards",
      title: "Cards",
      data: deck,
    });
    setSystemTime(new Date(NOW + UNDO_WINDOW_MS + 1));
    await expect(asA.mutation(api.study.undoCreate, { setId: out.setId })).rejects.toThrow(
      "5 minutes",
    );
    const set = await t.run((ctx) => ctx.db.get(out.setId));
    expect(set?.deletedAt).toBeUndefined();
  });

  test("error: undoCreate on another person's set is refused", async () => {
    const { asA, asB } = await twoUsers();
    const out = await asA.mutation(api.study.createFromPreview, {
      kind: "flashcards",
      title: "Cards",
      data: deck,
    });
    await expect(asB.mutation(api.study.undoCreate, { setId: out.setId })).rejects.toThrow(
      "This study set isn't available.",
    );
  });
});

describe("registerBlock", () => {
  test("happy path: registers a block already in a page, idempotently", async () => {
    const { t, a, asA } = await twoUsers();
    const blockId = newStudyBlockId(NOW);
    const noteId = await addPage(t, a, "My deck", `Notes\n\n${studyBlockFence(blockId, "flashcards", deck)}`);
    const first = await asA.mutation(api.study.registerBlock, { noteId, blockId });
    const second = await asA.mutation(api.study.registerBlock, { noteId, blockId });
    expect(second).toBe(first);
    const set = await t.run((ctx) => ctx.db.get(first));
    expect(set).toMatchObject({ kind: "flashcards", itemCount: 3, createdByTempo: false });
    expect(await asA.query(api.study.listForNote, { noteId })).toEqual([
      { setId: first, blockId, kind: "flashcards", title: "Cell biology", itemCount: 3 },
    ]);
  });

  test("error: a missing or non-study block is refused; another person's page too", async () => {
    const { t, a, asA, asB } = await twoUsers();
    const blockId = newStudyBlockId(NOW);
    const noteId = await addPage(t, a, "Plain", "Just prose.");
    await expect(asA.mutation(api.study.registerBlock, { noteId, blockId })).rejects.toThrow(
      "isn't a study block",
    );
    const withBlock = await addPage(t, a, "Deck", studyBlockFence(blockId, "flashcards", deck));
    await expect(
      asB.mutation(api.study.registerBlock, { noteId: withBlock, blockId }),
    ).rejects.toThrow("This page isn't available.");
  });
});

async function deckSet(asA: ReturnType<typeof as>) {
  return asA.mutation(api.study.createFromPreview, { kind: "flashcards", title: "Deck", data: deck });
}

describe("review, undoReview and the queue", () => {
  test("happy path: SM-2 state is saved, logged with prev, and the queue follows it", async () => {
    const { t, asA } = await twoUsers();
    const { setId } = await deckSet(asA);

    const before = await asA.query(api.study.reviewQueue, { setId });
    expect(before.cards.map((c) => c.cardId)).toEqual(["c1", "c2", "c3"]);
    expect(before.cards[1]).toMatchObject({ setTitle: "Cell biology", hint: "Starts with R", state: null });

    const r = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    expect(r.state).toMatchObject({ repetitions: 1, intervalDays: 1, dueAt: NOW + 24 * 60 * MIN });
    expect(r.undoUntil).toBe(NOW + UNDO_WINDOW_MS);
    const logged = await t.run((ctx) => ctx.db.get(r.reviewId));
    expect(logged).toMatchObject({ cardId: "c1", button: "good", reviewedAt: NOW, prev: null });

    const after = await asA.query(api.study.reviewQueue, { setId });
    expect(after.cards.map((c) => c.cardId)).toEqual(["c2", "c3"]);
    const limited = await asA.query(api.study.reviewQueue, { newLimit: 1 });
    expect(limited.cards.map((c) => c.cardId)).toEqual(["c2"]);

    // A day later c1 is due and comes before the new cards.
    setSystemTime(new Date(NOW + 24 * 60 * MIN));
    const due = await asA.query(api.study.reviewQueue, {});
    expect(due.cards.map((c) => c.cardId)).toEqual(["c1", "c2", "c3"]);
    expect(due.cards[0].state).toMatchObject({ repetitions: 1 });

    const second = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "again" });
    const log2 = await t.run((ctx) => ctx.db.get(second.reviewId));
    expect(log2?.prev).toMatchObject({ repetitions: 1, intervalDays: 1 });
    expect(second.state).toMatchObject({ repetitions: 0, lapses: 1 });

    const view = await asA.query(api.study.getSet, { setId });
    expect(Object.keys(view?.states ?? {})).toEqual(["c1"]);
    expect(view?.set.lastStudiedAt).toBe(NOW + 24 * 60 * MIN);
  });

  test("error: a card that isn't in the deck, or another person's set, is refused", async () => {
    const { asA, asB } = await twoUsers();
    const { setId } = await deckSet(asA);
    await expect(
      asA.mutation(api.study.review, { setId, cardId: "nope", button: "good" }),
    ).rejects.toThrow("isn't in the deck");
    await expect(
      asB.mutation(api.study.review, { setId, cardId: "c1", button: "good" }),
    ).rejects.toThrow("This study set isn't available.");
  });

  test("undoReview inside 5 minutes puts the card back; a new card becomes new again", async () => {
    const { t, asA } = await twoUsers();
    const { setId } = await deckSet(asA);
    const first = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    setSystemTime(new Date(NOW + MIN));
    const second = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "easy" });

    // Only the latest grade can be undone.
    await expect(asA.mutation(api.study.undoReview, { reviewId: first.reviewId })).rejects.toThrow(
      "latest grade",
    );
    const undone = await asA.mutation(api.study.undoReview, { reviewId: second.reviewId });
    expect(undone.state).toMatchObject({ repetitions: 1, intervalDays: 1, lastReviewedAt: NOW });
    const undoneFirst = await asA.mutation(api.study.undoReview, { reviewId: first.reviewId });
    expect(undoneFirst.state).toBeNull();

    const queue = await asA.query(api.study.reviewQueue, { setId });
    expect(queue.cards.map((c) => [c.cardId, c.state])).toEqual([
      ["c1", null],
      ["c2", null],
      ["c3", null],
    ]);
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW - 9 * 60 * MIN });
    expect(hub.reviewedToday).toBe(0);
    // Reviewing again after an undo revives the soft-deleted state row.
    await asA.mutation(api.study.review, { setId, cardId: "c1", button: "hard" });
    const rows = await t.run((ctx) => ctx.db.query("studyCardStates").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].deletedAt).toBeUndefined();
  });

  test("error: undoReview after 5 minutes, twice, or by someone else is refused", async () => {
    const { asA, asB } = await twoUsers();
    const { setId } = await deckSet(asA);
    const r = await asA.mutation(api.study.review, { setId, cardId: "c2", button: "good" });
    await expect(asB.mutation(api.study.undoReview, { reviewId: r.reviewId })).rejects.toThrow(
      "nothing to undo",
    );
    setSystemTime(new Date(NOW + UNDO_WINDOW_MS + 1));
    await expect(asA.mutation(api.study.undoReview, { reviewId: r.reviewId })).rejects.toThrow(
      "5 minutes",
    );
    const r2 = await asA.mutation(api.study.review, { setId, cardId: "c3", button: "good" });
    await asA.mutation(api.study.undoReview, { reviewId: r2.reviewId });
    await expect(asA.mutation(api.study.undoReview, { reviewId: r2.reviewId })).rejects.toThrow(
      "nothing to undo",
    );
  });
});

describe("recordAttempt", () => {
  test("happy path: a quiz score is saved with marks only and shows in hub and getSet", async () => {
    const { t, asA } = await twoUsers();
    const { setId } = await asA.mutation(api.study.createFromPreview, {
      kind: "quiz",
      title: "Quiz",
      data: quiz,
    });
    const out = await asA.mutation(api.study.recordAttempt, {
      setId,
      kind: "quiz",
      score: 1,
      maxScore: 1,
      answers: [{ itemId: "q1", correct: true }],
      startedAt: NOW - 2 * MIN,
    });
    expect(out).toMatchObject({ percent: 100 });
    expect(out.passed).toBeUndefined();
    const row = await t.run((ctx) => ctx.db.get(out.attemptId));
    expect(row).toMatchObject({ finishedAt: NOW, answers: [{ itemId: "q1", correct: true }] });
    const view = await asA.query(api.study.getSet, { setId });
    expect(view?.attempts).toHaveLength(1);
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW - MIN });
    expect(hub.sets[0]).toMatchObject({ kind: "quiz", lastAttempt: { percent: 100, finishedAt: NOW } });
  });

  test("a Bagrut test passes against 55 by default", async () => {
    const { asA } = await twoUsers();
    const { setId } = await asA.mutation(api.study.createFromPreview, {
      kind: "test",
      title: "Paper",
      data: bagrutTest,
    });
    const low = await asA.mutation(api.study.recordAttempt, {
      setId,
      kind: "test",
      score: 5,
      maxScore: 10,
      answers: [{ itemId: "t1", points: 5, maxPoints: 10 }],
      startedAt: NOW - MIN,
    });
    expect(low).toMatchObject({ percent: 50, passed: false });
    const high = await asA.mutation(api.study.recordAttempt, {
      setId,
      kind: "test",
      score: 6,
      maxScore: 10,
      answers: [],
      startedAt: NOW - MIN,
    });
    expect(high).toMatchObject({ percent: 60, passed: true });
  });

  test("error: a score above the max, a wrong kind or another person's set is refused", async () => {
    const { asA, asB } = await twoUsers();
    const { setId } = await asA.mutation(api.study.createFromPreview, {
      kind: "quiz",
      title: "Quiz",
      data: quiz,
    });
    const base = { setId, kind: "quiz" as const, answers: [], startedAt: NOW - MIN };
    await expect(
      asA.mutation(api.study.recordAttempt, { ...base, score: 3, maxScore: 1 }),
    ).rejects.toThrow("can't be saved");
    await expect(
      asA.mutation(api.study.recordAttempt, { ...base, kind: "test", score: 1, maxScore: 1 }),
    ).rejects.toThrow("doesn't match");
    await expect(
      asB.mutation(api.study.recordAttempt, { ...base, score: 1, maxScore: 1 }),
    ).rejects.toThrow("This study set isn't available.");
  });
});

describe("removeSet and restoreSet", () => {
  test("happy path: remove hides the set, keeps the page; restore brings it back", async () => {
    const { t, asA } = await twoUsers();
    const { setId, noteId } = await deckSet(asA);
    const removed = await asA.mutation(api.study.removeSet, { setId });
    expect(removed).toEqual({ success: true, undoUntil: NOW + UNDO_WINDOW_MS });
    expect(await asA.query(api.study.getSet, { setId })).toBeNull();
    expect((await asA.query(api.study.hub, { dayStartMs: NOW })).sets).toEqual([]);
    const note = await t.run((ctx) => ctx.db.get(noteId));
    expect(note?.deletedAt).toBeUndefined();

    expect(await asA.mutation(api.study.restoreSet, { setId })).toEqual({ success: true });
    expect((await asA.query(api.study.getSet, { setId }))?.set.setId).toBe(setId);
  });

  test("error: removing twice, or someone else's set, is refused; a live set has nothing to restore", async () => {
    const { asA, asB } = await twoUsers();
    const { setId } = await deckSet(asA);
    expect(await asA.mutation(api.study.restoreSet, { setId })).toEqual({ success: false });
    await expect(asB.mutation(api.study.removeSet, { setId })).rejects.toThrow(
      "This study set isn't available.",
    );
    await expect(asB.mutation(api.study.restoreSet, { setId })).rejects.toThrow(
      "This study set isn't available.",
    );
    await asA.mutation(api.study.removeSet, { setId });
    await expect(asA.mutation(api.study.removeSet, { setId })).rejects.toThrow(
      "This study set isn't available.",
    );
  });
});

describe("owner isolation and the page guard", () => {
  test("another person sees none of the sets, cards or pages", async () => {
    const { asA, asB } = await twoUsers();
    const { setId, noteId } = await deckSet(asA);
    await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    expect(await asB.query(api.study.getSet, { setId })).toBeNull();
    expect(await asB.query(api.study.listForNote, { noteId })).toEqual([]);
    expect((await asB.query(api.study.reviewQueue, {})).cards).toEqual([]);
    expect((await asB.query(api.study.reviewQueue, { setId })).cards).toEqual([]);
    expect(await asB.query(api.study.hub, { dayStartMs: NOW - MIN })).toEqual({
      dueCount: 0,
      newCount: 0,
      reviewedToday: 0,
      sets: [],
    });
    const hubA = await asA.query(api.study.hub, { dayStartMs: NOW - MIN });
    expect(hubA).toMatchObject({ dueCount: 0, newCount: 2, reviewedToday: 1 });
    expect(hubA.sets).toHaveLength(1);
  });

  test("signed-out callers are refused", async () => {
    const { t } = await twoUsers();
    await expect(t.query(api.study.hub, { dayStartMs: NOW })).rejects.toThrow("Not authenticated");
  });

  test("a deleted page hides its sets everywhere, and blocks writes", async () => {
    const { t, asA } = await twoUsers();
    const { setId, noteId } = await deckSet(asA);
    await t.run((ctx) => ctx.db.patch(noteId, { deletedAt: NOW }));
    expect(await asA.query(api.study.getSet, { setId })).toBeNull();
    expect(await asA.query(api.study.listForNote, { noteId })).toEqual([]);
    expect((await asA.query(api.study.hub, { dayStartMs: NOW })).sets).toEqual([]);
    expect((await asA.query(api.study.reviewQueue, {})).cards).toEqual([]);
    await expect(
      asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" }),
    ).rejects.toThrow("This page isn't available.");
  });

  test("a block removed from the page makes getSet return null", async () => {
    const { t, asA } = await twoUsers();
    const { setId, noteId } = await deckSet(asA);
    await t.run((ctx) => ctx.db.patch(noteId, { body: "The block was cut out." }));
    expect(await asA.query(api.study.getSet, { setId })).toBeNull();
  });

  test("account deletion tombstones every study row", async () => {
    const { t, a, asA } = await twoUsers();
    const { setId } = await asA.mutation(api.study.createFromPreview, {
      kind: "quiz",
      title: "Quiz",
      data: quiz,
    });
    await asA.mutation(api.study.recordAttempt, {
      setId,
      kind: "quiz",
      score: 0,
      maxScore: 1,
      answers: [],
      startedAt: NOW,
    });
    const deck2 = await deckSet(asA);
    await asA.mutation(api.study.review, { setId: deck2.setId, cardId: "c1", button: "good" });
    await t.run((ctx) => softDeleteUserAccount(ctx, a, NOW + 1));
    const live = await t.run(async (ctx) => {
      const out: number[] = [];
      for (const table of ["studySets", "studyCardStates", "studyReviews", "studyAttempts"] as const) {
        out.push((await ctx.db.query(table).collect()).filter((r) => r.deletedAt === undefined).length);
      }
      return out;
    });
    expect(live).toEqual([0, 0, 0, 0]);
  });
});

/** An action-like ctx whose runQuery runs as the signed-in person (convex-test's t.run does not). */
function actionCtx(caller: ReturnType<typeof as>) {
  return {
    runQuery: (ref: unknown, args: unknown) => caller.query(ref as never, args as never),
  } as unknown as Parameters<typeof runGenerate>[0];
}

describe("generate", () => {
  const prose =
    "Mitochondria: the organelle that makes ATP for the cell.\nRibosome: builds proteins from amino acids.\n";

  test("without a key it returns no_key, never an error", async () => {
    const { t, a, asA } = await twoUsers();
    const noteId = await addPage(t, a, "Biology", prose);
    const saved = process.env.DEEPINFRA_API_KEY;
    delete process.env.DEEPINFRA_API_KEY;
    try {
      expect(await asA.action(api.study.generate, { noteId, kind: "flashcards" })).toEqual({
        status: "unavailable",
        reason: "no_key",
      });
    } finally {
      if (saved !== undefined) process.env.DEEPINFRA_API_KEY = saved;
    }
  });

  test("a valid model answer becomes a codec-valid preview; nothing is saved", async () => {
    const { t, a, asA } = await twoUsers();
    const noteId = await addPage(t, a, "Biology", prose);
    const call = async () => ({
      tier: "balanced" as const,
      requestedTier: "balanced" as const,
      model: "stand-in",
      content: JSON.stringify({
        title: "Organelles",
        cards: [
          { id: "c1", front: "Mitochondria", back: "Makes ATP" },
          { id: "c2", front: "Ribosome", back: "Builds proteins" },
        ],
      }),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      escalated: false,
    });
    const out = await runGenerate(
      actionCtx(asA), { noteId, kind: "flashcards" }, { call, hasKey: () => true },
    );
    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.data).toMatchObject({
        title: "Organelles",
        origin: "coach",
        source: { noteId, title: "Biology" },
      });
    }
    const sets = await t.run((ctx) => ctx.db.query("studySets").collect());
    expect(sets).toEqual([]);
  });

  test("a short page, an invalid answer, or another person's page never reaches a preview", async () => {
    const { t, a, b, asA } = await twoUsers();
    const short = await addPage(t, a, "Short", "Too little.");
    const page = await addPage(t, a, "Biology", prose);
    const foreign = await addPage(t, b, "B", prose);
    let calls = 0;
    const call = async () => {
      calls += 1;
      return {
        tier: "balanced" as const,
        requestedTier: "balanced" as const,
        model: "stand-in",
        content: '{"title": "x", "cards": []}',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        escalated: false,
      };
    };
    const seams = { call, hasKey: () => true };
    expect(
      await runGenerate(actionCtx(asA), { noteId: short, kind: "flashcards" }, seams),
    ).toEqual({ status: "unavailable", reason: "too_short" });
    expect(calls).toBe(0);
    expect(
      await runGenerate(actionCtx(asA), { noteId: page, kind: "flashcards" }, seams),
    ).toEqual({ status: "unavailable", reason: "failed" });
    await expect(
      runGenerate(actionCtx(asA), { noteId: foreign, kind: "flashcards" }, seams),
    ).rejects.toThrow("This page isn't available.");
  });
});

describe("review fixes after the T3 backend review", () => {
  test("a double-tapped grade is one review: same id, SM-2 applied once", async () => {
    const { t, asA } = await twoUsers();
    const { setId } = await deckSet(asA);
    const first = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    const again = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    expect(again.reviewId).toBe(first.reviewId);
    expect(again.state).toMatchObject({ repetitions: 1, intervalDays: 1 });
    const logged = await t.run((ctx) => ctx.db.query("studyReviews").collect());
    expect(logged).toHaveLength(1);
    // Later than the double-tap window it counts as a new review.
    setSystemTime(new Date(NOW + 5_000));
    const later = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    expect(later.reviewId).not.toBe(first.reviewId);
    expect(later.state).toMatchObject({ repetitions: 2, intervalDays: 6 });
  });

  test("undo follows the review that wrote the state, even when two share a millisecond", async () => {
    const { t, asA } = await twoUsers();
    const { setId } = await deckSet(asA);
    const first = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    // Force a second review with the same timestamp past the double-tap guard.
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("studyCardStates").collect())[0];
      if (row) await ctx.db.patch(row._id, { lastReviewedAt: NOW - 10_000 });
    });
    const second = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "easy" });
    await expect(asA.mutation(api.study.undoReview, { reviewId: first.reviewId })).rejects.toThrow(
      "latest grade",
    );
    const undone = await asA.mutation(api.study.undoReview, { reviewId: second.reviewId });
    expect(undone.state).toMatchObject({ repetitions: 1 });
    const back = await asA.mutation(api.study.undoReview, { reviewId: first.reviewId });
    expect(back.state).toBeNull();
  });

  test("a source title with line breaks can't add a block; the block's source is the checked page", async () => {
    const { t, a, b, asA } = await twoUsers();
    const injected = `Notes\n\`\`\`json tempo\n${JSON.stringify({ id: "blk_01JABCDEFGHJKMNPQRSTVWXYZ9", v: 1, type: "task", data: { title: "x", durationMin: 5, status: "now", order: 0, inelastic: false } })}\n\`\`\``;
    const source = await addPage(t, a, injected, "Mitochondria make ATP.");
    const other = await addPage(t, b, "Not yours", "x");
    const out = await asA.mutation(api.study.createFromPreview, {
      kind: "flashcards",
      title: "Cell cards",
      data: { ...deck, source: { noteId: String(other), title: "Not yours" } },
      sourceNoteId: source,
    });
    const note = await t.run((ctx) => ctx.db.get(out.noteId));
    const blocks = parseTempoBlocks(note?.body ?? "").filter((seg) => seg.kind !== "markdown");
    expect(blocks.map((seg) => (seg.kind === "valid" ? seg.block.type : seg.kind))).toEqual(["flashcards"]);
    const firstLine = note?.body.split("\n")[0] ?? "";
    expect(firstLine.startsWith("Made from [[Notes ")).toBe(true);
    expect(firstLine.endsWith("]]")).toBe(true);
    const view = await asA.query(api.study.getSet, { setId: out.setId });
    const data = view?.block.data as { source?: { noteId: string } };
    expect(data.source?.noteId).toBe(String(source));

    const plain = await asA.mutation(api.study.createFromPreview, {
      kind: "flashcards",
      title: "No source",
      data: { ...deck, source: { noteId: String(other), title: "Not yours" } },
    });
    const plainView = await asA.query(api.study.getSet, { setId: plain.setId });
    expect((plainView?.block.data as { source?: unknown }).source).toBeUndefined();
  });

  test("states are read per card, so many old rows never hide a reviewed card", async () => {
    const { t, a, asA } = await twoUsers();
    const { setId } = await deckSet(asA);
    await asA.mutation(api.study.review, { setId, cardId: "c3", button: "good" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 250; i++) {
        await ctx.db.insert("studyCardStates", {
          userId: a,
          setId,
          cardId: `a${String(i).padStart(3, "0")}`,
          ease: 2.5,
          intervalDays: 0,
          repetitions: 0,
          lapses: 0,
          dueAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
          deletedAt: NOW,
        });
      }
    });
    const view = await asA.query(api.study.getSet, { setId });
    expect(Object.keys(view?.states ?? {})).toEqual(["c3"]);
    const queue = await asA.query(api.study.reviewQueue, { setId });
    expect(queue.cards.map((c) => c.cardId)).toEqual(["c1", "c2"]);
  });
});

describe("review fixes after the T3 web review", () => {
  test("Again then quickly Good on the same card are two reviews; Good is not lost", async () => {
    const { t, asA } = await twoUsers();
    const { setId } = await deckSet(asA);
    const again = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "again" });
    setSystemTime(new Date(NOW + 500));
    const good = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    expect(good.reviewId).not.toBe(again.reviewId);
    const logged = await t.run((ctx) => ctx.db.query("studyReviews").collect());
    expect(logged.map((row) => row.button)).toEqual(["again", "good"]);
    // The same button again inside the window is still one answer.
    setSystemTime(new Date(NOW + 800));
    const tap = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    expect(tap.reviewId).toBe(good.reviewId);
    // After undoing Good, a quick Good again is a new review (Again was the last button).
    await asA.mutation(api.study.undoReview, { reviewId: good.reviewId });
    setSystemTime(new Date(NOW + 900));
    const redo = await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    expect(redo.reviewId).not.toBe(good.reviewId);
    expect(redo.reviewId).not.toBe(again.reviewId);
  });

  test("the hub's new count stops at the session's 20 new cards, per set and in total", async () => {
    const { asA } = await twoUsers();
    const many = {
      ...deck,
      cards: Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, front: `Front ${i}`, back: `Back ${i}` })),
    };
    await asA.mutation(api.study.createFromPreview, { kind: "flashcards", title: "Big", data: many });
    await deckSet(asA);
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW });
    expect(hub.sets.map((s) => s.newCount).sort((x, y) => x - y)).toEqual([3, 20]);
    expect(hub.newCount).toBe(20);
    const queue = await asA.query(api.study.reviewQueue, {});
    expect(queue.cards).toHaveLength(hub.newCount);
  });
});

describe("updateBlock and undoUpdate (edit a saved set)", () => {
  /** A deck on a page with words around the block, as a person's page would have. */
  async function deckInPage(t: T, a: Id<"users">, asA: ReturnType<typeof as>) {
    const blockId = newStudyBlockId(NOW);
    const fence = studyBlockFence(blockId, "flashcards", { ...deck, source: { noteId: "n0", title: "Biology notes" } });
    const noteId = await addPage(t, a, "My deck", `Intro words\n\n${fence}\nClosing words`);
    const setId = await asA.mutation(api.study.registerBlock, { noteId, blockId });
    const view = await asA.query(api.study.getSet, { setId });
    if (!view) throw new Error("fixture");
    return { noteId, blockId, setId, version: view.blockVersion };
  }

  const edited = {
    ...deck,
    title: "Cell biology, edited",
    cards: [
      { id: "c1", front: "Mitochondria", back: "Makes ATP from glucose" },
      { id: "c3", front: "Nucleus", back: "Holds DNA" },
      { id: "n4", front: "Golgi body", back: "Packs proteins" },
    ],
  };

  test("happy path: the block is rewritten in place, kept cards keep their schedule, new cards start new", async () => {
    const { t, a, asA } = await twoUsers();
    const { noteId, blockId, setId, version } = await deckInPage(t, a, asA);
    await asA.mutation(api.study.review, { setId, cardId: "c1", button: "good" });
    await asA.mutation(api.study.review, { setId, cardId: "c2", button: "good" });
    setSystemTime(new Date(NOW + MIN));
    // The client's origin and source are ignored: they stay the block's own.
    const out = await asA.mutation(api.study.updateBlock, {
      setId,
      data: { ...edited, origin: "coach", source: { noteId: "elsewhere", title: "Not this" } },
      baseVersion: version,
    });
    expect(out).toMatchObject({ status: "saved", undoUntil: NOW + MIN + UNDO_WINDOW_MS });

    const note = await t.run((ctx) => ctx.db.get(noteId));
    expect(note?.body.startsWith("Intro words\n\n```json tempo\n")).toBe(true);
    expect(note?.body.endsWith("```\n\nClosing words")).toBe(true);
    expect(note?.updatedAt).toBe(NOW + MIN);
    const block = findStudyBlock(note?.body ?? "", blockId);
    expect(block?.type === "flashcards" && block.data).toMatchObject({
      title: "Cell biology, edited",
      origin: "outline",
      source: { noteId: "n0", title: "Biology notes" },
    });
    const set = await t.run((ctx) => ctx.db.get(setId));
    expect(set).toMatchObject({ title: "Cell biology, edited", itemCount: 3, editedAt: NOW + MIN });

    const view = await asA.query(api.study.getSet, { setId });
    expect(view?.blockVersion).toBe(out.version);
    expect(view?.blockVersion).not.toBe(version);
    expect(Object.keys(view?.states ?? {})).toEqual(["c1"]);
    expect(view?.states.c1).toMatchObject({ repetitions: 1 });
    // The removed card's state is left alone (nothing reads it); the new card is new.
    const c2 = await t.run((ctx) => ctx.db.query("studyCardStates").collect());
    expect(c2.find((row) => row.cardId === "c2")?.deletedAt).toBeUndefined();
    const queue = await asA.query(api.study.reviewQueue, { setId });
    expect(queue.cards.map((c) => [c.cardId, c.state === null])).toEqual([
      ["c3", true],
      ["n4", true],
    ]);
  });

  test("error: a base version the page has moved past writes nothing and says changed", async () => {
    const { t, a, asA } = await twoUsers();
    const { noteId, setId, version } = await deckInPage(t, a, asA);
    const first = await asA.mutation(api.study.updateBlock, {
      setId,
      data: { ...deck, title: "Changed in another tab" },
      baseVersion: version,
    });
    const before = await t.run((ctx) => ctx.db.get(noteId));
    const stale = await asA.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version });
    expect(stale).toEqual({ status: "changed", version: first.version });
    const after = await t.run((ctx) => ctx.db.get(noteId));
    expect(after?.body).toBe(before?.body);
  });

  test("a double-tapped Save writes once and reports saved both times", async () => {
    const { t, a, asA } = await twoUsers();
    const { noteId, setId, version } = await deckInPage(t, a, asA);
    const first = await asA.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version });
    setSystemTime(new Date(NOW + 300));
    const second = await asA.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version });
    expect(second).toEqual({ status: "saved", version: first.version, undoUntil: NOW + UNDO_WINDOW_MS });
    const note = await t.run((ctx) => ctx.db.get(noteId));
    expect(note?.updatedAt).toBe(NOW);
  });

  test("error: data the codec turns down, a block too large for the page, someone else's set", async () => {
    const { t, a, asA, asB } = await twoUsers();
    const { noteId, setId, version } = await deckInPage(t, a, asA);
    const before = await t.run((ctx) => ctx.db.get(noteId));
    await expect(
      asA.mutation(api.study.updateBlock, { setId, data: { ...deck, cards: [] }, baseVersion: version }),
    ).rejects.toThrow("can't be saved");
    await expect(
      asA.mutation(api.study.updateBlock, { setId, data: quiz, baseVersion: version }),
    ).rejects.toThrow("can't be saved");
    await expect(
      asA.mutation(api.study.updateBlock, { setId, data: "not an object", baseVersion: version }),
    ).rejects.toThrow("can't be saved");
    // 100 cards of 500 + 500 characters pass the schema but not the 64 KB block cap.
    const long = "x".repeat(500);
    const huge = { ...deck, cards: Array.from({ length: 100 }, (_, i) => ({ id: `h${i}`, front: long, back: long })) };
    await expect(
      asA.mutation(api.study.updateBlock, { setId, data: huge, baseVersion: version }),
    ).rejects.toThrow("too large");
    await expect(
      asB.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version }),
    ).rejects.toThrow("This study set isn't available.");
    const after = await t.run((ctx) => ctx.db.get(noteId));
    expect(after?.body).toBe(before?.body);
    await t.run((ctx) => ctx.db.patch(noteId, { deletedAt: NOW }));
    await expect(
      asA.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version }),
    ).rejects.toThrow("This page isn't available.");
  });

  test("a card id used again after an earlier removal starts new", async () => {
    const { t, a, asA } = await twoUsers();
    const { setId, version } = await deckInPage(t, a, asA);
    await asA.mutation(api.study.review, { setId, cardId: "c2", button: "easy" });
    const without = { ...deck, cards: deck.cards.filter((card) => card.id !== "c2") };
    const first = await asA.mutation(api.study.updateBlock, { setId, data: without, baseVersion: version });
    const reused = { ...deck, cards: [...without.cards, { id: "c2", front: "Golgi body", back: "Packs proteins" }] };
    await asA.mutation(api.study.updateBlock, { setId, data: reused, baseVersion: first.version });
    const view = await asA.query(api.study.getSet, { setId });
    expect(view?.states.c2).toBeUndefined();
    const rows = await t.run((ctx) => ctx.db.query("studyCardStates").collect());
    expect(rows.find((row) => row.cardId === "c2")?.deletedAt).toBe(NOW);
  });

  test("undoUpdate inside 5 minutes puts the block back; a removed card keeps its schedule", async () => {
    const { t, a, asA } = await twoUsers();
    const { noteId, setId, version } = await deckInPage(t, a, asA);
    const original = await t.run((ctx) => ctx.db.get(noteId));
    await asA.mutation(api.study.review, { setId, cardId: "c2", button: "good" });
    const saved = await asA.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version });
    setSystemTime(new Date(NOW + 4 * MIN));
    const undone = await asA.mutation(api.study.undoUpdate, { setId, data: deck, version: saved.version });
    expect(undone).toMatchObject({ status: "saved", version });
    const note = await t.run((ctx) => ctx.db.get(noteId));
    expect(note?.body).toBe(original?.body);
    const view = await asA.query(api.study.getSet, { setId });
    expect(view?.set).toMatchObject({ title: "Cell biology", itemCount: 3 });
    expect(view?.states.c2).toMatchObject({ repetitions: 1 });
    // A second tap of Undo is the same undo.
    expect(await asA.mutation(api.study.undoUpdate, { setId, data: deck, version: saved.version })).toMatchObject({
      status: "saved",
      version,
    });
  });

  test("error: undoUpdate after 5 minutes, over newer words, with no edit, or by someone else", async () => {
    const { t, a, asA, asB } = await twoUsers();
    const { noteId, blockId, setId, version } = await deckInPage(t, a, asA);
    await expect(asA.mutation(api.study.undoUpdate, { setId, data: deck, version })).rejects.toThrow(
      "nothing to undo",
    );
    const saved = await asA.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version });
    await expect(
      asB.mutation(api.study.undoUpdate, { setId, data: deck, version: saved.version }),
    ).rejects.toThrow("This study set isn't available.");
    // The block changed again after the edit (another tab): Undo would overwrite it, so it says so.
    const later = await asA.mutation(api.study.updateBlock, {
      setId,
      data: { ...edited, title: "Edited again" },
      baseVersion: saved.version,
    });
    const refused = await asA.mutation(api.study.undoUpdate, { setId, data: deck, version: saved.version });
    expect(refused).toEqual({ status: "changed", version: later.version });
    const kept = await t.run((ctx) => ctx.db.get(noteId));
    expect(findStudyBlock(kept?.body ?? "", blockId)?.data.title).toBe("Edited again");
    setSystemTime(new Date(NOW + UNDO_WINDOW_MS + 1));
    await expect(
      asA.mutation(api.study.undoUpdate, { setId, data: edited, version: later.version }),
    ).rejects.toThrow("5 minutes");
  });

  test("the block version follows the block's words, not the rest of the page", async () => {
    const { t, a, asA } = await twoUsers();
    const { noteId, setId, version } = await deckInPage(t, a, asA);
    const note = await t.run((ctx) => ctx.db.get(noteId));
    await t.run((ctx) => ctx.db.patch(noteId, { body: `${note?.body ?? ""}\n\nA new paragraph.` }));
    expect((await asA.query(api.study.getSet, { setId }))?.blockVersion).toBe(version);
    // A save still goes through after the page grew elsewhere, and keeps the new paragraph.
    const out = await asA.mutation(api.study.updateBlock, { setId, data: edited, baseVersion: version });
    expect(out.status).toBe("saved");
    const after = await t.run((ctx) => ctx.db.get(noteId));
    expect(after?.body.endsWith("Closing words\n\nA new paragraph.")).toBe(true);
    expect(parseTempoBlocks(after?.body ?? "").filter((s) => s.kind === "valid")).toHaveLength(1);
  });
});

describe("hub and queue reads for a heavy user (whole-run review)", () => {
  /** `ctx.db` with every get and index range counted, as Convex counts them against its caps. */
  function countingCtx(db: object) {
    const counts = { gets: 0, ranges: 0 };
    const counted = new Proxy(db, {
      get(target, prop) {
        const value = Reflect.get(target, prop);
        if (typeof value !== "function") return value;
        if (prop === "get") return (...args: unknown[]) => ((counts.gets += 1), value.apply(target, args));
        if (prop === "query") return (...args: unknown[]) => ((counts.ranges += 1), value.apply(target, args));
        return value.bind(target);
      },
    });
    return { ctx: { db: counted } as unknown as Parameters<typeof liveStates>[0], counts };
  }

  const bigDeck = {
    ...deck,
    title: "Big deck",
    cards: Array.from({ length: 100 }, (_, i) => ({ id: `k${String(i).padStart(3, "0")}`, front: `F${i}`, back: `B${i}` })),
  };

  /** A set row on its own page, written straight to the tables (fixtures for many sets). */
  async function rawSet(
    t: T,
    userId: Id<"users">,
    options: { updatedAt: number; data?: object; prose?: string; pageDeleted?: boolean; noBlock?: boolean },
  ) {
    return t.run(async (ctx) => {
      const blockId = newStudyBlockId(options.updatedAt);
      const fence = studyBlockFence(blockId, "flashcards", options.data ?? deck);
      const noteId = await ctx.db.insert("notes", {
        userId,
        title: "Deck page",
        body: options.noBlock ? "The block was cut out." : `${options.prose ?? ""}${fence}`,
        pinned: false,
        periodType: "none",
        createdAt: NOW,
        updatedAt: NOW,
        ...(options.pageDeleted ? { deletedAt: NOW } : {}),
      });
      return ctx.db.insert("studySets", {
        userId,
        noteId,
        blockId,
        kind: "flashcards",
        title: "Deck",
        itemCount: 3,
        createdByTempo: false,
        createdAt: NOW,
        updatedAt: options.updatedAt,
      });
    });
  }

  /** `count` soft-deleted state rows whose card ids sort before every card in the deck. */
  async function staleStates(t: T, userId: Id<"users">, setId: Id<"studySets">, count: number) {
    await t.run(async (ctx) => {
      for (let i = 0; i < count; i++) {
        await ctx.db.insert("studyCardStates", {
          userId,
          setId,
          cardId: `a${String(i).padStart(3, "0")}`,
          ease: 2.5,
          intervalDays: 0,
          repetitions: 0,
          lapses: 0,
          dueAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
          deletedAt: NOW,
        });
      }
    });
  }

  test("a full deck's states are one index range, not one lookup per card", async () => {
    const { t, a, asA } = await twoUsers();
    const { setId } = await asA.mutation(api.study.createFromPreview, { kind: "flashcards", title: "Big", data: bigDeck });
    for (const cardId of ["k000", "k050", "k099"]) {
      await asA.mutation(api.study.review, { setId, cardId, button: "good" });
    }
    const { states, counts } = await t.run(async (ctx) => {
      const counted = countingCtx(ctx.db);
      const states = await liveStates(counted.ctx, a, setId, bigDeck.cards.map((card) => card.id));
      return { states: [...states.keys()].sort(), counts: counted.counts };
    });
    expect(states).toEqual(["k000", "k050", "k099"]);
    expect(counts).toEqual({ gets: 0, ranges: 1 });
  });

  test("sets whose page is gone or whose block no longer parses are skipped, not counted", async () => {
    const { t, a, asA } = await twoUsers();
    const live = await deckSet(asA);
    // The newest STUDY_SET_SCAN_LIMIT sets are all dead: half on removed pages, half lost their block.
    for (let i = 0; i < STUDY_SET_SCAN_LIMIT; i++) {
      await rawSet(t, a, { updatedAt: NOW + MIN + i, ...(i % 2 ? { pageDeleted: true } : { noBlock: true }) });
    }
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW });
    expect(hub.sets.map((set) => set.setId)).toEqual([live.setId]);
    expect(hub.newCount).toBe(3);
    expect("truncated" in hub).toBe(false);
    const queue = await asA.query(api.study.reviewQueue, {});
    expect(queue.cards.map((card) => card.cardId)).toEqual(["c1", "c2", "c3"]);
    expect("truncated" in queue).toBe(false);
  });

  test("past the page-bytes budget the hub and queue show the most recent sets and say so", async () => {
    const { t, a, asA } = await twoUsers();
    // Ten pages of about 984 KB each: together more than the read budget allows.
    const prose = `${"Long notes. ".repeat(82_000)}\n\n`;
    const ids: Id<"studySets">[] = [];
    for (let i = 0; i < 10; i++) ids.push(await rawSet(t, a, { updatedAt: NOW + i, prose }));
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW });
    expect(hub.truncated).toBe(true);
    expect(hub.sets.length).toBeGreaterThan(0);
    expect(hub.sets.length).toBeLessThan(10);
    const newestFirst = [...ids].reverse();
    expect(hub.sets.map((set) => set.setId)).toEqual(newestFirst.slice(0, hub.sets.length));
    const queue = await asA.query(api.study.reviewQueue, {});
    expect(queue.truncated).toBe(true);
    // One set's queue reads one page and is never cut short.
    const one = await asA.query(api.study.reviewQueue, { setId: ids[0] });
    expect(one.cards).toHaveLength(3);
    expect("truncated" in one).toBe(false);
  });

  test("a read never spends more lookups than its budget; a full state range falls back per card", async () => {
    const { t, a } = await twoUsers();
    const ids: Id<"studySets">[] = [];
    for (let i = 0; i < 3; i++) {
      const setId = await rawSet(t, a, { updatedAt: NOW + i, data: bigDeck });
      await staleStates(t, a, setId, STATE_SCAN_LIMIT);
      ids.push(setId);
    }
    // A live state past the full range: only the per-card fallback can find it.
    await t.run((ctx) =>
      ctx.db.insert("studyCardStates", {
        userId: a,
        setId: ids[2],
        cardId: "k099",
        ease: 2.5,
        intervalDays: 1,
        repetitions: 1,
        lapses: 0,
        dueAt: NOW - MIN,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    const lookups = 250;
    const read = await t.run(async (ctx) => {
      const counted = countingCtx(ctx.db);
      const out = await readStudySets(counted.ctx, a, {
        budget: { lookups, pageBytes: STUDY_READ_BUDGET.pageBytes },
      });
      return {
        truncated: out.truncated,
        setIds: out.sets.map((entry) => entry.set._id),
        firstStates: [...(out.sets[0]?.states.keys() ?? [])],
        spent: counted.counts.gets + counted.counts.ranges,
      };
    });
    expect(read.truncated).toBe(true);
    expect(read.setIds).toEqual([ids[2], ids[1]]);
    expect(read.firstStates).toEqual(["k099"]);
    expect(read.spent).toBeLessThanOrEqual(lookups);
  });
});

describe("set ids from a URL (whole-run review)", () => {
  test("a malformed or wrong-table set id reads as not available, never as an error", async () => {
    const { t, a, asA } = await twoUsers();
    const { setId, noteId } = await deckSet(asA);
    const other = await addPage(t, a, "Plain page", "Just prose.");
    for (const bad of ["not-a-set", "", "%2E%2E", String(noteId), String(other)]) {
      expect(await asA.query(api.study.getSet, { setId: bad })).toBeNull();
      expect(await asA.query(api.study.reviewQueue, { setId: bad })).toEqual({ cards: [] });
    }
    // A real id as a plain string still works, from the URL as from anywhere else.
    expect((await asA.query(api.study.getSet, { setId: String(setId) }))?.set.setId).toBe(setId);
    expect((await asA.query(api.study.reviewQueue, { setId: String(setId) })).cards).toHaveLength(3);
  });
});

describe("undoCreate always takes the set back in one click, and Bring it back returns it (HARD_RULES §1)", () => {
  test("an edit after the first seconds goes with the page and the set, and the answer says so", async () => {
    const { t, asA } = await twoUsers();
    const out = await deckSet(asA);
    setSystemTime(new Date(NOW + 2 * MIN));
    await t.run((ctx) => ctx.db.patch(out.noteId, { body: "My own words now.", updatedAt: NOW + MIN }));
    expect(await asA.mutation(api.study.undoCreate, { setId: out.setId })).toEqual({
      success: true,
      pageRemoved: true,
      removedEdits: true,
      redoUntil: NOW + 2 * MIN + UNDO_WINDOW_MS,
    });
    const [note, set] = await t.run(async (ctx) => [await ctx.db.get(out.noteId), await ctx.db.get(out.setId)]);
    expect(note?.deletedAt).toBe(NOW + 2 * MIN);
    expect(set?.deletedAt).toBe(NOW + 2 * MIN);
    expect(await asA.query(api.study.getSet, { setId: out.setId })).toBeNull();
  });

  test("a set studied since it was made is a change too", async () => {
    const { asA } = await twoUsers();
    const out = await deckSet(asA);
    setSystemTime(new Date(NOW + MIN));
    await asA.mutation(api.study.review, { setId: out.setId, cardId: "c1", button: "good" });
    expect(await asA.mutation(api.study.undoCreate, { setId: out.setId })).toMatchObject({
      success: true,
      pageRemoved: true,
      removedEdits: true,
    });
  });

  test("redoCreate brings back the set and its page as they were, with the changes, once", async () => {
    const { t, asA } = await twoUsers();
    const out = await deckSet(asA);
    setSystemTime(new Date(NOW + MIN));
    await asA.mutation(api.study.review, { setId: out.setId, cardId: "c1", button: "good" });
    await t.run((ctx) => ctx.db.patch(out.noteId, { title: "My deck", updatedAt: NOW + MIN }));
    await asA.mutation(api.study.undoCreate, { setId: out.setId });
    setSystemTime(new Date(NOW + MIN + UNDO_WINDOW_MS));
    expect(await asA.mutation(api.study.redoCreate, { setId: out.setId })).toEqual({ success: true, pageRestored: true });
    const view = await asA.query(api.study.getSet, { setId: out.setId });
    expect(view?.note).toEqual({ id: out.noteId, title: "My deck" });
    expect(Object.keys(view?.states ?? {})).toEqual(["c1"]);
    // Already back: a second tap changes nothing.
    expect(await asA.mutation(api.study.redoCreate, { setId: out.setId })).toEqual({ success: true, pageRestored: false });
  });

  test("redoCreate is refused after 5 minutes and for someone else, and leaves things as they are", async () => {
    const { t, asA, asB } = await twoUsers();
    const out = await deckSet(asA);
    await asA.mutation(api.study.undoCreate, { setId: out.setId });
    await expect(asB.mutation(api.study.redoCreate, { setId: out.setId })).rejects.toThrow(
      "This study set isn't available.",
    );
    setSystemTime(new Date(NOW + UNDO_WINDOW_MS + 1));
    await expect(asA.mutation(api.study.redoCreate, { setId: out.setId })).rejects.toThrow("5 minutes");
    const [note, set] = await t.run(async (ctx) => [await ctx.db.get(out.noteId), await ctx.db.get(out.setId)]);
    expect(note?.deletedAt).toBe(NOW);
    expect(set?.deletedAt).toBe(NOW);
  });

  test("redoCreate returns only what that Undo removed: a page deleted before it stays deleted", async () => {
    const { t, asA } = await twoUsers();
    const out = await deckSet(asA);
    await t.run((ctx) => ctx.db.patch(out.noteId, { deletedAt: NOW, updatedAt: NOW }));
    setSystemTime(new Date(NOW + MIN));
    expect(await asA.mutation(api.study.undoCreate, { setId: out.setId })).toEqual({ success: true, pageRemoved: false });
    expect(await asA.mutation(api.study.redoCreate, { setId: out.setId })).toEqual({ success: true, pageRestored: false });
    const [note, set] = await t.run(async (ctx) => [await ctx.db.get(out.noteId), await ctx.db.get(out.setId)]);
    expect(note?.deletedAt).toBe(NOW);
    expect(set?.deletedAt).toBeUndefined();
  });

  test("a write in the first seconds after making it is not an edit: Undo still takes it back", async () => {
    const { t, asA } = await twoUsers();
    const out = await deckSet(asA);
    await t.run((ctx) => ctx.db.patch(out.noteId, { updatedAt: NOW + 2_000 }));
    setSystemTime(new Date(NOW + MIN));
    expect(await asA.mutation(api.study.undoCreate, { setId: out.setId })).toEqual({ success: true, pageRemoved: true });
  });
});

describe("the hub's totals and truncated (whole-run review, more than 100 sets)", () => {
  /** A set of `kind` on its own page, written straight to the tables; `dead` puts it on a removed page. */
  async function plainSet(t: T, userId: Id<"users">, kind: "flashcards" | "quiz", updatedAt: number, dead = false) {
    return t.run(async (ctx) => {
      const blockId = newStudyBlockId(updatedAt);
      const noteId = await ctx.db.insert("notes", {
        userId,
        title: kind === "quiz" ? "Quiz page" : "Deck page",
        body: studyBlockFence(blockId, kind, kind === "quiz" ? quiz : deck),
        pinned: false,
        periodType: "none",
        createdAt: NOW,
        updatedAt: NOW,
        ...(dead ? { deletedAt: NOW } : {}),
      });
      return ctx.db.insert("studySets", {
        userId,
        noteId,
        blockId,
        kind,
        title: kind === "quiz" ? "Quiz" : "Deck",
        itemCount: kind === "quiz" ? 1 : 3,
        createdByTempo: false,
        createdAt: NOW,
        updatedAt,
      });
    });
  }

  test("due and new come from the same deck read as Review, past 100 newer quizzes", async () => {
    const { t, a, asA } = await twoUsers();
    const deckId = await plainSet(t, a, "flashcards", NOW);
    await t.run((ctx) =>
      ctx.db.insert("studyCardStates", {
        userId: a,
        setId: deckId,
        cardId: "c1",
        ease: 2.5,
        intervalDays: 1,
        repetitions: 1,
        lapses: 0,
        dueAt: NOW - MIN,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    for (let i = 1; i <= STUDY_SET_SCAN_LIMIT; i++) await plainSet(t, a, "quiz", NOW + i);
    const queue = await asA.query(api.study.reviewQueue, {});
    expect(queue.cards.map((card) => [card.cardId, card.state === null ? "new" : "due"])).toEqual([
      ["c1", "due"],
      ["c2", "new"],
      ["c3", "new"],
    ]);
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW });
    expect({ dueCount: hub.dueCount, newCount: hub.newCount }).toEqual({ dueCount: 1, newCount: 2 });
    // The list itself holds the 100 newest sets and says there is more.
    expect(hub.sets).toHaveLength(STUDY_SET_SCAN_LIMIT);
    expect(hub.truncated).toBe(true);
  });

  test("a dead set past the 100 shown is not 'more': truncated stays off", async () => {
    const { t, a, asA } = await twoUsers();
    await plainSet(t, a, "flashcards", NOW, true);
    for (let i = 1; i <= STUDY_SET_SCAN_LIMIT; i++) await plainSet(t, a, "flashcards", NOW + i);
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW });
    expect(hub.sets).toHaveLength(STUDY_SET_SCAN_LIMIT);
    expect("truncated" in hub).toBe(false);
    expect("truncated" in (await asA.query(api.study.reviewQueue, {}))).toBe(false);
    // A live one there is: the hub says it shows the most recent.
    await plainSet(t, a, "flashcards", NOW - 1);
    expect((await asA.query(api.study.hub, { dayStartMs: NOW })).truncated).toBe(true);
    expect((await asA.query(api.study.reviewQueue, {})).truncated).toBe(true);
  });

  test("the hub's second read takes what the first found, live or dead, without reading it again", async () => {
    const { t, a } = await twoUsers();
    const live = await plainSet(t, a, "flashcards", NOW + 1);
    const gone = await plainSet(t, a, "flashcards", NOW + 2, true);
    const quizId = await plainSet(t, a, "quiz", NOW + 3);
    const out = await t.run(async (ctx) => {
      const fetched: string[] = [];
      const db = new Proxy(ctx.db, {
        get(target, prop) {
          const value = Reflect.get(target, prop);
          if (prop === "get") return (id: string) => (fetched.push(id), value.call(target, id));
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const counted = { db } as unknown as Parameters<typeof readStudySets>[0];
      const meter = { lookups: 0, pageBytes: 0 };
      const decks = await readStudySets(counted, a, { kind: "flashcards", meter });
      const known = new Map([
        ...decks.sets.map((entry) => [entry.set._id, entry] as const),
        ...decks.dead.map((setId) => [setId, null] as const),
      ]);
      const first = fetched.length;
      const all = await readStudySets(counted, a, { lastAttempt: true, meter, known });
      const notes = await Promise.all([live, gone, quizId].map((id) => ctx.db.get(id)));
      return {
        dead: decks.dead,
        sets: all.sets.map((entry) => entry.set._id),
        again: fetched.slice(first).filter((id) => notes.some((set) => set?.noteId === id)),
        quizNote: notes[2]?.noteId,
      };
    });
    expect(out.dead).toEqual([gone]);
    expect(out.sets).toEqual([quizId, live]);
    // Only the quiz's page is read the second time.
    expect(out.again).toEqual([out.quizNote]);
  });

  test("exactly the rows looked at, all read, is not 'more'; one row past them is", async () => {
    const { t, a, asA } = await twoUsers();
    await plainSet(t, a, "flashcards", NOW + STUDY_SET_ROW_LIMIT);
    for (let i = 1; i < STUDY_SET_ROW_LIMIT; i++) await plainSet(t, a, "flashcards", NOW + i, true);
    const hub = await asA.query(api.study.hub, { dayStartMs: NOW });
    expect(hub.sets).toHaveLength(1);
    expect("truncated" in hub).toBe(false);
    expect("truncated" in (await asA.query(api.study.reviewQueue, {}))).toBe(false);
    await plainSet(t, a, "flashcards", NOW);
    expect((await asA.query(api.study.hub, { dayStartMs: NOW })).truncated).toBe(true);
  });
});
