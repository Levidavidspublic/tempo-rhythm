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

const { ReviewHubView } = await import("../../../apps/web/components/study/ReviewHub");
const { TurnIntoMenu, turnIntoItems } = await import("../../../apps/web/components/study/TurnIntoMenu");
const { TurnIntoView } = await import("../../../apps/web/components/study/TurnIntoPreview");
const { StudySetView } = await import("../../../apps/web/components/study/StudySetScreen");
const { ReviewSessionView } = await import("../../../apps/web/components/study/ReviewSession");

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
