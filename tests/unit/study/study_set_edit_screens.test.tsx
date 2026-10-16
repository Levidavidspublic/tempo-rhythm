/**
 * Editing a saved set, static renders (the repo has no DOM library; same style as
 * study_screens.test.tsx): Edit on the set screen stays quiet next to the one primary, and the
 * edit list's states (editing, saving, didn't save, the page changed meanwhile). English, with
 * the real copy. Sample data is fictional.
 */
import { describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { createElement, type ReactElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { translate } from "../../../apps/web/lib/i18n";

const realLocale = await import("../../../apps/web/components/providers/LocaleProvider");
mock.module("../../../apps/web/components/providers/LocaleProvider", () => ({
  ...realLocale,
  useLocale: () => ({
    lang: "en",
    dir: "ltr",
    setLang: () => {},
    t: (key: Parameters<typeof translate>[1]) => translate("en", key),
  }),
}));

// The same stand-in for components/goals/shared as study_screens.test.tsx (it imports
// useConvexAuth from convex/react, which other files replace process-wide): same markup hooks.
const goalsShared = Bun.resolveSync("../../../apps/web/components/goals/shared", import.meta.dir);
mock.module(goalsShared, () => {
  const h = createElement;
  type Kids = { children?: unknown };
  return {
    UNDO_WINDOW_MS: 300_000,
    useSignedIn: () => "ready",
    useOnline: () => true,
    ScreenBoundary: ({ children }: Kids) => children,
    SignedOutState: () => h("div", { "data-component": "StateSignedOut" }),
    OfflineNotice: ({ text }: { text: string }) => h("output", { "data-component": "StateOffline" }, text),
    StateLoading: ({ label }: { label: string }) => h("output", { "data-component": "StateLoading" }, label),
    StateEmpty: ({ title, body, action }: { title: string; body: string; action?: unknown }) =>
      h("div", { "data-component": "StateEmpty" }, h("h2", null, title), h("p", null, body), action as never),
    StateError: ({ title, action }: { title: string; action?: unknown }) => h("div", { "data-component": "StateError" }, title, action as never),
    makeToast: (title: string) => ({ id: 1, title, undoUntilMs: 0 }),
    UndoToast: () => null,
  };
});

const { StudySetView } = await import("../../../apps/web/components/study/StudySetView");
type SetData = import("../../../apps/web/components/study/StudySetView").SetData;
const { SetEditor } = await import("../../../apps/web/components/study/SetEditor");
const { closedEdit, setEditReducer } = await import("../../../apps/web/components/study/set-edit");

const html = (node: ReactElement) => renderToStaticMarkup(node);
const primaries = (markup: string) => markup.match(/tp-btn--primary/g)?.length ?? 0;
const BANNED = /\b(failed|must|overdue|streaks?|points? earned|level up|leaderboard)\b|—/i;
const noop = async () => {};
const t = (key: Parameters<typeof translate>[1]) => translate("en", key);

const deck = {
  title: "Cell biology",
  origin: "user" as const,
  cards: [
    { id: "a", front: "Mitosis", back: "Division" },
    { id: "b", front: "Osmosis", back: "Water" },
  ],
};
const quiz = {
  title: "Quick check",
  mode: "fixed" as const,
  origin: "coach" as const,
  questions: [
    {
      id: "q1",
      prompt: "What makes ATP?",
      choices: [
        { id: "a", text: "Mitochondria" },
        { id: "b", text: "Nucleus" },
      ],
      answerId: "a",
      difficulty: 1 as const,
    },
  ],
};

const deckData: SetData = {
  set: { setId: "s1", noteId: "n1", kind: "flashcards", title: "Cell biology", itemCount: 2 },
  note: { id: "n1", title: "Biology notes" },
  block: { id: "blk", type: "flashcards", data: deck },
  blockVersion: "v1",
  states: { a: { dueAt: 0 } },
  attempts: [],
};
const quizData: SetData = {
  ...deckData,
  set: { ...deckData.set, kind: "quiz", title: "Quick check", itemCount: 1 },
  block: { id: "blk", type: "quiz", data: quiz },
};

const saved = async () => ({ status: "saved" as const, version: "v2", undoUntil: 0 });
const view = (data: SetData, extra: Record<string, unknown> = {}) =>
  html(
    createElement(StudySetView, {
      data,
      online: true,
      now: 10,
      onRecord: noop,
      onRemove: () => {},
      onSaveEdit: saved,
      onUndoEdit: saved,
      ...extra,
    }),
  );

describe("Edit on a set", () => {
  test("it sits with the other quiet actions; the deck's Flip stays the one primary", () => {
    const markup = view(deckData);
    expect(markup).toMatch(/class="tp-btn tp-btn--ghost"[^>]*data-action="edit-set"/);
    expect(markup).toContain(">Edit</span>");
    expect(markup).toContain('data-component="FlashcardDeck"');
    expect(primaries(markup)).toBe(1);
    expect(markup).not.toMatch(BANNED);
  });
  test("without the save path or a block version there is no Edit", () => {
    expect(view(deckData, { onSaveEdit: undefined })).not.toContain('data-action="edit-set"');
    expect(view({ ...deckData, blockVersion: undefined })).not.toContain('data-action="edit-set"');
  });
});

describe("the edit list on the set screen", () => {
  test("a deck: the edit list replaces the deck, Save changes is the one primary", () => {
    const markup = view(deckData, { initialPanel: "edit" });
    expect(markup).toContain('data-component="SetEditor"');
    expect(markup).toContain('data-status="editing"');
    expect(markup).not.toContain('data-component="FlashcardDeck"');
    expect(markup).toContain("Edit this set");
    expect(markup).toContain('Changes are saved into the page <span dir="auto">Biology notes</span>, with 5 minutes to undo.');
    expect(markup).toContain("Cards you keep keep their review times. New cards start fresh.");
    expect(markup).toContain('value="Mitosis"');
    expect(markup).toContain('value="Division"');
    expect(markup).toContain('data-action="save-edit"');
    expect(markup).toContain('data-action="cancel-edit"');
    expect(markup).toContain('data-action="add-item"');
    // While editing, Edit and Remove step aside; the page link and Listen stay.
    expect(markup).not.toContain('data-action="edit-set"');
    expect(markup).not.toContain('data-action="remove-set"');
    expect(markup).toContain('href="/notes/n1"');
    expect(primaries(markup)).toBe(1);
    expect(markup).not.toMatch(BANNED);
  });
  test("a quiz: question and right answer lines, no word about review times", () => {
    const markup = view(quizData, { initialPanel: "edit" });
    expect(markup).toContain(">Question</label>");
    expect(markup).toContain(">Right answer</label>");
    expect(markup).toContain('value="Mitochondria"');
    expect(markup).not.toContain("review times");
    expect(primaries(markup)).toBe(1);
  });
});

describe("SetEditor states", () => {
  const base = { kind: "flashcards" as const, data: deck };
  const editing = setEditReducer(closedEdit, { type: "open", version: "v1" });
  const editor = (state = editing, currentVersion = "v1") =>
    html(
      createElement(SetEditor, {
        base,
        pageTitle: "Biology notes",
        state,
        currentVersion,
        t,
        onSave: () => {},
        onCancel: () => {},
        onReload: () => {},
      }),
    );

  test("editing: Save changes can be pressed; nothing to warn about", () => {
    const markup = editor();
    expect(markup).toMatch(/data-action="save-edit"(?![^>]*disabled)/);
    expect(markup).not.toContain('data-reason="changed"');
    expect(markup).toContain('aria-labelledby="st-setedit-title"');
    expect(markup).toContain('id="st-setedit-title" tabindex="-1"');
  });
  test("saving: Saving… with Cancel held until it's done", () => {
    const markup = editor(setEditReducer(editing, { type: "save" }));
    expect(markup).toContain("Saving…");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toMatch(/disabled=""[^>]*data-action="cancel-edit"|data-action="cancel-edit"[^>]*disabled=""/);
  });
  test("didn't save: the edits stay and it says so", () => {
    const markup = editor(setEditReducer(setEditReducer(editing, { type: "save" }), { type: "saveError" }));
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("That didn&#x27;t save. Your edits are still here.");
    expect(markup).toContain('value="Mitosis"');
  });
  test("the page's block changed meanwhile: said in words, Reload offered, Save held back", () => {
    for (const markup of [
      editor(editing, "v2"),
      editor(setEditReducer(setEditReducer(editing, { type: "save" }), { type: "changed" })),
    ]) {
      expect(markup).toContain('data-status="stale"');
      expect(markup).toContain('data-reason="changed"');
      expect(markup).toContain("This set changed in its page after you started editing");
      expect(markup).toContain('data-action="reload-edit"');
      expect(markup).toContain("Reload the newest version");
      expect(markup).toMatch(/disabled=""[^>]*data-action="save-edit"|data-action="save-edit"[^>]*disabled=""/);
      expect(markup).not.toMatch(BANNED);
    }
  });
  test("an item without words shows the edit list's own named problem and holds Save", () => {
    const markup = html(
      createElement(SetEditor, {
        base: { kind: "flashcards", data: { ...deck, title: " " } },
        pageTitle: "Biology notes",
        state: editing,
        currentVersion: "v1",
        t,
        onSave: () => {},
        onCancel: () => {},
        onReload: () => {},
      }),
    );
    expect(markup).toContain("Give it a title of up to 200 characters.");
    expect(markup).toMatch(/disabled=""[^>]*data-action="save-edit"|data-action="save-edit"[^>]*disabled=""/);
  });
});
