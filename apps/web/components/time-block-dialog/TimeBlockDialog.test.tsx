/**
 * Vitest and Testing Library are not dependencies in this repo. bun:test plus react-dom/server
 * renders the time-block dialog /plan opens, in English and Hebrew, to add a block and to edit
 * one. Every label comes from en/he copy, Hebrew has no English left besides what the person
 * wrote, and times read 12:00 AM in English and the 24-hour 00:00 in Hebrew.
 *
 * Radix renders a dialog through a portal, and a portal draws nothing without a DOM. A static
 * stand-in for @radix-ui/react-dialog lets the real components/ui/dialog wrapper render inline,
 * so its built-in close button would show up here too. Errors, the delete question and
 * "Saving…" need a click, which a static render can't make: the error copy is checked through
 * the dialog's own helpers, and every key is checked to be used by the dialog.
 */
import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { anyApi, componentsGeneric, getFunctionName } from "convex/server";
import { createElement, forwardRef, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Doc } from "@/convex/_generated/dataModel";
import { type Lang, MESSAGES, type MessageKey, translate } from "@/lib/i18n";
import { parseBlockForm } from "./blockForm";

const DAY = "2026-10-16";
const TASKS = [{ _id: "task-1", title: "Dentist forms" }];
const HABITS = [{ _id: "habit-1", name: "Stretch" }];
const BLOCK = {
  _id: "block-1",
  _creationTime: 0,
  userId: "user-1",
  localDate: DAY,
  title: "Write report",
  kind: "habit",
  status: "planned",
  startMinute: 780,
  durationMinutes: 60,
  startsAtMs: new Date(2026, 9, 16, 13, 0).getTime(),
  endsAtMs: new Date(2026, 9, 16, 14, 0).getTime(),
} as unknown as Doc<"timeBlocks">;
/** What the person wrote: the block, task and habit names. */
const USER_TEXT = ["Write report", "Dentist forms", "Stretch"];

let lang: Lang = "en";

// The same api as convex/_generated/api.js, so a partial api mock left by another test file
// in the same bun process cannot hide these functions.
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
      case "tasks:listToday":
        return TASKS;
      case "habits:list":
        return HABITS;
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

type StubProps = { children?: ReactNode; onOpenAutoFocus?: unknown } & Record<string, unknown>;

/** A plain element in place of a Radix part; drops the Radix-only focus handler. */
function stub(tag: string, fixed: Record<string, unknown> = {}) {
  return forwardRef<Element, StubProps>(function Stub({ onOpenAutoFocus: _focus, ...props }, ref) {
    return createElement(tag, { ...fixed, ...props, ref });
  });
}

const passThrough = ({ children }: { children?: ReactNode }) => children;

mock.module("@radix-ui/react-dialog", () => ({
  Root: passThrough,
  Portal: passThrough,
  Trigger: stub("button", { type: "button" }),
  Overlay: stub("div"),
  Content: stub("div", { role: "dialog" }),
  Close: stub("button", { type: "button" }),
  Title: stub("h2"),
  Description: stub("p"),
}));

const { TimeBlockDialog, fieldErrorKeys, fillTimes } = await import("./TimeBlockDialog");

function render(nextLang: Lang, block?: Doc<"timeBlocks">): string {
  lang = nextLang;
  return renderToStaticMarkup(
    createElement(TimeBlockDialog, {
      open: true,
      onOpenChange: () => undefined,
      localDate: DAY,
      initialStartMinute: block ? undefined : 540,
      block,
    }) as ReactElement
  );
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
  const attributes = [...html.matchAll(/\s(?:aria-label|placeholder|title)="([^"]*)"/g)].map(
    (match) => match[1]
  );
  return decode([html.replace(/<[^>]*>/g, " "), ...attributes].join(" "));
}

/** The opening tag of the input with this id. */
function inputTag(html: string, id: string): string {
  return html.match(new RegExp(`<input[^>]*\\sid="${id}"[^>]*>`))?.[0] ?? "";
}

/** What is left after removing what the person wrote. */
function copyOnly(html: string): string {
  let text = readable(html);
  for (const own of USER_TEXT) text = text.split(own).join(" ");
  return text;
}

const TIME_BLOCK_KEYS = (Object.keys(MESSAGES.en) as MessageKey[]).filter((key) =>
  key.startsWith("timeBlock.")
);

describe("en/he copy for the time-block dialog", () => {
  test("every timeBlock key has its own Hebrew, with no Latin letters and the same placeholders", () => {
    expect(TIME_BLOCK_KEYS.length).toBeGreaterThanOrEqual(32);
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of TIME_BLOCK_KEYS) {
      const en = MESSAGES.en[key];
      const he = MESSAGES.he[key];
      expect(he.length).toBeGreaterThan(0);
      expect(he).not.toBe(en);
      expect(placeholders(he)).toEqual(placeholders(en));
      expect(he.replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
    }
  });

  test("the dialog uses every timeBlock key and hard-codes none of its English", () => {
    const source = readFileSync(join(import.meta.dir, "TimeBlockDialog.tsx"), "utf8");
    for (const key of TIME_BLOCK_KEYS) {
      expect(source).toContain(`"${key}"`);
      const en = MESSAGES.en[key];
      const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(source).not.toMatch(new RegExp(`"${escaped}"|>\\s*${escaped}\\s*<`));
    }
  });
});

describe("TimeBlockDialog", () => {
  test("adding a block keeps its English words", () => {
    const html = decode(render("en"));
    expect(html).toContain('role="dialog"');
    expect(html).toContain(">New time block</h2>");
    expect(html).toContain(">Set aside a slot for a task, habit or focus time.</p>");
    expect(html).toContain('<span class="sr-only">Close</span>');
    expect(html).toContain('for="time-block-title">Title</label>');
    expect(html).toContain('for="time-block-start">Start time</label>');
    expect(html).toContain('for="time-block-kind">Type</label>');
    expect(html).toContain('for="time-block-duration">Length (minutes)</label>');
    expect(html).toContain('for="time-block-task">Link a task</label>');
    expect(html).toContain('for="time-block-habit">Link a habit</label>');
    expect(html).toContain('<option value="" selected="">No task</option>');
    expect(html).toContain('<option value="" selected="">No habit</option>');
    expect(html).toContain('<option value="task-1">Dentist forms</option>');
    expect(html).toContain('<option value="habit-1">Stretch</option>');
    expect(html).toContain('<option value="focus" selected="">Focus</option>');
    for (const [kind, word] of [
      ["task", "Task"],
      ["habit", "Habit"],
      ["break", "Break"],
      ["other", "Other"],
    ]) {
      expect(html).toContain(`<option value="${kind}">${word}</option>`);
    }
    expect(inputTag(html, "time-block-start")).toContain('type="time"');
    expect(inputTag(html, "time-block-start")).toContain('value="09:00"');
    for (const minutes of [15, 30, 60, 90]) expect(html).toContain(`>${minutes}</button>`);
    expect(html).toContain(">Cancel</button>");
    expect(html).toContain(">Add block</button>");
    expect(html).not.toContain("Delete block");
    // One close button: the dialog's own, not the wrapper's English one as well.
    expect(html.match(/class="sr-only"/g)).toHaveLength(1);
  });

  test("adding a block reads in Hebrew, with no English left", () => {
    const raw = render("he");
    const html = decode(raw);
    const he = (key: MessageKey) => translate("he", key);
    expect(html).toContain(`>${he("timeBlock.newTitle")}</h2>`);
    expect(html).toContain(`>${he("timeBlock.description")}</p>`);
    expect(html).toContain(`<span class="sr-only">${he("timeBlock.close")}</span>`);
    expect(html).toContain(`for="time-block-title">${he("timeBlock.field.title")}</label>`);
    expect(html).toContain(`for="time-block-start">${he("timeBlock.field.start")}</label>`);
    expect(html).toContain(`for="time-block-kind">${he("timeBlock.field.kind")}</label>`);
    expect(html).toContain(`for="time-block-duration">${he("timeBlock.field.length")}</label>`);
    expect(html).toContain(`for="time-block-task">${he("timeBlock.field.task")}</label>`);
    expect(html).toContain(`for="time-block-habit">${he("timeBlock.field.habit")}</label>`);
    expect(html).toContain(`<option value="" selected="">${he("timeBlock.noTask")}</option>`);
    expect(html).toContain(`<option value="" selected="">${he("timeBlock.noHabit")}</option>`);
    expect(html).toContain(
      `<option value="focus" selected="">${he("timeBlock.kind.focus")}</option>`
    );
    for (const kind of ["task", "habit", "break", "other"] as const) {
      expect(html).toContain(`<option value="${kind}">${he(`timeBlock.kind.${kind}`)}</option>`);
    }
    // The form's value stays HH:MM, whatever the language.
    expect(inputTag(html, "time-block-start")).toContain('type="time"');
    expect(inputTag(html, "time-block-start")).toContain('value="09:00"');
    expect(html).toContain(`>${he("timeBlock.cancel")}</button>`);
    expect(html).toContain(`>${he("timeBlock.add")}</button>`);
    expect(html.match(/class="sr-only"/g)).toHaveLength(1);
    expect(copyOnly(raw)).not.toMatch(/[A-Za-z]/);
  });

  test("editing a block keeps its English words and its fields", () => {
    const html = decode(render("en", BLOCK));
    expect(html).toContain(">Edit time block</h2>");
    expect(html).toContain('value="Write report"');
    expect(inputTag(html, "time-block-start")).toContain('value="13:00"');
    expect(inputTag(html, "time-block-duration")).toContain('value="60"');
    expect(html).toContain('<option value="habit" selected="">Habit</option>');
    expect(html).toContain(">Delete block</button>");
    expect(html).toContain(">Cancel</button>");
    expect(html).toContain(">Save changes</button>");
    expect(html).not.toContain("Link a task");
    expect(html).not.toContain("Link a habit");
    expect(html).not.toContain("Add block");
  });

  test("editing a block reads in Hebrew, with no English left besides its title", () => {
    const raw = render("he", BLOCK);
    const html = decode(raw);
    const he = (key: MessageKey) => translate("he", key);
    expect(html).toContain(`>${he("timeBlock.editTitle")}</h2>`);
    expect(html).toContain('value="Write report"');
    expect(html).toContain(
      `<option value="habit" selected="">${he("timeBlock.kind.habit")}</option>`
    );
    expect(html).toContain(`>${he("timeBlock.delete")}</button>`);
    expect(html).toContain(`>${he("timeBlock.cancel")}</button>`);
    expect(html).toContain(`>${he("timeBlock.save")}</button>`);
    expect(html).not.toContain(he("timeBlock.field.task"));
    expect(copyOnly(raw)).not.toMatch(/[A-Za-z]/);
  });

  test("a closed dialog draws nothing", () => {
    lang = "he";
    const html = renderToStaticMarkup(
      createElement(TimeBlockDialog, {
        open: false,
        onOpenChange: () => undefined,
        localDate: DAY,
      }) as ReactElement
    );
    expect(html).toBe("");
  });
});

describe("error copy", () => {
  const form = {
    localDate: DAY,
    title: "Write report",
    start: "09:00",
    durationMinutes: 30,
    kind: "focus" as const,
  };

  test("each field error maps to its key, never to blockForm's English", () => {
    const empty = parseBlockForm({ ...form, title: "  ", start: "", durationMinutes: 3 });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(fieldErrorKeys(empty.errors, 3)).toEqual({
      title: "timeBlock.error.title",
      start: "timeBlock.error.start",
      durationMinutes: "timeBlock.error.length",
    });

    const late = parseBlockForm({ ...form, start: "23:30", durationMinutes: 60 });
    expect(late.ok).toBe(false);
    if (late.ok) return;
    expect(fieldErrorKeys(late.errors, 60)).toEqual({
      durationMinutes: "timeBlock.error.pastMidnight",
    });

    const noKind = parseBlockForm({ ...form, kind: "nap" as never });
    expect(noKind.ok).toBe(false);
    if (noKind.ok) return;
    expect(fieldErrorKeys(noKind.errors, 30)).toEqual({ kind: "timeBlock.error.kind" });

    expect(fieldErrorKeys({}, 30)).toEqual({});
  });

  test("the start-time error reads the day's bounds in the app language's clock", () => {
    expect(fillTimes(translate("en", "timeBlock.error.start"), "en")).toBe(
      "Pick a start time between 12:00 AM and 11:59 PM."
    );
    const he = fillTimes(translate("he", "timeBlock.error.start"), "he");
    expect(he).toBe("צריך לבחור שעת התחלה בין 00:00 ל־23:59.");
    expect(he).not.toMatch(/\b(AM|PM)\b/);
    expect(fillTimes(translate("he", "timeBlock.error.title"), "he")).toBe(
      translate("he", "timeBlock.error.title")
    );
  });
});
