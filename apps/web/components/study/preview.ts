import {
  type FlashcardsData,
  flashcardsDataSchema,
  type QuizData,
  type QuizQuestion,
  quizDataSchema,
  type StudyBlockType,
  type TestData,
  type TestQuestion,
  type TestSection,
  testDataSchema,
} from "@tempo/utils";
import type { MessageKey } from "@/lib/i18n";
import {
  outlineToFlashcards,
  outlineToQuiz,
  outlineToTest,
} from "../../../../packages/core/srs/extract";

/**
 * S25 "Turn into" preview, the pure part: build a preview with the outline reader, turn it into an
 * editable list (change, add, remove), read it back as codec-valid data, and the Accept / Edit /
 * Reject flow. Nothing here saves: the screen calls `study.createFromPreview` only on Accept.
 */

export type StudyPreview =
  | { kind: "flashcards"; data: FlashcardsData }
  | { kind: "quiz"; data: QuizData }
  | { kind: "test"; data: TestData };

export type StudyData = StudyPreview["data"];

export const STUDY_KINDS: readonly StudyBlockType[] = ["flashcards", "quiz", "test"];

export function isStudyKind(value: unknown): value is StudyBlockType {
  return (STUDY_KINDS as readonly unknown[]).includes(value);
}

/** Pair a kind with data the codec accepts for it, or null (e.g. a model reply of the wrong shape). */
export function toPreview(kind: StudyBlockType, data: unknown): StudyPreview | null {
  if (kind === "flashcards") {
    const parsed = flashcardsDataSchema.safeParse(data);
    return parsed.success ? { kind, data: parsed.data } : null;
  }
  if (kind === "quiz") {
    const parsed = quizDataSchema.safeParse(data);
    return parsed.success ? { kind, data: parsed.data } : null;
  }
  const parsed = testDataSchema.safeParse(data);
  return parsed.success ? { kind, data: parsed.data } : null;
}

/** The offline outline reader's preview of a page, or null when the page has too little structure. */
export function outlinePreview(
  kind: StudyBlockType,
  markdown: string,
  title: string
): StudyPreview | null {
  if (kind === "flashcards") {
    const data = outlineToFlashcards(markdown, { title });
    return data ? { kind, data } : null;
  }
  if (kind === "quiz") {
    const data = outlineToQuiz(markdown, { title });
    return data ? { kind, data } : null;
  }
  const data = outlineToTest(markdown, { title });
  return data ? { kind, data } : null;
}

/** How many cards or questions a preview holds. */
export function previewCount(preview: StudyPreview): number {
  if (preview.kind === "flashcards") return preview.data.cards.length;
  if (preview.kind === "quiz") return preview.data.questions.length;
  return preview.data.sections.reduce((sum, section) => sum + section.questions.length, 0);
}

// ---------------------------------------------------------------------------------------------
// The editable list

/**
 * One row of the editable list: two lines of text. Flashcards: front / back. Quiz: question /
 * right answer. Test: question / right answer (multiple choice), accepted answer (short), or the
 * stem of a written Bagrut question, whose parts aren't edited here (`secondary` null).
 */
export type DraftItem = {
  id: string;
  primary: string;
  secondary: string | null;
};

export type Draft = {
  preview: StudyPreview;
  title: string;
  items: DraftItem[];
};

export type DraftAction =
  | { type: "title"; value: string }
  | { type: "change"; id: string; field: "primary" | "secondary"; value: string }
  | { type: "add" }
  | { type: "remove"; id: string };

const MAX_TEXT = 500;
const MAX_TITLE = 200;
const MAX_ITEMS = 100;
const MAX_SHORT = 200;
/** The codec's limits on a practice test: questions per section and sections per test. */
export const MAX_SECTION_QUESTIONS = 20;
export const MAX_SECTIONS = 10;

function answerText(question: {
  choices: { id: string; text: string }[];
  answerId: string;
}): string {
  return question.choices.find((choice) => choice.id === question.answerId)?.text ?? "";
}

function testItem(question: TestQuestion): DraftItem {
  if (question.plugin === "mcq")
    return { id: question.id, primary: question.prompt, secondary: answerText(question) };
  if (question.plugin === "short")
    return { id: question.id, primary: question.prompt, secondary: question.accepted[0] ?? "" };
  return { id: question.id, primary: question.stem, secondary: null };
}

export function draftFrom(preview: StudyPreview): Draft {
  const items: DraftItem[] =
    preview.kind === "flashcards"
      ? preview.data.cards.map((card) => ({
          id: card.id,
          primary: card.front,
          secondary: card.back,
        }))
      : preview.kind === "quiz"
        ? preview.data.questions.map((q) => ({
            id: q.id,
            primary: q.prompt,
            secondary: answerText(q),
          }))
        : preview.data.sections.flatMap((section) => section.questions.map(testItem));
  return { preview, title: preview.data.title, items };
}

/** A fresh item id that no item (and no section) in the draft uses yet. */
function freshId(draft: Draft): string {
  const taken = new Set(draft.items.map((item) => item.id));
  if (draft.preview.kind === "test")
    for (const section of draft.preview.data.sections) taken.add(section.id);
  let n = draft.items.length + 1;
  while (taken.has(`n${n}`)) n += 1;
  return `n${n}`;
}

export function draftReducer(draft: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case "title":
      return { ...draft, title: action.value };
    case "change":
      return {
        ...draft,
        items: draft.items.map((item) =>
          item.id !== action.id || (action.field === "secondary" && item.secondary === null)
            ? item
            : { ...item, [action.field]: action.value }
        ),
      };
    case "add":
      if (draft.items.length >= MAX_ITEMS) return draft;
      if (draft.preview.kind === "test" && !testHasRoom(draft, draft.preview.data)) return draft;
      return {
        ...draft,
        items: [...draft.items, { id: freshId(draft), primary: "", secondary: "" }],
      };
    case "remove":
      return { ...draft, items: draft.items.filter((item) => item.id !== action.id) };
  }
}

const fits = (text: string, max = MAX_TEXT) => {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= max;
};

const sameText = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

const CHOICE_IDS = ["a", "b", "c", "d"];

/** Choices for a new quiz question: its answer plus up to 3 other answers, the answer rotated in. */
function choicesFor(
  answer: string,
  pool: readonly string[],
  index: number
): { choices: { id: string; text: string }[]; answerId: string } {
  const others: string[] = [];
  for (const text of pool) {
    if (others.length === 3) break;
    if (!sameText(text, answer) && !others.some((other) => sameText(other, text)))
      others.push(text.trim());
  }
  const texts = [...others];
  const at = texts.length === 0 ? 0 : index % (texts.length + 1);
  texts.splice(at, 0, answer.trim());
  const choices = texts.map((text, i) => ({ id: CHOICE_IDS[i] as string, text }));
  return { choices, answerId: CHOICE_IDS[at] as string };
}

function withAnswer<Q extends { choices: { id: string; text: string }[]; answerId: string }>(
  question: Q,
  answer: string
): Q {
  return {
    ...question,
    choices: question.choices.map((choice) =>
      choice.id === question.answerId ? { ...choice, text: answer.trim() } : choice
    ),
  };
}

function quizData(draft: Draft, base: QuizData): QuizData | null {
  const pool = draft.items.map((item) => item.secondary ?? "");
  const questions: QuizQuestion[] = [];
  for (const [index, item] of draft.items.entries()) {
    const answer = item.secondary ?? "";
    const old = base.questions.find((q) => q.id === item.id);
    if (old) {
      questions.push({ ...withAnswer(old, answer), prompt: item.primary.trim() });
      continue;
    }
    const { choices, answerId } = choicesFor(answer, pool, index);
    if (choices.length < 2) return null;
    questions.push({ id: item.id, prompt: item.primary.trim(), choices, answerId, difficulty: 1 });
  }
  return { ...base, title: draft.title.trim(), questions };
}

function testQuestion(item: DraftItem, old: TestQuestion | undefined): TestQuestion {
  if (!old) {
    return {
      plugin: "short",
      id: item.id,
      prompt: item.primary.trim(),
      points: 1,
      accepted: [(item.secondary ?? "").trim()],
    };
  }
  if (old.plugin === "mcq")
    return { ...withAnswer(old, item.secondary ?? ""), prompt: item.primary.trim() };
  if (old.plugin === "short") {
    const first = (item.secondary ?? "").trim();
    const rest = old.accepted.slice(1).filter((text) => !sameText(text, first));
    return { ...old, prompt: item.primary.trim(), accepted: [first, ...rest].slice(0, 10) };
  }
  return { ...old, stem: item.primary.trim() };
}

/** How many questions each base section holds once the draft is read back (new ones not placed). */
function keptPerSection(draft: Draft, base: TestData): number[] {
  const ids = new Set(draft.items.map((item) => item.id));
  return base.sections.map((section) => section.questions.filter((q) => ids.has(q.id)).length);
}

/** The section new questions join: the last one that still has questions (or the last one). */
function targetSection(counts: number[]): number {
  for (let i = counts.length - 1; i >= 0; i -= 1) if ((counts[i] ?? 0) > 0) return i;
  return counts.length - 1;
}

function newTestItems(draft: Draft, base: TestData): number {
  const known = new Set(base.sections.flatMap((section) => section.questions.map((q) => q.id)));
  return draft.items.filter((item) => !known.has(item.id)).length;
}

/** Whether the section new questions join would still fit the codec's 20 questions. */
function testFits(draft: Draft, base: TestData, extra = 0): boolean {
  if (base.sections.length > MAX_SECTIONS) return false;
  const counts = keptPerSection(draft, base);
  const at = targetSection(counts);
  const added = newTestItems(draft, base) + extra;
  if (added === 0) return counts.every((n) => n <= MAX_SECTION_QUESTIONS);
  return at >= 0 && (counts[at] ?? 0) + added <= MAX_SECTION_QUESTIONS;
}

function testHasRoom(draft: Draft, base: TestData): boolean {
  return testFits(draft, base, 1);
}

function testData(draft: Draft, base: TestData): TestData | null {
  const byId = new Map(draft.items.map((item) => [item.id, item]));
  const known = new Set(base.sections.flatMap((section) => section.questions.map((q) => q.id)));
  const added = draft.items
    .filter((item) => !known.has(item.id))
    .map((item) => testQuestion(item, undefined));
  const sections: TestSection[] = [];
  for (const section of base.sections) {
    const questions = section.questions.flatMap((q) => {
      const item = byId.get(q.id);
      return item ? [testQuestion(item, q)] : [];
    });
    sections.push({ ...section, questions });
  }
  // New questions join the last section that still has questions (or the last section).
  if (added.length > 0) {
    const target = sections[targetSection(sections.map((section) => section.questions.length))];
    if (!target) return null;
    target.questions = [...target.questions, ...added];
  }
  const kept = sections
    .filter((section) => section.questions.length > 0)
    .map((section) => {
      if (section.pick === undefined || section.pick <= section.questions.length) return section;
      const { pick: _pick, ...rest } = section;
      return rest;
    });
  return { ...base, title: draft.title.trim(), sections: kept };
}

/** The draft as data the codec accepts, or null while something needs fixing. */
export function draftToData(draft: Draft): StudyPreview | null {
  if (draftProblems(draft).length > 0) return null;
  return buildData(draft);
}

function buildData(draft: Draft): StudyPreview | null {
  const { preview } = draft;
  if (preview.kind === "flashcards") {
    const cards = draft.items.map((item) => {
      const old = preview.data.cards.find((card) => card.id === item.id);
      return {
        ...(old ?? {}),
        id: item.id,
        front: item.primary.trim(),
        back: (item.secondary ?? "").trim(),
      };
    });
    return toPreview("flashcards", { ...preview.data, title: draft.title.trim(), cards });
  }
  if (preview.kind === "quiz") {
    const data = quizData(draft, preview.data);
    return data ? toPreview("quiz", data) : null;
  }
  const data = testData(draft, preview.data);
  return data ? toPreview("test", data) : null;
}

/** What still needs fixing before Accept, as message keys (empty when it can be saved). */
export function draftProblems(draft: Draft): MessageKey[] {
  const problems: MessageKey[] = [];
  if (!fits(draft.title, MAX_TITLE)) problems.push("st.ed.titleInvalid");
  if (draft.items.length === 0) problems.push("st.ed.needOne");
  const isNewTestItem = (item: DraftItem) =>
    draft.preview.kind === "test" &&
    !draft.preview.data.sections.some((section) => section.questions.some((q) => q.id === item.id));
  const textOk = draft.items.every(
    (item) =>
      fits(item.primary) &&
      (item.secondary === null ||
        fits(
          item.secondary,
          isNewTestItem(item) || shortItem(draft, item.id) ? MAX_SHORT : MAX_TEXT
        ))
  );
  if (!textOk) problems.push("st.ed.invalid");
  if (draft.preview.kind === "quiz" && textOk) {
    const pool = draft.items.map((item) => item.secondary ?? "");
    const base = draft.preview.data;
    const lonely = draft.items.some(
      (item, index) =>
        !base.questions.some((q) => q.id === item.id) &&
        choicesFor(item.secondary ?? "", pool, index).choices.length < 2
    );
    if (lonely) problems.push("st.ed.needChoices");
  }
  if (textOk && hasDuplicateChoice(draft)) problems.push("st.ed.sameChoice");
  if (draft.preview.kind === "test" && !testFits(draft, draft.preview.data))
    problems.push("st.ed.sectionFull");
  // Anything else the codec would still turn down gets a kind word too, never a silent Accept.
  if (problems.length === 0 && buildData(draft) === null) problems.push("st.ed.cantSave");
  return problems;
}

/** An edited right answer that now reads the same as one of the other choices. */
function hasDuplicateChoice(draft: Draft): boolean {
  const { preview } = draft;
  const questions: { id: string; choices: { id: string; text: string }[]; answerId: string }[] =
    preview.kind === "quiz"
      ? preview.data.questions
      : preview.kind === "test"
        ? preview.data.sections.flatMap((section) =>
            section.questions.flatMap((q) => (q.plugin === "mcq" ? [q] : []))
          )
        : [];
  return draft.items.some((item) => {
    const old = questions.find((q) => q.id === item.id);
    if (!old || item.secondary === null) return false;
    const answer = item.secondary;
    return old.choices.some((choice) => choice.id !== old.answerId && sameText(choice.text, answer));
  });
}

function shortItem(draft: Draft, id: string): boolean {
  return (
    draft.preview.kind === "test" &&
    draft.preview.data.sections.some((section) =>
      section.questions.some((q) => q.id === id && q.plugin === "short")
    )
  );
}

// ---------------------------------------------------------------------------------------------
// Accept / Edit / Reject

export type Created = { noteId: string; setId: string; undoUntil: number };

export type ProposalPhase = "preview" | "editing" | "saving" | "accepted" | "rejected";

export type ProposalState = {
  phase: ProposalPhase;
  /** The last save or undo didn't go through (shown kindly; the preview stays). */
  error: "save" | null;
  /** The person took an accepted preview back with Undo. */
  undone: boolean;
  created: Created | null;
};

export type ProposalAction =
  | { type: "edit" }
  | { type: "doneEditing" }
  | { type: "accept" }
  | { type: "saved"; created: Created }
  | { type: "saveError" }
  | { type: "reject" }
  | { type: "reopen" }
  | { type: "undone" };

export const initialProposal: ProposalState = {
  phase: "preview",
  error: null,
  undone: false,
  created: null,
};

/** The flow: preview ⇄ editing → saving → accepted (→ Undo back to preview), or → rejected. */
export function proposalReducer(state: ProposalState, action: ProposalAction): ProposalState {
  switch (action.type) {
    case "edit":
      return state.phase === "preview"
        ? { ...state, phase: "editing", error: null, undone: false }
        : state;
    case "doneEditing":
      return state.phase === "editing" ? { ...state, phase: "preview" } : state;
    case "accept":
      return state.phase === "preview" || state.phase === "editing"
        ? { ...state, phase: "saving", error: null, undone: false }
        : state;
    case "saved":
      return state.phase === "saving"
        ? { ...state, phase: "accepted", created: action.created }
        : state;
    case "saveError":
      return state.phase === "saving" ? { ...state, phase: "preview", error: "save" } : state;
    case "reject":
      return state.phase === "preview" || state.phase === "editing"
        ? { ...state, phase: "rejected", error: null }
        : state;
    case "reopen":
      return state.phase === "rejected" ? { ...initialProposal } : state;
    case "undone":
      return state.phase === "accepted" ? { ...initialProposal, undone: true } : state;
  }
}

/** Accept saves only from the preview or the edit list, and only data the codec accepts. */
export function canAccept(state: ProposalState, draft: Draft): boolean {
  return (state.phase === "preview" || state.phase === "editing") && draftToData(draft) !== null;
}

/**
 * "Ask the coach" replaces the card, so it shows only while the card is a plain preview: never
 * over an edit list (the edits would be lost) or an accepted set (its Undo would be lost).
 */
export function canAskCoach(phase: ProposalPhase, hasCoachPreview: boolean): boolean {
  return !hasCoachPreview && phase === "preview";
}

export type GenerateReason = "no_key" | "too_short" | "busy" | "failed" | "offline";

/** The kind words for "the coach isn't available", per reason. */
export function reasonKey(reason: GenerateReason): MessageKey {
  return `st.pv.reason.${reason}` as MessageKey;
}
