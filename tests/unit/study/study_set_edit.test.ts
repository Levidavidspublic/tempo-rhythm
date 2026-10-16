/**
 * Editing a saved set (/study/[setId]), the pure parts: the edit flow (open, save, refused because
 * the page's block moved on, reload), what counts as nothing to save, and new ids that never take
 * a removed card's id (its schedule). All sample data is fictional.
 */
import { describe, expect, test } from "bun:test";
import { flashcardsDataSchema, type QuizData, type TestData } from "@tempo/utils";
import { type Draft, draftFrom, draftReducer, draftToData } from "../../../apps/web/components/study/preview";
import {
  blockPreview,
  canSave,
  closedEdit,
  draftUnchanged,
  isStale,
  type SetEditState,
  setEditReducer,
} from "../../../apps/web/components/study/set-edit";

const apply = (draft: Draft, ...actions: Parameters<typeof draftReducer>[1][]) => actions.reduce(draftReducer, draft);

const deck = {
  title: "Cell biology",
  origin: "outline" as const,
  cards: [
    { id: "n1", front: "Mitosis", back: "Two identical cells" },
    { id: "n2", front: "Osmosis", back: "Water across a membrane" },
    { id: "n3", front: "Enzyme", back: "Speeds up a reaction" },
  ],
};
const deckBlock = { id: "blk_1", type: "flashcards" as const, data: deck };

const quiz: QuizData = {
  title: "Photosynthesis check",
  mode: "fixed",
  origin: "coach",
  questions: [
    {
      id: "q1",
      prompt: "Where does photosynthesis happen?",
      choices: [
        { id: "a", text: "In the chloroplasts" },
        { id: "b", text: "In the nucleus" },
      ],
      answerId: "a",
      explanation: "Chloroplasts hold the chlorophyll.",
      difficulty: 1,
    },
  ],
};

const test_: TestData = {
  title: "Practice paper",
  style: "bagrut",
  origin: "user",
  sections: [
    {
      id: "s1",
      title: "Part A",
      instructions: "Choose one answer.",
      questions: [
        {
          plugin: "mcq",
          id: "m1",
          prompt: "Which organelle makes energy?",
          points: 10,
          choices: [
            { id: "a", text: "The mitochondrion" },
            { id: "b", text: "The ribosome" },
          ],
          answerId: "a",
        },
        { plugin: "short", id: "t1", prompt: "Name the process.", points: 1, accepted: ["photosynthesis", "photo-synthesis"] },
      ],
    },
    {
      id: "s2",
      title: "Part B",
      pick: 1,
      questions: [
        {
          plugin: "bagrut",
          id: "b1",
          stem: "A plant is kept in the dark.",
          parts: [{ id: "p1", label: "a", prompt: "What happens to its starch?", points: 15, modelAnswer: "It goes down." }],
        },
        {
          plugin: "bagrut",
          id: "b2",
          stem: "A leaf is tested with iodine.",
          parts: [{ id: "p2", label: "a", prompt: "What colour shows starch?", points: 5 }],
        },
      ],
    },
  ],
};

describe("the edit flow", () => {
  const open = setEditReducer(closedEdit, { type: "open", version: "v1" });

  test("open → save → saved closes the edit list", () => {
    expect(open).toEqual({ phase: "editing", baseVersion: "v1", error: null });
    const saving = setEditReducer(open, { type: "save" });
    expect(saving.phase).toBe("saving");
    expect(setEditReducer(saving, { type: "saved" })).toEqual(closedEdit);
  });
  test("a save that didn't go through keeps the edits and says why", () => {
    const saving = setEditReducer(open, { type: "save" });
    expect(setEditReducer(saving, { type: "saveError" })).toEqual({ phase: "editing", baseVersion: "v1", error: "save" });
    expect(setEditReducer(saving, { type: "changed" })).toEqual({ phase: "editing", baseVersion: "v1", error: "changed" });
  });
  test("Reload starts again from the newest version; Cancel closes", () => {
    const changed: SetEditState = { phase: "editing", baseVersion: "v1", error: "changed" };
    expect(setEditReducer(changed, { type: "reload", version: "v2" })).toEqual({ phase: "editing", baseVersion: "v2", error: null });
    expect(setEditReducer(open, { type: "cancel" })).toEqual(closedEdit);
  });
  test("steps out of order change nothing (no double save, no cancel mid-save)", () => {
    const saving = setEditReducer(open, { type: "save" });
    expect(setEditReducer(saving, { type: "save" })).toBe(saving);
    expect(setEditReducer(saving, { type: "cancel" })).toBe(saving);
    expect(setEditReducer(open, { type: "open", version: "v9" })).toBe(open);
    expect(setEditReducer(closedEdit, { type: "saved" })).toBe(closedEdit);
  });
  test("stale when the server said changed or the live version moved on, never while saving", () => {
    expect(isStale(open, "v1")).toBe(false);
    expect(isStale(open, "v2")).toBe(true);
    expect(isStale({ ...open, error: "changed" }, "v1")).toBe(true);
    expect(isStale(setEditReducer(open, { type: "save" }), "v2")).toBe(false);
    expect(isStale(closedEdit, "v2")).toBe(false);
  });
  test("Save needs the edit list, a fresh base and data the codec accepts", () => {
    const draft = draftFrom(blockPreview(deckBlock));
    expect(canSave(open, draft, "v1")).toBe(true);
    expect(canSave(open, draft, "v2")).toBe(false);
    expect(canSave(closedEdit, draft, "v1")).toBe(false);
    expect(canSave(open, apply(draft, { type: "title", value: " " }), "v1")).toBe(false);
  });
});

describe("the edit list on a saved set", () => {
  test("a block becomes the preview the edit list starts from, for each kind", () => {
    expect(blockPreview(deckBlock)).toEqual({ kind: "flashcards", data: deck });
    expect(blockPreview({ id: "b", type: "quiz", data: quiz }).kind).toBe("quiz");
    expect(blockPreview({ id: "b", type: "test", data: test_ }).kind).toBe("test");
  });
  test("nothing to save until something changes, and again once it's changed back", () => {
    const draft = draftFrom(blockPreview(deckBlock));
    expect(draftUnchanged(draft)).toBe(true);
    const changed = apply(draft, { type: "change", id: "n1", field: "secondary", value: "Two of the same cell" });
    expect(draftUnchanged(changed)).toBe(false);
    expect(draftUnchanged(apply(changed, { type: "change", id: "n1", field: "secondary", value: "Two identical cells" }))).toBe(true);
  });
  test("a new card never takes a removed card's id (its schedule is keyed by the id)", () => {
    const draft = apply(draftFrom(blockPreview(deckBlock)), { type: "remove", id: "n3" }, { type: "add" });
    const added = draft.items.at(-1)?.id as string;
    expect(["n1", "n2", "n3"]).not.toContain(added);
    const filled = apply(draft, { type: "change", id: added, field: "primary", value: "Ribosome" }, { type: "change", id: added, field: "secondary", value: "Makes proteins" });
    const out = draftToData(filled);
    expect(out?.kind === "flashcards" && out.data.cards.map((card) => card.id)).toEqual(["n1", "n2", added]);
    expect(out && flashcardsDataSchema.safeParse(out.data).success).toBe(true);
  });
  test("kept cards keep their ids when their words change", () => {
    const out = draftToData(apply(draftFrom(blockPreview(deckBlock)), { type: "change", id: "n2", field: "primary", value: "Osmosis (water)" }));
    expect(out?.kind === "flashcards" && out.data.cards[1]).toEqual({ id: "n2", front: "Osmosis (water)", back: "Water across a membrane" });
  });
});
