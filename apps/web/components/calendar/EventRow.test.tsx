/**
 * bun:test plus react-dom/server, like HistoryScreen.test.tsx: an event row in English and Hebrew,
 * idle and editing, and the undo toast. In Hebrew the only Latin left is the event's own title, on
 * screen or in what a screen reader hears. EventRow reads no Convex, so only the locale is mocked;
 * HistoryScreen.test.tsx renders the whole /calendar page.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lang, MessageKey } from "@/lib/i18n";

let lang: Lang = "he";

const { MESSAGES, translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { EventRow, UndoToast, saveErrorKey } = await import("./EventRow");

const en = (key: MessageKey) => translate("en", key);
const he = (key: MessageKey) => translate("he", key);

const title = "Boundary planning call";
const startsAtMs = new Date(2026, 7, 1, 12, 0).getTime();
const event = { id: "e1", title, startsAtMs };
const actions = { onUpdate: async () => undefined, onDelete: async () => undefined };
const dateFormat: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
};

/** Text on screen plus aria-label, placeholder and title values; entities become spaces. */
function readableText(html: string): string {
  const attributes = [...html.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)].map(
    (match) => match[1]
  );
  return [html.replace(/<[^>]*>/g, " "), ...attributes]
    .join(" ")
    .replace(/&(?:#x?[0-9a-f]+|[a-z]+);/gi, " ");
}

/** Latin words left once the event's own title is taken out. */
function wordsBesidesTitle(html: string): string[] {
  return (
    readableText(html)
      .split(title)
      .join(" ")
      .match(/[A-Za-z]+/g) ?? []
  );
}

const renderRow = (initialEditing: boolean) =>
  renderToStaticMarkup(createElement(EventRow, { event, actions, initialEditing }));
const renderToast = () =>
  renderToStaticMarkup(
    createElement(UndoToast, {
      toast: { eventId: event.id, title, undoUntilMs: Date.now() + 60_000 },
      onUndo: async () => undefined,
      onExpire() {},
    })
  );

beforeEach(() => {
  lang = "he";
});

describe("an idle event row", () => {
  test("English keeps the labels the e2e specs use, and an English date", () => {
    lang = "en";
    const html = renderRow(false);
    expect(html).toContain(`aria-label="Edit ${title}"`);
    expect(html).toContain(`aria-label="Delete ${title}"`);
    expect(html).toContain(">Edit</button>");
    expect(html).toContain(">Delete</button>");
    expect(html).toContain(new Date(startsAtMs).toLocaleDateString("en-GB", dateFormat));
  });

  test("Hebrew: no Latin besides the title, a Hebrew date, the title stays dir=auto", () => {
    const html = renderRow(false);
    expect(wordsBesidesTitle(html)).toEqual([]);
    expect(html).toContain(`aria-label="עריכת ${title}"`);
    expect(html).toContain(`aria-label="מחיקת ${title}"`);
    expect(html).toContain(`>${he("cal.row.edit")}</button>`);
    expect(html).toContain(`>${he("cal.row.delete")}</button>`);
    expect(html).toContain(new Date(startsAtMs).toLocaleDateString("he-IL", dateFormat));
    expect(html).toContain(`<span class="tp-list-row__title" dir="auto">${title}</span>`);
  });
});

describe("an event row in its edit form", () => {
  test("English: Title, Date, Save and Cancel", () => {
    lang = "en";
    const html = renderRow(true);
    for (const label of ["Title", "Date"]) {
      expect(html).toContain(`<span class="tp-label">${label}</span>`);
    }
    expect(html).toContain(">Save</button>");
    expect(html).toContain(">Cancel</button>");
  });

  test("Hebrew: no Latin besides the title, which keeps dir=auto", () => {
    const html = renderRow(true);
    expect(wordsBesidesTitle(html)).toEqual([]);
    expect(html).toContain(`<span class="tp-label">${he("cal.row.title")}</span>`);
    expect(html).toContain(`<span class="tp-label">${he("cal.row.date")}</span>`);
    expect(html).toContain(`>${he("cal.row.save")}</button>`);
    expect(html).toContain(`>${he("cal.row.cancel")}</button>`);
    expect(html).toContain(`dir="auto" value="${title}"`);
  });
});

describe("the undo toast", () => {
  test("English: Event removed. Undo", () => {
    lang = "en";
    const html = renderToast();
    expect(html).toContain(">Event removed.</span>");
    expect(html).toContain(">Undo</button>");
  });

  test("Hebrew: no Latin at all", () => {
    const html = renderToast();
    expect(readableText(html).match(/[A-Za-z]+/g) ?? []).toEqual([]);
    expect(html).toContain(`>${he("cal.row.removed")}</span>`);
    expect(html).toContain(`>${he("cal.row.undo")}</button>`);
  });
});

test("a failed save names the likely cause, never raw server text", () => {
  expect(saveErrorKey(title, "2026-08-01")).toBe("cal.row.err");
  expect(saveErrorKey("   ", "2026-08-01")).toBe("cal.err.needTitle");
  expect(saveErrorKey(title, "")).toBe("cal.err.date");
});

test("every cal.row string has its own Hebrew", () => {
  const keys = (Object.keys(MESSAGES.en) as MessageKey[]).filter((key) =>
    key.startsWith("cal.row.")
  );
  expect(keys.length).toBe(12);
  for (const key of keys) {
    // {title} is the event's own name, filled in.
    const words =
      he(key)
        .replace("{title}", " ")
        .match(/[A-Za-z]+/g) ?? [];
    expect({ key, words }).toEqual({ key, words: [] });
    expect({ key, same: he(key) === en(key) }).toEqual({ key, same: false });
  }
});
