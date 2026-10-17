/**
 * Kitchen T3, S25 "Turn into" preview: the outline reader's preview, the editable list (change,
 * add, remove) read back as codec-valid data, and the Accept / Edit / Reject flow. Nothing in
 * this flow saves until Accept: `canAccept` is the only gate the screen calls the mutation through.
 */
import { describe, expect, test } from "bun:test";
import { flashcardsDataSchema, quizDataSchema, testDataSchema } from "@tempo/utils";
import {
  canAccept,
  type Draft,
  draftFrom,
  draftProblems,
  draftReducer,
  draftToData,
  initialProposal,
  isStudyKind,
  outlinePreview,
  previewCount,
  type ProposalState,
  proposalReducer,
  reasonKey,
  toPreview,
} from "../../../apps/web/components/study/preview";

const PAGE = `# Cell biology

Mitosis: cell division that makes two identical cells
Osmosis: water moving across a membrane
Diffusion: particles spreading from high to low concentration
Enzyme: a protein that speeds up a reaction

## Steps of mitosis

1. Prophase
2. Metaphase
3. Anaphase
4. Telophase
`;

const apply = (draft: Draft, ...actions: Parameters<typeof draftReducer>[1][]) => actions.reduce(draftReducer, draft);

describe("outline reader preview", () => {
  test("each kind reads the page into codec-valid data", () => {
    const cards = outlinePreview("flashcards", PAGE, "Cell biology");
    const quiz = outlinePreview("quiz", PAGE, "Cell biology");
    const test = outlinePreview("test", PAGE, "Cell biology");
    expect(cards && flashcardsDataSchema.safeParse(cards.data).success).toBe(true);
    expect(quiz && quizDataSchema.safeParse(quiz.data).success).toBe(true);
    expect(test && testDataSchema.safeParse(test.data).success).toBe(true);
    expect(cards ? previewCount(cards) : 0).toBeGreaterThanOrEqual(4);
  });
  test("a page without structure has no outline preview (the coach can try)", () => {
    expect(outlinePreview("flashcards", "Just a sentence.", "Note")).toBeNull();
  });
  test("a model reply of the wrong shape is not a preview", () => {
    expect(toPreview("flashcards", { title: "x", cards: [] })).toBeNull();
    expect(isStudyKind("quiz")).toBe(true);
    expect(isStudyKind("essay")).toBe(false);
  });
  test("every reason the coach can't help has its own kind words", () => {
    expect(reasonKey("no_key")).toBe("st.pv.reason.no_key");
    expect(reasonKey("too_short")).toBe("st.pv.reason.too_short");
    expect(reasonKey("busy")).toBe("st.pv.reason.busy");
  });
});

describe("edit: change, add, remove", () => {
  const preview = outlinePreview("flashcards", PAGE, "Cell biology");
  if (!preview) throw new Error("fixture");
  const draft = draftFrom(preview);

  test("changing a card's back and the title shows up in the saved data", () => {
    const first = draft.items[0]?.id as string;
    const out = draftToData(
      apply(draft, { type: "title", value: "Biology, unit 2" }, { type: "change", id: first, field: "secondary", value: "Splitting into two cells" }),
    );
    expect(out?.kind).toBe("flashcards");
    if (out?.kind !== "flashcards") return;
    expect(out.data.title).toBe("Biology, unit 2");
    expect(out.data.cards[0]?.back).toBe("Splitting into two cells");
  });
  test("an added card needs words on both lines before Accept", () => {
    const added = apply(draft, { type: "add" });
    expect(added.items).toHaveLength(draft.items.length + 1);
    expect(draftProblems(added)).toContain("st.ed.invalid");
    expect(draftToData(added)).toBeNull();
    const id = added.items.at(-1)?.id as string;
    const filled = apply(added, { type: "change", id, field: "primary", value: "Ribosome" }, { type: "change", id, field: "secondary", value: "Makes proteins" });
    const out = draftToData(filled);
    expect(out?.kind === "flashcards" && out.data.cards.at(-1)).toEqual({ id, front: "Ribosome", back: "Makes proteins" });
    // Fresh ids never collide with existing ones.
    expect(new Set(filled.items.map((i) => i.id)).size).toBe(filled.items.length);
  });
  test("removing every item leaves nothing to save", () => {
    const empty = draft.items.reduce((d, item) => draftReducer(d, { type: "remove", id: item.id }), draft);
    expect(draftProblems(empty)).toContain("st.ed.needOne");
    expect(canAccept(initialProposal, empty)).toBe(false);
  });
  test("a blank title can't be saved", () => {
    expect(draftProblems(apply(draft, { type: "title", value: "  " }))).toContain("st.ed.titleInvalid");
  });

  test("quiz: a new question gets choices from the other answers", () => {
    const quiz = outlinePreview("quiz", PAGE, "Cell biology");
    if (!quiz) throw new Error("fixture");
    const d = apply(draftFrom(quiz), { type: "add" });
    const id = d.items.at(-1)?.id as string;
    const out = draftToData(apply(d, { type: "change", id, field: "primary", value: "What builds proteins?" }, { type: "change", id, field: "secondary", value: "Ribosome" }));
    expect(out?.kind).toBe("quiz");
    if (out?.kind !== "quiz") return;
    const q = out.data.questions.at(-1);
    expect(q?.choices.length).toBeGreaterThanOrEqual(2);
    expect(q?.choices.find((c) => c.id === q.answerId)?.text).toBe("Ribosome");
    expect(quizDataSchema.safeParse(out.data).success).toBe(true);
  });
  test("quiz: changing the right answer keeps the other choices", () => {
    const quiz = outlinePreview("quiz", PAGE, "Cell biology");
    if (quiz?.kind !== "quiz") throw new Error("fixture");
    const q0 = quiz.data.questions[0];
    if (!q0) throw new Error("fixture");
    const out = draftToData(apply(draftFrom(quiz), { type: "change", id: q0.id, field: "secondary", value: "A new answer" }));
    if (out?.kind !== "quiz") throw new Error("expected a quiz");
    const q = out.data.questions[0];
    expect(q?.choices.length).toBe(q0.choices.length);
    expect(q?.choices.find((c) => c.id === q.answerId)?.text).toBe("A new answer");
  });
  test("test: an added question joins as a short answer; a removed one leaves", () => {
    const practice = outlinePreview("test", PAGE, "Cell biology");
    if (practice?.kind !== "test") throw new Error("fixture");
    const d0 = draftFrom(practice);
    const gone = d0.items[0]?.id as string;
    const d = apply(d0, { type: "remove", id: gone }, { type: "add" });
    const id = d.items.at(-1)?.id as string;
    const out = draftToData(apply(d, { type: "change", id, field: "primary", value: "Name the organelle that makes energy" }, { type: "change", id, field: "secondary", value: "Mitochondrion" }));
    if (out?.kind !== "test") throw new Error("expected a test");
    const all = out.data.sections.flatMap((s) => s.questions);
    expect(all.some((q) => q.id === gone)).toBe(false);
    expect(all.at(-1)).toEqual({ plugin: "short", id, prompt: "Name the organelle that makes energy", points: 1, accepted: ["Mitochondrion"] });
    expect(testDataSchema.safeParse(out.data).success).toBe(true);
  });
});

describe("Accept / Edit / Reject", () => {
  const preview = outlinePreview("flashcards", PAGE, "Cell biology");
  if (!preview) throw new Error("fixture");
  const draft = draftFrom(preview);
  const run = (...actions: Parameters<typeof proposalReducer>[1][]): ProposalState => actions.reduce(proposalReducer, initialProposal);
  const created = { noteId: "n9", setId: "s9", undoUntil: 300_000 };

  test("Accept saves from the preview, and only once", () => {
    expect(canAccept(initialProposal, draft)).toBe(true);
    const saving = run({ type: "accept" });
    expect(saving.phase).toBe("saving");
    expect(canAccept(saving, draft)).toBe(false);
    expect(proposalReducer(saving, { type: "accept" })).toBe(saving);
    const done = proposalReducer(saving, { type: "saved", created });
    expect(done.phase).toBe("accepted");
    expect(done.created).toEqual(created);
    expect(canAccept(done, draft)).toBe(false);
  });
  test("Edit opens the list and Accept works from there too", () => {
    const editing = run({ type: "edit" });
    expect(editing.phase).toBe("editing");
    expect(canAccept(editing, draft)).toBe(true);
    expect(run({ type: "edit" }, { type: "doneEditing" }).phase).toBe("preview");
  });
  test("Reject saves nothing; the preview can come back", () => {
    const rejected = run({ type: "reject" });
    expect(rejected.phase).toBe("rejected");
    expect(rejected.created).toBeNull();
    expect(canAccept(rejected, draft)).toBe(false);
    expect(proposalReducer(rejected, { type: "reopen" }).phase).toBe("preview");
  });
  test("a save that doesn't go through keeps the preview and says so", () => {
    const state = run({ type: "accept" }, { type: "saveError" });
    expect(state.phase).toBe("preview");
    expect(state.error).toBe("save");
  });
  test("Undo after Accept goes back to the preview with nothing saved", () => {
    const state = run({ type: "accept" }, { type: "saved", created }, { type: "undone" });
    expect(state.phase).toBe("preview");
    expect(state.undone).toBe(true);
    expect(state.created).toBeNull();
  });
  test("Undo on a page changed since keeps the set accepted and says so", () => {
    const state = run({ type: "accept" }, { type: "saved", created }, { type: "kept" });
    expect(state.phase).toBe("accepted");
    expect(state.kept).toBe(true);
    expect(state.undone).toBe(false);
    expect(state.created).toEqual(created);
    // Only an accepted set can be kept; a fresh preview ignores it.
    expect(proposalReducer(initialProposal, { type: "kept" })).toBe(initialProposal);
  });
});

describe("edit limits the codec sets", () => {
  const fullSection = {
    title: "Long test",
    style: "standard" as const,
    origin: "user" as const,
    sections: [
      {
        id: "sec1",
        title: "Part 1",
        questions: Array.from({ length: 20 }, (_, i) => ({ plugin: "short" as const, id: `q${i}`, prompt: `Question ${i}`, points: 1, accepted: [`Answer ${i}`] })),
      },
    ],
  };

  test("test: Add stops at 20 questions in a section, and Accept says why instead of going quiet", () => {
    const practice = toPreview("test", fullSection);
    if (practice?.kind !== "test") throw new Error("fixture");
    const d0 = draftFrom(practice);
    expect(draftProblems(d0)).toEqual([]);
    const added = apply(d0, { type: "add" });
    expect(added.items).toHaveLength(20);
    // After removing one there is room for exactly one more.
    const d1 = apply(d0, { type: "remove", id: "q0" }, { type: "add" });
    expect(d1.items).toHaveLength(20);
    expect(apply(d1, { type: "add" }).items).toHaveLength(20);
    // A draft that already holds too many (e.g. built before the cap) names the problem.
    const over: Draft = { ...d0, items: [...d0.items, { id: "n99", primary: "Extra", secondary: "Yes" }] };
    expect(draftProblems(over)).toContain("st.ed.sectionFull");
    expect(draftToData(over)).toBeNull();
    expect(canAccept(initialProposal, over)).toBe(false);
  });

  test("quiz: a right answer edited to match another choice is flagged", () => {
    const quiz = outlinePreview("quiz", PAGE, "Cell biology");
    if (quiz?.kind !== "quiz") throw new Error("fixture");
    const q0 = quiz.data.questions[0];
    const other = q0?.choices.find((c) => c.id !== q0.answerId);
    if (!q0 || !other) throw new Error("fixture");
    const dup = apply(draftFrom(quiz), { type: "change", id: q0.id, field: "secondary", value: ` ${other.text.toUpperCase()} ` });
    expect(draftProblems(dup)).toContain("st.ed.sameChoice");
    expect(draftToData(dup)).toBeNull();
    expect(draftProblems(draftFrom(quiz))).not.toContain("st.ed.sameChoice");
  });
});
