/**
 * bun:test plus react-dom/server, like the other component tests in apps/web: the saved-thread
 * count, and Hebrew renders of /history and /calendar with no English word left, on screen or in
 * what a screen reader hears. The calendar render lives here because CalendarViews.test.ts only
 * checks date math and needed no change.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lang, MessageKey } from "@/lib/i18n";

let lang: Lang = "he";
let isAuthenticated = true;
let conversations: unknown[] = [];
let dueTasks: unknown[] = [];

const results: Record<string, () => unknown> = {
  "users.getProfile": () => ({ _id: "u1" }),
  "conversations.list": () => conversations,
  "calendar_events.listInRange": () => [],
  "tasks.listDueInRange": () => dueTasks,
};

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated, isLoading: false }),
  useMutation: () => async () => undefined,
  useQuery: (ref: string, args: unknown) => (args === "skip" ? undefined : results[ref]?.()),
}));
mock.module("next/link", () => ({
  default: (props: { href: string; children?: unknown }) =>
    createElement("a", { href: props.href }, props.children as never),
}));
mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    conversations: { list: "conversations.list", get: "conversations.get" },
    messages: { list: "messages.list", searchMine: "messages.searchMine" },
    calendar_events: {
      create: "calendar_events.create",
      update: "calendar_events.update",
      remove: "calendar_events.remove",
      restore: "calendar_events.restore",
      listInRange: "calendar_events.listInRange",
    },
    tasks: { listDueInRange: "tasks.listDueInRange" },
  },
}));

const { MESSAGES, translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { HistoryScreen, isSavedThread, savedThreadsLabel } = await import("./HistoryScreen");
const { CalendarViews } = await import("@/components/calendar/CalendarViews");

const en = (key: MessageKey) => translate("en", key);
const he = (key: MessageKey) => translate("he", key);

const created = Date.UTC(2026, 9, 14, 9, 0);
function thread(id: string, title: string, minutesLater: number) {
  return {
    _id: id,
    _creationTime: created,
    userId: "u1",
    title,
    createdAt: created,
    updatedAt: created + minutesLater * 60_000,
    chatMode: "legacy" as const,
  };
}
const planning = thread("c1", "תכנון השבוע", 5);
// Every thread the coach opens keeps the server's default title.
const untitled = thread("c2", "New Conversation", 30);
// Opened by the coach, never written in: createdAt and updatedAt still match.
const empty = thread("c3", "טיוטה ריקה", 0);

/** Text on screen plus aria-label, placeholder and title values; entities become spaces. */
function readableText(html: string): string {
  const attributes = [...html.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map(
    (match) => match[1]
  );
  return [html.replace(/<[^>]*>/g, " "), ...attributes]
    .join(" ")
    .replace(/&(?:#x?[0-9a-f]+|[a-z]+);/gi, " ");
}

/** Latin words left in a render. The product name is the one that stays. */
function englishWords(html: string): string[] {
  return (readableText(html).match(/[A-Za-z]+/g) ?? []).filter((word) => word !== "Tempo");
}

const renderHistory = () => renderToStaticMarkup(createElement(HistoryScreen));
const renderCalendar = (eventSourceMode: "convex" | "local") =>
  renderToStaticMarkup(createElement(CalendarViews, { eventSourceMode }));

beforeEach(() => {
  lang = "he";
  isAuthenticated = true;
  conversations = [];
  dueTasks = [];
});

describe("saved thread count", () => {
  test("0, 1 and 2 threads read with the right form in English and Hebrew", () => {
    expect(savedThreadsLabel([], en)).toBe("0 saved threads");
    expect(savedThreadsLabel([planning], en)).toBe("1 saved thread");
    expect(savedThreadsLabel([planning, untitled], en)).toBe("2 saved threads");
    expect(savedThreadsLabel([], he)).toBe("0 שיחות שמורות");
    expect(savedThreadsLabel([planning], he)).toBe("שיחה שמורה אחת");
    expect(savedThreadsLabel([planning, untitled], he)).toBe("2 שיחות שמורות");
  });

  test("a thread with no message is not counted", () => {
    expect(isSavedThread(empty)).toBe(false);
    expect(isSavedThread(planning)).toBe(true);
    expect(savedThreadsLabel([planning, empty], en)).toBe("1 saved thread");
    expect(savedThreadsLabel([empty], en)).toBe("0 saved threads");
  });
});

describe("/history", () => {
  test("Hebrew list: no English, the right count, the empty thread left out", () => {
    conversations = [untitled, planning, empty];
    const html = renderHistory();
    expect(englishWords(html)).toEqual([]);
    expect(html).toContain("2 שיחות שמורות");
    expect(html).toContain("מוצגות 2 מתוך 2");
    expect(html).toContain(he("hist.defaultTitle"));
    expect(html).toContain("תכנון השבוע");
    expect(html).not.toContain("טיוטה ריקה");
  });

  test("Hebrew signed out: no English", () => {
    isAuthenticated = false;
    const html = renderHistory();
    expect(englishWords(html)).toEqual([]);
    expect(html).toContain(he("hist.signInBody"));
  });

  test("only empty threads show the no-conversations state, in Hebrew", () => {
    conversations = [empty];
    const html = renderHistory();
    expect(englishWords(html)).toEqual([]);
    expect(html).toContain(he("hist.empty.title"));
  });

  test("English keeps its copy and says 1 saved thread", () => {
    lang = "en";
    conversations = [planning, empty];
    const html = renderHistory();
    expect(html).toContain("1 saved thread<");
    expect(html).toContain("Pick up a conversation where you left it");
    expect(html).toContain("1 of 1 shown");
  });

  test("a thread title with $ patterns is read as typed in the messages label", () => {
    lang = "en";
    conversations = [thread("c4", "Budget $& plan $1", 5)];
    const html = renderHistory();
    // The markup escapes "&" in attributes.
    const label = en("hist.messagesFor").replace("{title}", () => "Budget $&amp; plan $1");
    expect(html).toContain(`aria-label="${label}"`);
  });
});

describe("/calendar", () => {
  test("Hebrew, signed in with a due task: no English, the plain title", () => {
    dueTasks = [{ _id: "t1", title: "לשלוח את הדוח", dueAt: Date.now(), status: "done" }];
    const html = renderCalendar("convex");
    expect(englishWords(html)).toEqual([]);
    expect(html).toContain(`<h1 class="tp-pagehead__title">${he("nav.calendar")}</h1>`);
    expect(html).toContain(he("cal.due"));
    expect(html).toContain(` · ${he("cal.due.done")}`);
  });

  test("Hebrew, local events: no English", () => {
    const html = renderCalendar("local");
    expect(englishWords(html)).toEqual([]);
    expect(html).toContain(he("cal.events.empty"));
  });

  test("English title is the nav's name, not spec text", () => {
    lang = "en";
    const html = renderCalendar("local");
    expect(html).toContain('<h1 class="tp-pagehead__title">Calendar</h1>');
    expect(html).not.toContain("One source for every calendar view");
  });
});

test("every calendar and history string has its own Hebrew, errors included", () => {
  const keys = (Object.keys(MESSAGES.en) as MessageKey[]).filter(
    (key) => key.startsWith("cal.") || key.startsWith("hist.")
  );
  expect(keys.length).toBeGreaterThan(50);
  for (const key of keys) {
    // {n}, {date} and the like are filled in, not read.
    const words = englishWords(he(key).replace(/\{\w+\}/g, " "));
    expect({ key, words }).toEqual({ key, words: [] });
    expect({ key, same: he(key) === en(key) }).toEqual({ key, same: false });
  }
});
