/**
 * Today's habit check-in strip on a phone (TEMPO-B07-34, #1043). At 390 px a long habit name pushed
 * the row's "Check" label past the edge of the page, in English and in Hebrew. bun:test has no
 * layout engine, so this renders the strip with a 60-character name that has no break in it and
 * checks the classes that keep the row inside: the name may shrink and wrap anywhere, the label
 * keeps its width. The browser measurement at 390 px is the conductor's.
 */
import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** 60 characters, no space and no hyphen: nothing to break the line at. */
const LONG_NAME = "Drinkaglassofwaterbeforecoffeeandstretchforfiveminuteseveryd";
const SHORT_NAME = "Walk";

type Habit = { _id: string; name: string; currentStreak: number; deletedAt?: number };
let habits: Habit[] = [];
let checkIns: { habitId: string }[] = [];

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (ref === "users.getProfile") return { _id: "users:1" };
    if (ref === "habits.list") return habits;
    if (ref === "habitCheckIns.listForDate") return checkIns;
    return undefined;
  },
  useMutation: () => async () => ({ currentStreak: 0 }),
}));

mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    habits: { list: "habits.list" },
    habitCheckIns: { listForDate: "habitCheckIns.listForDate", check: "habitCheckIns.check", undo: "habitCheckIns.undo" },
  },
}));

const { translate } = await import("@/lib/i18n");
const habitsCopy = await import("@/lib/i18n-groups/habits");
type Lang = "en" | "he";
let lang: Lang = "en";
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang: () => {},
    t: (key: Parameters<typeof translate>[1]) => translate(lang, key),
  }),
}));

const { HabitCheckInStrip } = await import("./HabitCheckInStrip");

/** Bun's built-in HTMLRewriter: it matches CSS selectors against the rendered markup. */
// biome-ignore lint/correctness/noUndeclaredVariables: a Bun global (bun-types), unknown to Biome.
const Rewriter = HTMLRewriter;

function unescapeHtml(value: string): string {
  return value
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function render(as: Lang, rows: Habit[], checked: string[] = []): string {
  lang = as;
  habits = rows;
  checkIns = checked.map((habitId) => ({ habitId }));
  return renderToStaticMarkup(createElement(HabitCheckInStrip));
}

type Hit = { className: string; ariaLabel: string; text: string };

/** Every element the selector reaches, in document order, with the text inside it. */
function hits(html: string, selector: string): Hit[] {
  const found: Hit[] = [];
  new Rewriter()
    .on(selector, {
      element(el) {
        found.push({
          className: unescapeHtml(el.getAttribute("class") ?? ""),
          ariaLabel: unescapeHtml(el.getAttribute("aria-label") ?? ""),
          text: "",
        });
      },
      text(chunk) {
        const last = found.at(-1);
        if (last) last.text += unescapeHtml(chunk.text);
      },
    })
    .transform(html);
  return found;
}

/** Everything a person or a screen reader gets: the text, plus every aria-label. */
function readable(html: string): string {
  const all = hits(html, "section");
  const labels = hits(html, "[aria-label]").map((hit) => hit.ariaLabel);
  return [all[0]?.text ?? "", ...labels].join(" ");
}

/** A Hebrew letter (alef to tav). */
const HEBREW = /[\u05D0-\u05EA]/;

const classesOf = (hit: Hit | undefined) => (hit?.className ?? "").split(/\s+/);

const ROWS: Habit[] = [
  { _id: "habits:1", name: LONG_NAME, currentStreak: 5 },
  { _id: "habits:2", name: SHORT_NAME, currentStreak: 2 },
];

describe("the habit name is a 60-character word with no break in it", () => {
  test("it really is", () => {
    expect(LONG_NAME).toHaveLength(60);
    expect(LONG_NAME).toMatch(/^\S+$/);
    expect(LONG_NAME).not.toContain("-");
  });
});

for (const as of ["en", "he"] as const) {
  describe(`habit check-in strip, ${as}`, () => {
    // The long habit is open, the short one is checked: both labels show.
    const html = render(as, ROWS, ["habits:2"]);
    const buttons = hits(html, "li > button");
    // Each row holds two spans: the habit's name, then the Check / Checked label.
    const spans = hits(html, "li > button > span");
    const names = spans.filter((_, i) => i % 2 === 0);
    const labels = spans.filter((_, i) => i % 2 === 1);

    test("each row is a full-width flex button that aligns to the start of the line, not the left", () => {
      expect(buttons).toHaveLength(2);
      for (const button of buttons) {
        const cls = classesOf(button);
        expect(cls).toContain("flex");
        expect(cls).toContain("w-full");
        expect(cls).toContain("justify-between");
        expect(cls).toContain("text-start");
        expect(cls).not.toContain("text-left");
      }
    });

    test("the name may shrink below its longest word and wraps anywhere, so it never pushes the label out", () => {
      expect(names.map((n) => n.text)).toEqual([LONG_NAME, SHORT_NAME]);
      for (const name of names) {
        expect(classesOf(name)).toContain("min-w-0");
        expect(classesOf(name)).toContain("wrap-anywhere");
      }
    });

    test("the label keeps its width (shrink-0), so it stays on the row next to the name", () => {
      expect(labels.map((l) => l.text)).toEqual([translate(as, "hb.strip.check"), translate(as, "hb.strip.checked")]);
      for (const label of labels) expect(classesOf(label)).toContain("shrink-0");
    });

    test("the row's name for screen readers and the streak line come from the page language", () => {
      expect(buttons.map((b) => b.ariaLabel)).toEqual([
        translate(as, "hb.strip.check.sr").replace("{name}", LONG_NAME),
        translate(as, "hb.strip.uncheck.sr").replace("{name}", SHORT_NAME),
      ]);
      expect(hits(html, "li > p").map((p) => p.text)).toEqual([
        translate(as, "hb.strip.streak.many").replace("{n}", "5"),
        translate(as, "hb.strip.streak.many").replace("{n}", "2"),
      ]);
    });

    if (as === "en") {
      test("English reads exactly as before (the e2e sweep looks for these words)", () => {
        expect(hits(html, "h2")[0]?.text).toBe("Habits today");
        expect(labels.map((l) => l.text)).toEqual(["Check", "Checked"]);
        expect(buttons.map((b) => b.ariaLabel)).toEqual([
          `Check ${LONG_NAME} for today`,
          `Undo today's check for ${SHORT_NAME}`,
        ]);
        expect(hits(html, "li > p").map((p) => p.text)).toEqual(["5 days in a row", "2 days in a row"]);
        const empty = render("en", []);
        expect(hits(empty, "section > p").at(-1)?.text).toBe("No habits yet. Add one on the Habits page.");
      });
    } else {
      test("Hebrew has no Latin letters besides the habits' own names, on the rows and on the empty strip", () => {
        const rest = readable(html).replaceAll(LONG_NAME, "").replaceAll(SHORT_NAME, "");
        expect(rest).toMatch(HEBREW);
        expect(rest).not.toMatch(/[A-Za-z]/);
        const empty = readable(render("he", []));
        expect(empty).toContain(translate("he", "hb.strip.emptyLink"));
        expect(empty).not.toMatch(/[A-Za-z]/);
      });
    }
  });
}

describe("the strip's keys", () => {
  const keys = Object.keys(habitsCopy.en).filter((key) => key.startsWith("hb.strip.")) as (keyof typeof habitsCopy.en)[];

  test("are all there, with one and many forms for the streak", () => {
    expect([...keys].sort() as string[]).toEqual(
      [
        "hb.strip.check",
        "hb.strip.check.sr",
        "hb.strip.checked",
        "hb.strip.empty",
        "hb.strip.emptyLink",
        "hb.strip.streak.many",
        "hb.strip.streak.one",
        "hb.strip.sub",
        "hb.strip.title",
        "hb.strip.uncheck.sr",
      ].sort(),
    );
  });

  test("every one has its own Hebrew, with the same {slots} and no Latin", () => {
    const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of keys) {
      const en = habitsCopy.en[key];
      const he = habitsCopy.he[key];
      expect(he).not.toBe(en);
      expect(he).toMatch(HEBREW);
      expect(he.replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
      expect(slots(he)).toEqual(slots(en));
    }
  });
});
