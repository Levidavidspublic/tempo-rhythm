/**
 * Vitest and Testing Library are not dependencies in this repo. bun:test plus react-dom/server
 * renders Today's day plan (the panel and the "Your day" summary) with long unbroken user text,
 * in English and Hebrew: that text carries the wrap classes, and Hebrew has no English label left.
 * Effects do not run in a static render, so the panel's intention field stays empty here; a value
 * in an <input> scrolls inside the field and cannot widen the page.
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
import { anyApi, componentsGeneric, getFunctionName } from "convex/server";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type Lang, type MessageKey, translate } from "@/lib/i18n";

const INTENTION = "i".repeat(500);
const TASK_TITLE = "t".repeat(300);
const BLOCK_TITLE = "b".repeat(300);
const USER_TEXT = [INTENTION, TASK_TITLE, BLOCK_TITLE, "Water"];

type Plan = {
  localDate: string;
  intention?: string;
  topTaskIds?: string[];
  energy?: "low" | "medium" | "high";
  status: "draft" | "committed";
};

let lang: Lang = "en";
let plan: Plan = { localDate: "2026-10-16", status: "draft" };
let tasks = [
  { _id: "task-long", title: TASK_TITLE, status: "todo" },
  { _id: "task-short", title: "Water", status: "done" },
];
// Starts at 23:59 and runs an hour, so it is still "up next" whenever the test runs.
const blocks = [
  {
    _id: "block-long",
    title: BLOCK_TITLE,
    startMinute: 1439,
    durationMinutes: 60,
    status: "planned",
  },
];

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "convex/react": { ...(await import("convex/react")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

// The same api as convex/_generated/api.js, so a partial api mock left by another test file
// in the same bun process cannot hide the day-plan functions.
mock.module("@/convex/_generated/api", () => ({
  api: anyApi,
  internal: anyApi,
  components: componentsGeneric(),
}));

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(ref)) {
      case "users:getProfile":
        return { _id: "user-1" };
      case "dayPlans:getForDate":
        return plan;
      case "tasks:listToday":
        return tasks;
      case "dayPlans:listCarryOver":
        return [];
      case "timeBlocks:listForDate":
        return blocks;
      default:
        return undefined;
    }
  },
  useMutation: () => async () => null,
}));

mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { DayPlanPanel } = await import("@/components/day-plan-panel/DayPlanPanel");
const { DayPlanSummary } = await import("./DayPlanSummary");

function render(component: () => ReactElement | null, nextLang: Lang): string {
  lang = nextLang;
  return renderToStaticMarkup(createElement(component) as ReactElement);
}

/** The opening tag of the element whose whole text is `text`. */
function openingTagOf(html: string, text: string): string {
  const end = html.indexOf(`>${text}<`);
  if (end < 0) throw new Error(`Missing text: ${text.slice(0, 12)}…`);
  return html.slice(html.lastIndexOf("<", end), end + 1);
}

function decode(value: string): string {
  return value
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Everything a person reads or hears: text nodes plus aria-label and placeholder values. */
function readable(html: string): string {
  const attributes = [...html.matchAll(/\s(?:aria-label|placeholder)="([^"]*)"/g)].map(
    (match) => match[1]
  );
  return decode([html.replace(/<[^>]*>/g, " "), ...attributes].join(" "));
}

/** What is left after removing what the person wrote. */
function copyOnly(html: string): string {
  let text = readable(html);
  for (const own of USER_TEXT) text = text.split(own).join(" ");
  return text;
}

const PANEL_KEYS: MessageKey[] = [
  "dp.title",
  "dp.sub",
  "dp.intention",
  "dp.intention.ph",
  "dp.energy",
  "dp.energy.low",
  "dp.energy.medium",
  "dp.energy.high",
  "dp.commit",
];
const SUMMARY_KEYS: MessageKey[] = [
  "dp.summary",
  "dp.badge.high",
  "dp.upNext",
  "dp.done",
  "dp.letGo",
];

function expectWraps(html: string, text: string) {
  const tag = openingTagOf(html, text);
  expect(tag).toContain("wrap-anywhere");
  expect(tag).toContain('dir="auto"');
}

describe("DayPlanPanel", () => {
  test("a long task title wraps inside the card, in English and Hebrew", () => {
    plan = { localDate: "2026-10-16", intention: INTENTION, status: "draft" };
    for (const next of ["en", "he"] as const) {
      const html = render(DayPlanPanel, next);
      const title = openingTagOf(html, TASK_TITLE);
      expect(title).toContain("min-w-0");
      expectWraps(html, TASK_TITLE);
      // Fieldsets are as wide as their widest word unless min-w-0 says otherwise.
      expect(html.match(/<fieldset class="min-w-0[^"]*"/g)?.length).toBe(2);
      expect(html).toMatch(/<input[^>]*dir="auto"[^>]*id="day-plan-intention"/);
    }
  });

  test("English reads from the en copy", () => {
    plan = { localDate: "2026-10-16", status: "draft" };
    const html = render(DayPlanPanel, "en");
    for (const key of PANEL_KEYS) expect(decode(html)).toContain(translate("en", key));
    expect(html).toContain("Pick up to 3");
  });

  test("Hebrew has no English label left, while drafting, when set, and with no tasks", () => {
    plan = { localDate: "2026-10-16", intention: INTENTION, status: "draft" };
    const draft = render(DayPlanPanel, "he");
    for (const key of PANEL_KEYS) expect(draft).toContain(translate("he", key));
    expect(draft).toContain("אפשר לבחור עד 3");

    plan = { localDate: "2026-10-16", intention: INTENTION, status: "committed", energy: "low" };
    const set = render(DayPlanPanel, "he");
    expect(set).toContain(translate("he", "dp.set"));
    expect(set).toContain(translate("he", "dp.edit"));

    const saved = tasks;
    tasks = [];
    const empty = render(DayPlanPanel, "he");
    tasks = saved;
    expect(empty).toContain(translate("he", "dp.noTasks"));

    for (const html of [draft, set, empty]) {
      expect(copyOnly(html)).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("DayPlanSummary", () => {
  const committed: Plan = {
    localDate: "2026-10-16",
    intention: INTENTION,
    topTaskIds: ["task-long", "task-short"],
    energy: "high",
    status: "committed",
  };

  test("a 500-character intention and long titles wrap inside the card, in English and Hebrew", () => {
    plan = committed;
    for (const next of ["en", "he"] as const) {
      const html = render(DayPlanSummary, next);
      const intention = openingTagOf(html, INTENTION);
      expect(intention.startsWith("<blockquote")).toBe(true);
      expectWraps(html, INTENTION);
      // The intention's flex column may shrink below its widest word.
      expect(html).toContain('<div class="min-w-0"><h2');
      expectWraps(html, TASK_TITLE);
      expect(openingTagOf(html, TASK_TITLE)).toContain("min-w-0");
      expectWraps(html, BLOCK_TITLE);
    }
  });

  test("English reads from the en copy", () => {
    plan = committed;
    const html = render(DayPlanSummary, "en");
    for (const key of SUMMARY_KEYS) expect(html).toContain(translate("en", key));
    expect(html).toContain("1 of 2 done");
    expect(html).toContain("11:59 PM – 12:59 AM");
    expect(html).toContain(`aria-label="Mark ${TASK_TITLE} done"`);
    expect(html).toContain(`aria-label="Let ${BLOCK_TITLE} go"`);
  });

  test("Hebrew has no English label left", () => {
    plan = committed;
    const html = render(DayPlanSummary, "he");
    for (const key of SUMMARY_KEYS) expect(html).toContain(translate("he", key));
    expect(html).toContain("1 מתוך 2 בוצעו");
    expect(html).toContain("23:59 – 00:59");
    expect(html).toContain(`aria-label="לסמן את ${TASK_TITLE} כבוצע"`);
    expect(copyOnly(html)).not.toMatch(/[A-Za-z]/);
  });

  test("nothing shows until the day is set", () => {
    plan = { ...committed, status: "draft" };
    expect(render(DayPlanSummary, "he")).toBe("");
  });
});
