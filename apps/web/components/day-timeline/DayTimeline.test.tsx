/**
 * Vitest and Testing Library are not dependencies in this repo. bun:test plus react-dom/server
 * renders /plan's day timeline and /coach's push dial in English and Hebrew: every label comes
 * from en/he copy, Hebrew has no English label left, and times read 9:00 AM in English and the
 * 24-hour 09:00 in Hebrew. Effects do not run in a static render, so the "Now" marker and the
 * localized date line (both wait for mount) are checked as copy, not as rendered markup.
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
import { anyApi, componentsGeneric, getFunctionName } from "convex/server";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type Lang, MESSAGES, type MessageKey, translate } from "@/lib/i18n";

const DAY = "2026-10-14";
const USER_TEXT = ["Write", "Walk", "Call", "Dentist"];

type Block = {
  _id: string;
  title: string;
  kind: "focus" | "task" | "habit" | "break" | "other";
  status: "planned" | "done" | "skipped";
  startMinute: number;
  durationMinutes: number;
};

// A 60-minute card shows its time on its own line, 30 minutes stacks, 15 minutes is one line.
const BLOCKS: Block[] = [
  {
    _id: "b-full",
    title: "Write",
    kind: "focus",
    status: "done",
    startMinute: 540,
    durationMinutes: 60,
  },
  {
    _id: "b-stacked",
    title: "Walk",
    kind: "habit",
    status: "skipped",
    startMinute: 780,
    durationMinutes: 30,
  },
  {
    _id: "b-compact",
    title: "Call",
    kind: "task",
    status: "planned",
    startMinute: 1020,
    durationMinutes: 15,
  },
];
const EVENTS = [
  { _id: "e-1", title: "Dentist", startsAtMs: new Date(2026, 9, 14, 15, 30).getTime() },
];

let lang: Lang = "en";
let auth = { isAuthenticated: true, isLoading: false };
let blocks: Block[] = BLOCKS;
let events = EVENTS;
let settings: { dial: number; panicUntil: number | null } | undefined;

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
// in the same bun process cannot hide these functions.
mock.module("@/convex/_generated/api", () => ({
  api: anyApi,
  internal: anyApi,
  components: componentsGeneric(),
}));

mock.module("convex/react", () => ({
  useConvexAuth: () => auth,
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(ref)) {
      case "users:getProfile":
        return { _id: "user-1" };
      case "timeBlocks:listForDate":
        return blocks;
      case "calendar_events:listInRange":
        return events;
      case "coach:getSettings":
        return settings;
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

const { DayTimeline } = await import("./DayTimeline");
const { CoachControls } = await import("@/components/coach-controls/CoachControls");

function renderTimeline(nextLang: Lang, localDate = DAY): string {
  lang = nextLang;
  return renderToStaticMarkup(createElement(DayTimeline, { localDate }) as ReactElement);
}

function renderControls(nextLang: Lang): string {
  lang = nextLang;
  return renderToStaticMarkup(createElement(CoachControls) as ReactElement);
}

function decode(value: string): string {
  return value
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Everything a person reads or hears: text nodes plus aria-label and aria-valuetext values. */
function readable(html: string): string {
  const attributes = [...html.matchAll(/\s(?:aria-label|aria-valuetext)="([^"]*)"/g)].map(
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

function keysWith(prefix: string): MessageKey[] {
  return (Object.keys(MESSAGES.en) as MessageKey[]).filter((key) => key.startsWith(prefix));
}

describe("en/he copy for the timeline and the coach controls", () => {
  test("every key has Hebrew with no Latin letters and the same placeholders", () => {
    const keys = [...keysWith("timeline."), ...keysWith("coachCtl.")];
    expect(keys.length).toBeGreaterThanOrEqual(30);
    for (const key of keys) {
      const en = MESSAGES.en[key];
      const he = MESSAGES.he[key];
      expect(he.length).toBeGreaterThan(0);
      expect(he).not.toBe(en);
      const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
      expect(placeholders(he)).toEqual(placeholders(en));
      expect(he.replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
    }
    expect(translate("he", "timeline.now")).toBe("עכשיו");
  });
});

describe("DayTimeline", () => {
  test("English keeps its words and reads 12-hour times", () => {
    auth = { isAuthenticated: true, isLoading: false };
    blocks = BLOCKS;
    events = EVENTS;
    const html = decode(renderTimeline("en"));
    expect(html).toContain('aria-label="Day timeline"');
    expect(html).toContain(">Day timeline</h2>");
    expect(html).toContain('aria-label="Add a block at 12:00 AM"');
    expect(html).toContain('aria-label="Add a block at 9:00 AM"');
    expect(html).toContain('aria-label="Add a block at 1:00 PM"');
    expect(html).toContain(">11:00 PM</span>");
    expect(html).toContain('<span class="tp-num">9:00 AM–10:00 AM</span> · Done');
    expect(html).toContain('aria-label="Write, 9:00 AM–10:00 AM"');
    expect(html).toContain('aria-label="Done 9:00 AM–10:00 AM"');
    expect(html).toContain('aria-label="Let it go 9:00 AM–10:00 AM"');
    expect(html).toContain('aria-label="Undo 9:00 AM–10:00 AM"');
    expect(html).toContain('aria-label="Walk, 1:00 PM–1:30 PM, Let go"');
    expect(html).toContain('Walk · <span class="tp-num">1:00 PM–1:30 PM</span> · Let go');
    expect(html).toContain('Call · <span class="tp-num">5:00 PM–5:15 PM</span>');
    expect(html).toContain(">3:30 PM</p>");
    for (const word of [">Done<", ">Let it go<", ">Undo<"]) expect(html).toContain(word);
    expect(html).not.toContain("Nothing planned yet");
  });

  test("Hebrew has no English label left and reads 24-hour times", () => {
    auth = { isAuthenticated: true, isLoading: false };
    blocks = BLOCKS;
    events = EVENTS;
    const raw = renderTimeline("he");
    const html = decode(raw);
    expect(html).toContain(`aria-label="${translate("he", "timeline.title")}"`);
    expect(html).toContain(`>${translate("he", "timeline.title")}</h2>`);
    expect(html).toContain('aria-label="להוסיף בלוק זמן בשעה 00:00"');
    expect(html).toContain('aria-label="להוסיף בלוק זמן בשעה 09:00"');
    expect(html).toContain('aria-label="להוסיף בלוק זמן בשעה 13:00"');
    expect(html).toContain(">23:00</span>");
    // The range is an isolated LTR run, so it never reads 10:00–09:00 on a right-to-left page.
    expect(html).toContain('<span class="tp-num">09:00–10:00</span> · בוצע');
    expect(html).toContain('aria-label="Write, 09:00–10:00"');
    expect(html).toContain('aria-label="בוצע 09:00–10:00"');
    expect(html).toContain('aria-label="לשחרר 09:00–10:00"');
    expect(html).toContain('aria-label="ביטול 09:00–10:00"');
    expect(html).toContain('aria-label="Walk, 13:00–13:30, שוחרר"');
    expect(html).toContain('<span class="tp-num">17:00–17:15</span>');
    expect(html).toContain(">15:30</p>");
    for (const key of ["timeline.done", "timeline.letGo", "timeline.undo"] as const) {
      expect(html).toContain(`>${translate("he", key)}<`);
    }
    expect(html).not.toMatch(/\b(AM|PM)\b/);
    expect(copyOnly(raw)).not.toMatch(/[A-Za-z]/);
  });

  test("an empty day says so, in English and Hebrew", () => {
    auth = { isAuthenticated: true, isLoading: false };
    blocks = [];
    events = [];
    expect(decode(renderTimeline("en"))).toContain(
      "Nothing planned yet. Click a time to add a block."
    );
    const he = renderTimeline("he");
    expect(he).toContain(translate("he", "timeline.empty"));
    expect(copyOnly(he)).not.toMatch(/[A-Za-z]/);
    blocks = BLOCKS;
    events = EVENTS;
  });

  test("signed out, loading and a bad date read in Hebrew too", () => {
    auth = { isAuthenticated: false, isLoading: false };
    const signedOutEn = decode(renderTimeline("en"));
    expect(signedOutEn).toContain("Sign in to see this day's blocks and events.");
    expect(signedOutEn).toContain(">Sign in</a>");
    const signedOut = renderTimeline("he");
    expect(signedOut).toContain(translate("he", "timeline.signedOut"));
    expect(signedOut).toContain(`>${translate("he", "timeline.signIn")}</a>`);

    auth = { isAuthenticated: false, isLoading: true };
    const loading = renderTimeline("he");
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain(`aria-label="${translate("he", "timeline.title")}"`);

    auth = { isAuthenticated: true, isLoading: false };
    expect(decode(renderTimeline("en", "2026-02-31"))).toContain("That date doesn't look right.");
    const badDate = renderTimeline("he", "2026-02-31");
    expect(badDate).toContain(translate("he", "timeline.badDate"));

    for (const html of [signedOut, loading, badDate]) {
      expect(copyOnly(html)).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("CoachControls", () => {
  test("English keeps its words, and the dial keeps its range and aria values", () => {
    auth = { isAuthenticated: true, isLoading: false };
    settings = { dial: 5, panicUntil: null };
    const html = decode(renderControls("en"));
    expect(html).toContain(">How the coach pushes</h2>");
    expect(html).toContain(">How the coach pushes</label>");
    expect(html).toContain("0 is gentle. 10 is firm. Let go of the slider to save.");
    expect(html).toContain('<span class="font-medium">Steady</span>');
    expect(html).toContain('aria-valuetext="Steady, 5"');
    expect(html).toMatch(/<input id="coach-push-dial" type="range" min="0" max="10" step="1"/);
    expect(html).toContain('aria-describedby="coach-push-dial-hint"');
    expect(html).toContain('id="coach-push-dial-hint"');
    expect(html).toContain(">Panic</button>");
    expect(html).toContain("One small action, then the coach stays quiet until you clear it.");
  });

  test("Hebrew has no English label left, at every level and during panic", () => {
    auth = { isAuthenticated: true, isLoading: false };
    const levels = [
      [2, "coachCtl.level.gentle"],
      [5, "coachCtl.level.steady"],
      [9, "coachCtl.level.firm"],
    ] as const;
    const pages: string[] = [];
    for (const [dial, key] of levels) {
      settings = { dial, panicUntil: null };
      const html = renderControls("he");
      expect(html).toContain(`aria-valuetext="${translate("he", key)}, ${dial}"`);
      expect(html).toContain(`>${translate("he", "coachCtl.panic")}</button>`);
      expect(html).toContain(translate("he", "coachCtl.hint"));
      pages.push(html);
    }

    // Partial minutes round up, so 9.5 minutes reads as 10.
    settings = { dial: 5, panicUntil: Date.now() + 9.5 * 60_000 };
    const panicEn = decode(renderControls("en"));
    expect(panicEn).toContain("Take a breath. Nothing is due right now.");
    expect(panicEn).toContain("10 minutes left");
    expect(panicEn).toContain(">I’m okay now</button>");
    const panic = renderControls("he");
    expect(panic).toContain(translate("he", "coachCtl.panicFallback"));
    expect(panic).toContain("נשארו 10 דקות");
    expect(panic).toContain(`>${translate("he", "coachCtl.clear")}</button>`);
    pages.push(panic);

    settings = { dial: 5, panicUntil: Date.now() + 30_000 };
    expect(decode(renderControls("en"))).toContain("1 minute left");
    const lastMinute = renderControls("he");
    expect(lastMinute).toContain(translate("he", "coachCtl.minutes.one"));
    pages.push(lastMinute);

    settings = undefined;
    expect(decode(renderControls("en"))).toContain("Loading your coach settings.");
    const loading = renderControls("he");
    expect(loading).toContain(translate("he", "coachCtl.loading"));
    pages.push(loading);

    for (const html of pages) expect(copyOnly(html)).not.toMatch(/[A-Za-z]/);
  });
});
