/**
 * bun:test plus react-dom/server, like the other component tests in apps/web: the saved-thread
 * count, and Hebrew renders of /history and /calendar with no English word left, on screen or in
 * what a screen reader hears. The calendar render lives here because CalendarViews.test.ts only
 * checks date math and needed no change.
 *
 * The thread-list previews need the first thread picked (an effect) and a typed search, which a
 * static render never runs, so those tests mount with react-dom/client on a small fake DOM, as
 * ProfileForm.test.tsx and the other form tests here do.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lang, MessageKey } from "@/lib/i18n";
import { intlLocale } from "@/lib/you/screenState";

let lang: Lang = "he";
let isAuthenticated = true;
let conversations: unknown[] = [];
let dueTasks: unknown[] = [];
/** messages.list per thread id; a missing id is a query still loading. */
let threadMessages: Record<string, unknown[]> = {};
let searchHits: unknown[] = [];

type QueryArgs = Record<string, unknown>;
const results: Record<string, (args: QueryArgs) => unknown> = {
  "users.getProfile": () => ({ _id: "u1" }),
  "conversations.list": () => conversations,
  "conversations.get": (args) =>
    conversations.find((row) => (row as { _id: string })._id === args.conversationId),
  "messages.list": (args) => threadMessages[String(args.conversationId)],
  "messages.searchMine": () => searchHits,
  "calendar_events.listInRange": () => [],
  "tasks.listDueInRange": () => dueTasks,
};

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "next/link": { ...(await import("next/link")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated, isLoading: false }),
  useMutation: () => async () => undefined,
  useQuery: (ref: string, args: QueryArgs | "skip") =>
    args === "skip" ? undefined : results[ref]?.(args),
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
  threadMessages = {};
  searchHits = [];
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

/** Just enough DOM for react-dom/client: a node tree with attributes, text and no-op listeners. */
class FakeNode {
  readonly childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  readonly attributes: Record<string, string> = {};
  readonly style = { setProperty() {}, removeProperty() {} };
  nodeValue: string | null = null;
  documentElement: FakeNode | null = null;
  body: FakeNode | null = null;
  activeElement: FakeNode | null = null;
  defaultView: unknown = globalThis;

  constructor(
    readonly nodeType: number,
    readonly nodeName: string,
    readonly ownerDocument: FakeNode | null
  ) {}

  get tagName() {
    return this.nodeName;
  }
  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }
  get lastChild(): FakeNode | null {
    return this.childNodes.at(-1) ?? null;
  }
  get nextSibling(): FakeNode | null {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  get previousSibling(): FakeNode | null {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) - 1] ?? null;
  }
  get textContent(): string {
    if (this.nodeType === 3) return this.nodeValue ?? "";
    if (this.nodeType === 8) return "";
    return this.childNodes.map((child) => child.textContent).join("");
  }
  set textContent(text: string) {
    for (const child of [...this.childNodes]) this.removeChild(child);
    if (text) this.appendChild((this.ownerDocument ?? this).createTextNode(text));
  }

  appendChild(child: FakeNode) {
    return this.insertBefore(child, null);
  }
  insertBefore(child: FakeNode, before: FakeNode | null) {
    child.parentNode?.removeChild(child);
    const index = before ? this.childNodes.indexOf(before) : -1;
    if (index < 0) this.childNodes.push(child);
    else this.childNodes.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild(child: FakeNode) {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    child.parentNode = null;
    return child;
  }
  setAttribute(name: string, value: unknown) {
    this.attributes[name] = String(value);
  }
  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name: string) {
    return Object.hasOwn(this.attributes, name);
  }
  removeAttribute(name: string) {
    delete this.attributes[name];
  }
  addEventListener() {}
  removeEventListener() {}
  getRootNode() {
    return this.ownerDocument ?? this;
  }
  createElement(tag: string) {
    return new FakeNode(1, tag.toUpperCase(), this);
  }
  createElementNS(_namespace: string, tag: string) {
    return this.createElement(tag);
  }
  createTextNode(text: string) {
    const node = new FakeNode(3, "#text", this);
    node.nodeValue = text;
    return node;
  }
  createComment(text: string) {
    const node = new FakeNode(8, "#comment", this);
    node.nodeValue = text;
    return node;
  }
}

const fakeDomGlobals = ["window", "document", "HTMLIFrameElement", "IS_REACT_ACT_ENVIRONMENT"];

describe("/history thread list previews", () => {
  const globals = globalThis as Record<string, unknown>;
  const savedGlobals = new Map<string, unknown>();
  let createRoot: typeof import("react-dom/client").createRoot;
  let fakeDocument: FakeNode;
  let root: Root | null = null;
  let host: FakeNode | null = null;

  beforeAll(async () => {
    for (const name of fakeDomGlobals) savedGlobals.set(name, globals[name]);
    fakeDocument = new FakeNode(9, "#document", null);
    const html = fakeDocument.createElement("html");
    const body = fakeDocument.createElement("body");
    fakeDocument.appendChild(html);
    html.appendChild(body);
    fakeDocument.documentElement = html;
    fakeDocument.body = body;
    fakeDocument.activeElement = body;
    Object.assign(globals, {
      window: globalThis,
      document: fakeDocument,
      HTMLIFrameElement: class HTMLIFrameElement {},
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    // Loaded once the fake DOM is in place, so react-dom sees a browser.
    ({ createRoot } = await import("react-dom/client"));
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    host?.parentNode?.removeChild(host);
    root = null;
    host = null;
  });

  afterAll(() => {
    for (const [name, value] of savedGlobals) {
      if (value === undefined) delete globals[name];
      else globals[name] = value;
    }
  });

  async function mountHistory(): Promise<FakeNode> {
    const container = fakeDocument.createElement("div");
    fakeDocument.body?.appendChild(container);
    host = container;
    root = createRoot(container as unknown as HTMLElement);
    // The effect that picks the first thread runs inside act, then its messages load.
    await act(async () => root?.render(createElement(HistoryScreen)));
    return container;
  }

  function findAll(node: FakeNode, match: (node: FakeNode) => boolean): FakeNode[] {
    const found = match(node) ? [node] : [];
    return found.concat(node.childNodes.flatMap((child) => findAll(child, match)));
  }

  /** Each thread row's lines, top to bottom: title, pills, preview when there is one, updated. */
  function threadRows(view: FakeNode): string[][] {
    return findAll(
      view,
      (node) => node.tagName === "BUTTON" && node.hasAttribute("aria-pressed")
    ).map((row) => row.childNodes.map((line) => line.textContent));
  }

  async function typeSearch(view: FakeNode, text: string) {
    const [input] = findAll(view, (node) => node.attributes.id === "history-search");
    if (!input) throw new Error("Missing the history search input");
    const fields = input as unknown as Record<string, unknown>;
    const propsKey = Object.keys(fields).find((key) => key.startsWith("__reactProps$"));
    const props = (propsKey ? fields[propsKey] : undefined) as
      | { onChange: (event: { currentTarget: { value: string } }) => void }
      | undefined;
    if (!props) throw new Error("No React props on the history search input");
    await act(async () => props.onChange({ currentTarget: { value: text } }));
  }

  const weekly = thread("c1", "Weekly plan", 30);
  const budget = thread("c2", "Budget review", 20);
  const receipts = thread("c3", "Receipts folder", 10);
  function message(id: string, conversationId: string, role: string, content: string) {
    return { _id: id, _creationTime: created, conversationId, role, content, createdAt: created };
  }
  const weeklyMessages = [
    message("m1", "c1", "system", "You are a calm planning coach."),
    message("m2", "c1", "user", "Plan Monday: gym, then deep work"),
    message("m3", "c1", "assistant", "Gym at 8, deep work from 10."),
  ];
  // Budget review holds a message on the server; the list just never loads it unless it is open.
  const budgetMessages = [message("m4", "c2", "user", "Scan the receipts before Friday")];

  for (const language of ["en", "he"] as const) {
    describe(language, () => {
      const t = (key: MessageKey) => translate(language, key);
      const companion = () => t("hist.companion");
      const updated = (row: { updatedAt: number }) => {
        const format = new Intl.DateTimeFormat(intlLocale(language), {
          dateStyle: "medium",
          timeStyle: "short",
        });
        return t("hist.updated").replace("{date}", format.format(new Date(row.updatedAt)));
      };
      /** No "No messages have been added…" anywhere, in this language or the English fallback. */
      const expectNoEmptyPreview = (view: FakeNode) => {
        expect(view.textContent).not.toContain(t("hist.preview.empty"));
        expect(view.textContent).not.toContain(en("hist.preview.empty"));
      };

      beforeEach(() => {
        lang = language;
      });

      test("the open thread shows its first message; a thread not opened shows no preview", async () => {
        conversations = [weekly, budget];
        threadMessages = { c1: weeklyMessages, c2: budgetMessages };
        const view = await mountHistory();
        expect(threadRows(view)).toEqual([
          [weekly.title, companion(), "Plan Monday: gym, then deep work", updated(weekly)],
          [budget.title, companion(), updated(budget)],
        ]);
        expectNoEmptyPreview(view);
      });

      test("while the open thread's messages load, no row says it has no messages", async () => {
        conversations = [weekly, budget];
        threadMessages = { c2: budgetMessages };
        const view = await mountHistory();
        expect(threadRows(view)).toEqual([
          [weekly.title, companion(), updated(weekly)],
          [budget.title, companion(), updated(budget)],
        ]);
        expectNoEmptyPreview(view);
      });

      test("a search hit on a thread not opened shows the hit; a title match shows no preview", async () => {
        conversations = [weekly, budget, receipts];
        threadMessages = { c1: weeklyMessages, c2: budgetMessages };
        searchHits = [
          {
            messageId: "m4",
            conversationId: "c2",
            role: "user",
            content: "Scan the receipts before Friday",
            createdAt: created,
          },
        ];
        const view = await mountHistory();
        await typeSearch(view, "receipts");
        expect(threadRows(view)).toEqual([
          [
            budget.title,
            `${companion()}${t("hist.matches.one")}`,
            "Scan the receipts before Friday",
            updated(budget),
          ],
          [receipts.title, companion(), updated(receipts)],
        ]);
        expectNoEmptyPreview(view);
      });
    });
  }
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
