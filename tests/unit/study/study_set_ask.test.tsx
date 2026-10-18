/**
 * "Ask about this set", static renders (the repo has no DOM library; same style as
 * study_set_edit_screens.test.tsx): the quiet disclosure under the study panel before asking, its
 * answers with where each came from, the empty answer with a way to the page, the page still
 * loading, offline or with no page, and Hebrew. Real copy; sample data is fictional.
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
const { SetAsk, askPageId, askReducer } = await import("../../../apps/web/components/study/SetAsk");

const html = (node: ReactElement) => renderToStaticMarkup(node);
const primaries = (markup: string) => markup.match(/tp-btn--primary/g)?.length ?? 0;
const BANNED = /\b(failed|must|overdue|streaks?|points? earned|level up|leaderboard)\b|—/i;
const noop = async () => {};
const en = (key: Parameters<typeof translate>[1]) => translate("en", key);
const he = (key: Parameters<typeof translate>[1]) => translate("he", key);
/** The live region's contents. */
const results = (markup: string) => markup.match(/<div class="tp-study-ask__results" aria-live="polite">([\s\S]*?)<\/div><\/div><\/section>/)?.[1] ?? null;

const PAGE = {
  id: "n9",
  title: "Biology notes",
  body: "# Cell biology\n\nMitosis: cell division that makes two identical cells.\nDiffusion: particles spreading from high to low concentration.\n",
};

const deck = {
  title: "Cell biology",
  origin: "user" as const,
  cards: [
    { id: "a", front: "Mitosis", back: "Cell division that makes two identical cells" },
    { id: "b", front: "Osmosis", back: "Water moving across a membrane toward the saltier side" },
  ],
};
const deckBlock = { id: "blk", type: "flashcards" as const, data: deck };
const deckData: SetData = {
  set: { setId: "s1", noteId: "n1", kind: "flashcards", title: "Cell biology", itemCount: 2, sourceNoteId: "n9" },
  note: { id: "n1", title: "Cell biology" },
  block: deckBlock,
  blockVersion: "v1",
  states: {},
  attempts: [],
};

const view = (extra: Record<string, unknown> = {}, data: SetData = deckData) =>
  html(createElement(StudySetView, { data, online: true, now: 10, onRecord: noop, onRemove: () => {}, ...extra }));
const ask = (extra: Record<string, unknown>) =>
  html(createElement(SetAsk, { block: deckBlock, page: PAGE, online: true, t: en, ...extra }));

describe("Ask about this set, before asking", () => {
  test("a closed, quiet disclosure under the deck; the deck keeps the one primary", () => {
    const markup = view({ askPage: PAGE });
    expect(markup).toContain('data-component="SetAsk"');
    expect(markup.indexOf('data-component="FlashcardDeck"')).toBeLessThan(markup.indexOf('data-component="SetAsk"'));
    const toggle = markup.match(/<button type="button" class="tp-btn tp-btn--ghost tp-study-ask__toggle" data-action="ask-set" aria-expanded="false" aria-controls="([^"]+)">/);
    expect(toggle).not.toBeNull();
    expect(markup).toContain(`<div class="tp-study-ask__panel" id="${toggle?.[1]}" hidden="">`);
    expect(markup).toContain("<span>Ask about this set</span>");
    expect(primaries(markup)).toBe(1);
    expect(markup).not.toMatch(BANNED);
  });
  test("open: a labelled question, Find it secondary and waiting for words, the help line, an empty live region", () => {
    const markup = ask({ initialQuestion: "" });
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).not.toContain('hidden=""');
    const label = markup.match(/<label class="tp-label" for="([^"]+)">Your question<\/label>/);
    expect(label).not.toBeNull();
    expect(markup).toContain(`<input id="${label?.[1]}" class="tp-input" dir="auto" data-action="ask-set-input" aria-describedby=`);
    expect(markup).toMatch(/<div class="tp-recap__askrow"><input[^>]*><button type="submit" class="tp-btn tp-btn--secondary" data-action="ask-set-find" disabled="">/);
    expect(markup).toContain("<span>Find it</span>");
    expect(markup).toContain("Answers are found in your page and this set, on this device.");
    expect(results(markup)).toBe("");
    expect(primaries(markup)).toBe(0);
  });
  test("the question takes at most 300 characters, so a pasted page can't freeze the screen", () => {
    expect(ask({ initialQuestion: "" })).toMatch(/<input [^>]*data-action="ask-set-input"[^>]* maxLength="300"/);
  });
  test("signed out, loading or gone: the set isn't here, so neither is Ask", () => {
    expect(view({ signedOut: true }, deckData)).not.toContain("SetAsk");
    expect(html(createElement(StudySetView, { data: undefined, online: true, now: 0, onRecord: noop, onRemove: () => {} }))).not.toContain("SetAsk");
    expect(html(createElement(StudySetView, { data: null, online: true, now: 0, onRecord: noop, onRemove: () => {} }))).not.toContain("SetAsk");
  });
  test("while editing the set, Ask steps aside", () => {
    const markup = view({ askPage: PAGE, onSaveEdit: async () => ({ status: "saved", version: "v2", undoUntil: 0 }), initialPanel: "edit" });
    expect(markup).toContain('data-component="SetEditor"');
    expect(markup).not.toContain("SetAsk");
  });
});

describe("Ask about this set, answers", () => {
  test("quotes from the page and the set, each saying where it came from, matched words in bold", () => {
    const markup = view({ askPage: PAGE, initialAsk: "Does diffusion go from high to low, and what is osmosis?" });
    const live = results(markup) ?? "";
    expect(live).toContain("Words from your question are in bold.");
    // The page's sentence matches more words, so it comes first; then the card.
    expect(live.indexOf("From the page")).toBeGreaterThan(-1);
    expect(live.indexOf("From the page")).toBeLessThan(live.indexOf("From card"));
    expect(live).toContain('<p class="tp-recap__from">From card <span class="tp-num">2</span></p>');
    expect(live).toContain('<mark>Diffusion</mark>: particles spreading from <mark>high</mark> to <mark>low</mark> concentration.');
    expect(live).toContain('<p class="tp-study-ask__line" dir="auto"><mark>Osmosis</mark></p>');
    expect(live).toContain('<p class="tp-study-ask__line" dir="auto">Water moving across a membrane toward the saltier side</p>');
    expect(live.match(/<li /g)).toHaveLength(2);
    expect(live).not.toContain("seem to say");
    expect(primaries(markup)).toBe(1);
    expect(markup).not.toMatch(BANNED);
  });
  test("a page sentence the card repeats is quoted once, from the card", () => {
    const live = results(ask({ initialQuestion: "What is mitosis?" })) ?? "";
    expect(live.match(/<li /g)).toHaveLength(1);
    expect(live).toContain('From card <span class="tp-num">1</span>');
  });
  test("a quiz says which question; a test names its section, as the test numbers them", () => {
    const quiz = {
      id: "qz",
      type: "quiz" as const,
      data: {
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
            explanation: "Mitochondria turn food into energy.",
            difficulty: 1 as const,
          },
        ],
      },
    };
    const quizLive = results(ask({ block: quiz, page: null, initialQuestion: "energy" })) ?? "";
    expect(quizLive).toContain('From question <span class="tp-num">1</span>');
    expect(quizLive).toContain(">What makes ATP?</p>");
    expect(quizLive).toContain(">Mitochondria</p>");
    expect(quizLive).toContain("Mitochondria turn food into <mark>energy</mark>.");
    expect(quizLive).not.toContain("Nucleus");

    const test_ = {
      id: "ts",
      type: "test" as const,
      data: {
        title: "Practice",
        style: "standard" as const,
        origin: "user" as const,
        sections: [
          {
            id: "s1",
            title: "Part A",
            questions: [
              { plugin: "short" as const, id: "x", prompt: "Name the cell's control centre.", points: 2, accepted: ["Nucleus"] },
              { plugin: "short" as const, id: "y", prompt: "How many cells does mitosis make?", points: 2, accepted: ["Two"] },
            ],
          },
        ],
      },
    };
    const testLive = results(ask({ block: test_, page: null, initialQuestion: "mitosis" })) ?? "";
    expect(testLive).toContain('From <span dir="auto">Part A</span>, question <span class="tp-num">2</span>');
  });
});

describe("Ask about this set, asking again", () => {
  test("each Find it counts, so the same answers asked for again are put back and read out again", () => {
    const first = askReducer({ question: null, count: 0 }, "  What is osmosis? ");
    expect(first).toEqual({ question: "What is osmosis?", count: 1 });
    // The count keys what the live region holds: the same words, a new key.
    const again = askReducer(first, "What is osmosis?");
    expect(again.question).toBe(first.question);
    expect(again.count).not.toBe(first.count);
    expect(askReducer(again, "   ")).toEqual({ question: null, count: 3 });
  });
  test("no element is added around the answers: the live region's own layout still holds them", () => {
    const live = results(ask({ initialQuestion: "osmosis" })) ?? "";
    expect(live).toStartWith('<p class="tp-small tp-muted">Words from your question are in bold.</p><ul class="tp-recap__quotes">');
  });
});

describe("Ask about this set, when it can't find it or the page isn't there", () => {
  test("nothing found: says so in words, with a way to open the page", () => {
    const markup = ask({ initialQuestion: "photosynthesis" });
    const live = results(markup) ?? "";
    expect(live).toContain("The page and this set don&#x27;t seem to say. Try other words.");
    expect(live).toContain('href="/notes/n9"');
    expect(live).toContain('data-action="ask-open-page"');
    expect(live).toContain('<span>Open <span dir="auto">Biology notes</span></span>');
    expect(live).not.toContain("<ul");
    expect(live).not.toContain("in bold");
    expect(markup).not.toMatch(BANNED);
  });
  test("the page still loading: the set answers first and the page is still being read", () => {
    const found = results(ask({ page: undefined, initialQuestion: "osmosis" })) ?? "";
    expect(found).toContain("From card");
    expect(found).toContain("Still looking in your page.");
    const none = results(ask({ page: undefined, initialQuestion: "photosynthesis" })) ?? "";
    expect(none).toContain("Still looking in your page.");
    expect(none).not.toContain("seem to say");
  });
  test("no page, or offline before it loaded: only the set is searched, and the words say so", () => {
    for (const markup of [ask({ page: null, initialQuestion: "photosynthesis" }), ask({ page: undefined, online: false, initialQuestion: "photosynthesis" })]) {
      expect(markup).toContain("Answers are found in this set, on this device.");
      const live = results(markup) ?? "";
      expect(live).toContain("This set doesn&#x27;t seem to say. Try other words.");
      expect(live).not.toContain("ask-open-page");
      expect(live).not.toContain("Still looking");
    }
  });
  test("Hebrew: a pointed card answers an unpointed question, in the neutral plural", () => {
    const block = {
      id: "he",
      type: "flashcards" as const,
      data: { title: "תאים", origin: "user" as const, cards: [{ id: "a", front: "מִיטוֹזָה", back: "חֲלוּקָה שֶׁל תָּאִים" }] },
    };
    const markup = html(createElement(SetAsk, { block, page: null, online: true, t: he, initialQuestion: "מה זה מיטוזה?" }));
    const live = results(markup) ?? "";
    expect(live).toContain('<p class="tp-recap__from">מתוך כרטיס <span class="tp-num">1</span></p>');
    expect(live).toContain("<mark>מִיטוֹזָה</mark>");
    expect(live).toContain("המילים מהשאלה שלכם מודגשות.");
    expect(markup).toContain("<span>לשאול על החומר הזה</span>");
    expect(markup).not.toMatch(BANNED);
  });
});

describe("which page Ask reads", () => {
  test("the page the set was made from, else the block's source, else the page holding the set", () => {
    expect(askPageId(deckData)).toBe("n9");
    const fromBlock = { ...deckData, set: { ...deckData.set, sourceNoteId: undefined }, block: { ...deckBlock, data: { ...deck, source: { noteId: "n7", title: "Notes" } } } };
    expect(askPageId(fromBlock)).toBe("n7");
    expect(askPageId({ ...deckData, set: { ...deckData.set, sourceNoteId: undefined } })).toBe("n1");
  });
});
