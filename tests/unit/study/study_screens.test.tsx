/**
 * Kitchen T3 study screens, static renders (the repo has no DOM library; same style as
 * tests/unit/coach_message.test.tsx): the hub's states, the page menu's Turn into items, the
 * preview card, a set's deck, and the review session. Answers in English with the real copy.
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

// The screens' shared states live in components/goals/shared, which imports useConvexAuth from
// convex/react. Other test files replace convex/react process-wide without that export, so the
// shared module can't link here; stand in for it with the same markup hooks (data-component and
// the words) so these renders test the study screens, not test order.
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

const { ReviewHubView } = await import("../../../apps/web/components/study/ReviewHubView");
const { TurnIntoMenu, turnIntoItems } = await import("../../../apps/web/components/study/TurnIntoMenu");
const { TurnIntoView } = await import("../../../apps/web/components/study/TurnIntoView");
const { StudySetView } = await import("../../../apps/web/components/study/StudySetView");
const { ReviewSessionView } = await import("../../../apps/web/components/study/ReviewSessionView");

const html = (node: ReactElement) => renderToStaticMarkup(node);
const primaries = (markup: string) => markup.match(/tp-btn--primary/g)?.length ?? 0;
const BANNED = /\b(failed|must|overdue|streaks?|points? earned|level up|leaderboard)\b|—/i;

const set = {
  setId: "s1",
  noteId: "n1",
  kind: "flashcards" as const,
  title: "Cell biology",
  itemCount: 24,
  dueCount: 5,
  newCount: 3,
};

describe("ReviewHub", () => {
  test("loading shows skeletons with words for screen readers", () => {
    const markup = html(createElement(ReviewHubView, { hub: undefined, online: true }));
    expect(markup).toContain('data-component="StateLoading"');
    expect(markup).toContain("Loading your study sets");
  });
  test("empty explains how to make a first deck from a page", () => {
    const markup = html(createElement(ReviewHubView, { hub: { dueCount: 0, newCount: 0, reviewedToday: 0, sets: [] }, online: true }));
    expect(markup).toContain("Make your first deck from a page");
    expect(markup).toContain("Turn into flashcards");
    expect(markup).toContain('href="/notes"');
    expect(markup).toContain('data-component="IngestButton"');
    expect(primaries(markup)).toBe(0);
  });
  test("cards due: one focal card, one primary Start review, today's reviews in words", () => {
    const markup = html(
      createElement(ReviewHubView, {
        hub: {
          dueCount: 12,
          newCount: 3,
          reviewedToday: 7,
          sets: [set, { ...set, setId: "q1", kind: "quiz", title: "Quick check", itemCount: 10, dueCount: 0, newCount: 0, lastAttempt: { percent: 80, finishedAt: 1 } }],
        },
        online: true,
      }),
    );
    expect(markup).toContain('<span class="tp-num">12</span> cards due');
    expect(markup).toContain('<span class="tp-num">3</span> new cards available');
    expect(markup).toContain('You reviewed <span class="tp-num">7</span> cards today.');
    expect(primaries(markup)).toBe(1);
    expect(markup).toContain('href="/study/review"');
    expect(markup).toContain('href="/study/s1"');
    expect(markup).toContain("Last score <span class=\"tp-num\">80</span>%");
    expect(markup).toContain('dir="auto">Cell biology');
    expect(markup).toContain('href="/study/plan"');
    expect(markup).toContain('href="/study/record"');
    expect(markup).not.toMatch(BANNED);
  });
  test("nothing due is calm and has no primary to push", () => {
    const markup = html(createElement(ReviewHubView, { hub: { dueCount: 0, newCount: 0, reviewedToday: 0, sets: [{ ...set, dueCount: 0, newCount: 0 }] }, online: true }));
    expect(markup).toContain("Nothing due right now");
    expect(markup).toContain("No reviews yet today.");
    expect(primaries(markup)).toBe(0);
  });
  test("a hub cut short by its read budget says it shows the most recent sets", () => {
    const hub = { dueCount: 1, newCount: 0, reviewedToday: 0, sets: [set] };
    const cut = html(createElement(ReviewHubView, { hub: { ...hub, truncated: true }, online: true }));
    expect(cut).toContain("Showing your most recent sets.");
    expect(cut).toContain('dir="auto">Cell biology');
    expect(cut).not.toMatch(BANNED);
    const whole = html(createElement(ReviewHubView, { hub, online: true }));
    expect(whole).not.toContain("Showing your most recent sets.");
  });
  test("offline keeps the content and says so", () => {
    const markup = html(createElement(ReviewHubView, { hub: { dueCount: 1, newCount: 0, reviewedToday: 0, sets: [set] }, online: false }));
    expect(markup).toContain('data-component="StateOffline"');
    expect(markup).toContain("1 card due");
  });
});

describe("TurnIntoMenu", () => {
  test("three items, each a link to the preview for this page", () => {
    expect(turnIntoItems("n 7").map((i) => i.href)).toEqual([
      "/study/new?from=n%207&kind=flashcards",
      "/study/new?from=n%207&kind=quiz",
      "/study/new?from=n%207&kind=test",
    ]);
    const markup = html(createElement(TurnIntoMenu, { noteId: "n7" }));
    expect(markup.match(/role="menuitem"/g)?.length).toBe(3);
    expect(markup).toContain("Turn into flashcards");
    expect(markup).toContain("Turn into a quiz");
    expect(markup).toContain("Turn into a practice test");
  });
});

const PAGE = "# Cell biology\n\nMitosis: cell division\nOsmosis: water moving across a membrane\nDiffusion: spreading from high to low\n";
const noop = async () => {};

describe("Turn into preview", () => {
  test("the outline reader's preview is a ProposalCard with Accept / Edit / Reject and one primary", () => {
    const markup = html(
      createElement(TurnIntoView, {
        note: { id: "n1", title: "Cell biology", body: PAGE },
        hasFrom: true,
        kind: "flashcards",
        online: true,
        onGenerate: async () => ({ status: "unavailable", reason: "no_key" }),
        onCreate: async () => ({ noteId: "n2", setId: "s2", undoUntil: 0 }),
        onUndo: noop,
      }),
    );
    expect(markup).toContain('data-component="ProposalCard"');
    expect(markup).toContain('data-status="preview"');
    expect(markup).toContain("Adds a new page, ");
    expect(markup).toContain("Mitosis");
    expect(markup).toContain("Ask the coach");
    expect(markup).toContain('data-action="accept"');
    expect(markup).toContain('data-action="edit"');
    expect(markup).toContain('data-action="reject"');
    expect(markup).toContain("Made by the outline reader");
    expect(primaries(markup)).toBe(1);
    expect(markup).not.toMatch(BANNED);
  });
  test("without a page it explains where to start", () => {
    const markup = html(
      createElement(TurnIntoView, { note: null, hasFrom: false, kind: "quiz", online: true, onGenerate: async () => ({ status: "ready", data: {} }), onCreate: async () => ({ noteId: "", setId: "", undoUntil: 0 }), onUndo: noop }),
    );
    expect(markup).toContain("Pick a page first");
    expect(markup).not.toContain("ProposalCard");
  });
  test("a page with too little structure offers the coach instead", () => {
    const markup = html(
      createElement(TurnIntoView, { note: { id: "n1", title: "Note", body: "One line." }, hasFrom: true, kind: "flashcards", online: true, onGenerate: async () => ({ status: "ready", data: {} }), onCreate: async () => ({ noteId: "", setId: "", undoUntil: 0 }), onUndo: noop }),
    );
    expect(markup).toContain("The coach can try instead.");
    expect(markup).toContain('data-action="ask-coach"');
    expect(markup).not.toContain("ProposalCard");
  });
});

describe("a set and a session", () => {
  test("a deck: due line, Review due cards stays secondary next to the deck's own primary", () => {
    const markup = html(
      createElement(StudySetView, {
        data: {
          set: { setId: "s1", noteId: "n1", kind: "flashcards", title: "Cell biology", itemCount: 2 },
          note: { id: "n1", title: "Cell biology" },
          block: { id: "blk", type: "flashcards", data: { title: "Cell biology", origin: "user", cards: [{ id: "a", front: "Mitosis", back: "Division" }, { id: "b", front: "Osmosis", back: "Water" }] } },
          states: { a: { dueAt: 0 } },
          attempts: [],
        },
        online: true,
        now: 10,
        onRecord: noop,
        onRemove: () => {},
      }),
    );
    expect(markup).toContain('<span class="tp-num">1</span> due, <span class="tp-num">1</span> new');
    expect(markup).toContain('href="/study/review?set=s1"');
    expect(markup).toContain('href="/notes/n1"');
    expect(markup).toContain('data-component="FlashcardDeck"');
    expect(primaries(markup)).toBe(1);
  });
  test("a set that's gone says so kindly", () => {
    const markup = html(createElement(StudySetView, { data: null, online: true, now: 0, onRecord: noop, onRemove: () => {} }));
    expect(markup).toContain("This set isn&#x27;t here anymore");
  });
  test("a session with nothing due has a way back", () => {
    const markup = html(createElement(ReviewSessionView, { cards: [], now: 0, online: true, onSave: async () => ({ reviewId: "r", undoUntil: 0 }), onUndo: noop }));
    expect(markup).toContain("Nothing to review right now");
    expect(markup).toContain('href="/study"');
  });
  test("a session shows one card and Show answer as the one primary", () => {
    const markup = html(
      createElement(ReviewSessionView, {
        cards: [{ setId: "s1", setTitle: "Deck", cardId: "a", front: "Mitosis", back: "Division", state: null }],
        now: 0,
        online: true,
        onSave: async () => ({ reviewId: "r", undoUntil: 0 }),
        onUndo: noop,
      }),
    );
    expect(markup).toContain('data-component="FlashcardReview"');
    expect(markup).toContain("Show answer");
    expect(markup).toContain('<fieldset class="tp-study-lock"');
    expect(primaries(markup)).toBe(1);
  });
});

describe("Type answers (typed recall)", () => {
  const card = { setId: "s1", setTitle: "Deck", cardId: "a", front: "Mitosis", back: "Division", state: null };
  test("a session has the switch, off by default, named by its visible label", () => {
    const markup = html(
      createElement(ReviewSessionView, { cards: [card], now: 0, online: true, onSave: async () => ({ reviewId: "r", undoUntil: 0 }), onUndo: noop }),
    );
    expect(markup).toContain('data-component="TypeAnswersToggle"');
    const label = markup.match(/<label class="tp-study-typed__label" id="([^"]+)" for="([^"]+)">Type answers<\/label>/);
    expect(label).not.toBeNull();
    expect(markup).toContain(`id="${label?.[2]}" class="tp-switch" type="button" role="switch" aria-checked="false" aria-labelledby="${label?.[1]}"`);
    expect(markup).toContain('<span class="tp-switch__state">Off</span>');
    // Off: the session looks as before, with Show answer as the one primary.
    expect(markup).toContain("Show answer");
    expect(markup).not.toContain("recall-input");
    expect(primaries(markup)).toBe(1);
  });
  test("a deck has the same switch above the card, and still one primary", () => {
    const markup = html(
      createElement(StudySetView, {
        data: {
          set: { setId: "s1", noteId: "n1", kind: "flashcards", title: "Cell biology", itemCount: 1 },
          note: { id: "n1", title: "Cell biology" },
          block: { id: "blk", type: "flashcards", data: { title: "Cell biology", origin: "user", cards: [{ id: "a", front: "Mitosis", back: "Division" }] } },
          states: {},
          attempts: [],
        },
        online: true,
        now: 10,
        onRecord: noop,
        onRemove: () => {},
      }),
    );
    expect(markup).toContain('data-component="TypeAnswersToggle"');
    expect(markup.indexOf("TypeAnswersToggle")).toBeLessThan(markup.indexOf('data-component="FlashcardDeck"'));
    expect(markup).toContain('role="switch" aria-checked="false"');
    expect(primaries(markup)).toBe(1);
  });
  test("the switch shows its state in words when on", async () => {
    const { TypeAnswersToggle } = await import("../../../apps/web/components/study/TypeAnswersToggle");
    const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
    const markup = html(createElement(TypeAnswersToggle, { t, on: true, onChange: () => {} }));
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('<span class="tp-switch__state">On</span>');
    expect(markup).not.toMatch(BANNED);
  });
});

// Kitchen states pass: the non-happy states of the review session, a set and the recorder.
const { RecordGateView } = await import("../../../apps/web/components/study/record/RecordScreen");
const noopSave = async () => ({ reviewId: "r", undoUntil: 0 });

describe("states", () => {
  test("review with a ?set= that names no set of yours says the set is gone, with a way back", () => {
    const markup = html(
      createElement(ReviewSessionView, { cards: [], now: 0, online: true, setGone: true, onSave: noopSave, onUndo: noop }),
    );
    expect(markup).toContain("This set isn&#x27;t here anymore");
    expect(markup).not.toContain("Nothing to review right now");
    expect(markup).toContain('href="/study"');
    expect(markup).toContain("<h1");
    expect(markup).not.toMatch(BANNED);
  });

  test("a gone set wins over the loading state too", () => {
    const markup = html(
      createElement(ReviewSessionView, { cards: null, now: 0, online: true, setGone: true, onSave: noopSave, onUndo: noop }),
    );
    expect(markup).toContain("This set isn&#x27;t here anymore");
    expect(markup).not.toContain('data-component="StateLoading"');
  });

  test("review with a ?set= that is a quiz or practice test says Review is for flashcards, with a link to it", () => {
    for (const kind of ["quiz", "test"] as const) {
      const markup = html(
        createElement(ReviewSessionView, {
          cards: null,
          now: 0,
          online: true,
          otherKind: { setId: "studySets:4", kind, title: "Photosynthesis check" },
          onSave: noopSave,
          onUndo: noop,
        }),
      );
      expect(markup).toContain("Review is for flashcards");
      expect(markup).toContain(kind === "quiz" ? "This one is a quiz" : "This one is a practice test");
      expect(markup).toContain(kind === "quiz" ? "Open the quiz" : "Open the practice test");
      expect(markup).toContain('href="/study/studySets%3A4"');
      expect(markup).toContain('href="/study"');
      expect(markup).not.toContain("Nothing to review right now");
      expect(markup).not.toContain('data-component="StateLoading"');
      expect(primaries(markup)).toBe(1);
      expect(markup).not.toMatch(BANNED);
    }
  });

  test("a set keeps a page heading while it loads, when it is gone and when signed out", () => {
    const base = { online: true, now: 0, onRecord: async () => ({}), onRemove: noop };
    for (const props of [{ data: undefined }, { data: null }, { data: undefined, signedOut: true }]) {
      const markup = html(createElement(StudySetView, { ...base, ...props }));
      expect(markup).toMatch(/<h1[^>]*>Study set<\/h1>/);
    }
  });

  test("the recorder signed out shows its heading and the sign-in state, not the consent step", () => {
    const markup = html(createElement(RecordGateView, { signedIn: "signedOut", online: true }));
    expect(markup).toContain("Record a meeting or lecture");
    expect(markup).toContain('data-component="StateSignedOut"');
    expect(markup).not.toContain('data-step="consent"');
  });

  test("the recorder shows skeletons while the session is checked, and the offline notice", () => {
    const markup = html(createElement(RecordGateView, { signedIn: "loading", online: false }));
    expect(markup).toContain('data-component="StateLoading"');
    expect(markup).toContain("Getting the recorder ready");
    expect(markup).toContain('data-component="StateOffline"');
    expect(markup).not.toContain('data-step="consent"');
  });
});
