/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the
 * habit streak card: no "Longest among 0 habits: 0." line, 1+ habits unchanged.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fillTemplate } from "@/lib/habits-view";
import { type Lang, MESSAGES, type MessageKey, translate } from "@/lib/i18n";

type Streak = { streakCount: number; longestAmongHabits: number; habitCount: number };

let lang: Lang = "en";
let streak: Streak = { streakCount: 0, longestAmongHabits: 0, habitCount: 0 };

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (ref: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (ref === "users.getProfile") return { _id: "user_1" };
    if (ref === "streaks.getCurrent") return streak;
    if (ref === "focusBlocks.listInRange") return [];
    return undefined;
  },
  useMutation: () => async () => ({}),
}));
mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    streaks: { getCurrent: "streaks.getCurrent" },
    focusBlocks: {
      listInRange: "focusBlocks.listInRange",
      create: "focusBlocks.create",
      remove: "focusBlocks.remove",
      restore: "focusBlocks.restore",
    },
  },
}));
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => "/tracking",
  useSearchParams: () => new URLSearchParams(),
}));
mock.module("next/link", () => ({
  default: (props: { href: string; className?: string; children?: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { TrackingDashboard } = await import("./TrackingDashboard");

/** Text of the streak card's note: the paragraph that links to /habits. */
function streakNote(): string {
  const html = renderToStaticMarkup(createElement(TrackingDashboard));
  const paragraph = html.match(
    /<p class="mt-2[^"]*">((?:(?!<\/p>)[\s\S])*?href="\/habits"[\s\S]*?)<\/p>/
  );
  expect(paragraph).not.toBeNull();
  return (paragraph?.[1] ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The "Longest among …" line as it read before this fix: the locale's own copy once /tracking
 * reads its strings from i18n, otherwise the page's English.
 */
function longestLine(n: number, longest: number): string {
  const key = n === 1 ? "track.longest.one" : "track.longest.many";
  const fallback =
    n === 1 ? "Longest among 1 habit: {longest}." : "Longest among {n} habits: {longest}.";
  const template = (MESSAGES[lang] as Record<string, string | undefined>)[key] ?? fallback;
  return fillTemplate(template, { n, longest });
}

beforeEach(() => {
  lang = "en";
  streak = { streakCount: 0, longestAmongHabits: 0, habitCount: 0 };
});

describe("TrackingDashboard habit streak card", () => {
  test("en: 1 and 3 habits read exactly as before", () => {
    streak = { streakCount: 2, longestAmongHabits: 4, habitCount: 1 };
    expect(streakNote()).toBe(
      "Longest among 1 habit: 4. Streaks are information, not pressure. Open habits"
    );
    streak = { streakCount: 5, longestAmongHabits: 9, habitCount: 3 };
    expect(streakNote()).toBe(
      "Longest among 3 habits: 9. Streaks are information, not pressure. Open habits"
    );
  });

  for (const testLang of ["en", "he"] as const) {
    test(`${testLang}: 0 habits shows no "Longest" line, and the rest of the note stays`, () => {
      lang = testLang;
      streak = { streakCount: 2, longestAmongHabits: 4, habitCount: 1 };
      const withOne = streakNote();
      streak = { streakCount: 0, longestAmongHabits: 0, habitCount: 0 };
      const withNone = streakNote();
      expect(withNone).not.toContain("Longest");
      // "Longest among 0 habits: 0." was the only number in this note.
      expect(withNone).not.toMatch(/\d/);
      expect(withNone).toBe(withOne.slice(longestLine(1, 4).length).trim());
    });

    test(`${testLang}: 1 habit keeps its "Longest" line`, () => {
      lang = testLang;
      streak = { streakCount: 2, longestAmongHabits: 4, habitCount: 1 };
      expect(streakNote()).toStartWith(`${longestLine(1, 4)} `);
    });

    test(`${testLang}: 3 habits keep their "Longest" line`, () => {
      lang = testLang;
      streak = { streakCount: 5, longestAmongHabits: 9, habitCount: 3 };
      expect(streakNote()).toStartWith(`${longestLine(3, 9)} `);
    });
  }
});
