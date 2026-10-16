import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { softDeleteUserAccount } from "./lib/accountDeletion";
import { UNDO_WINDOW_MS } from "./lib/softDelete";
import { parseTempoBlocks } from "./lib/blocks";
import { findStudyBlock, newStudyBlockId, studyBlockFence } from "./lib/study";
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
