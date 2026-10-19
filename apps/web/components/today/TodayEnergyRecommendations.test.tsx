/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server renders the energy card
 * in English and Hebrew: the header and level buttons, then loading, nothing fits, and
 * the suggestions with their reasons and button labels.
 */
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type EnergyLevel, recommendTasksForEnergy } from "@/lib/energyRecommendations";
import { type Lang, MESSAGES, type MessageKey, translate } from "@/lib/i18n";
import { en as youEn } from "@/lib/i18n-groups/you";

let lang: Lang = "en";
const useQueryCalls: unknown[][] = [];

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    useQueryCalls.push(args);
    return undefined;
  },
  useMutation: () => async () => null,
}));
mock.module("@/convex/_generated/api", () => ({
  api: { tasks: { list: "tasks.list", update: "tasks.update" } },
}));
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { EnergySuggestions, TodayEnergyRecommendations } = await import("./TodayEnergyRecommendations");

const DAY_START = Date.UTC(2026, 9, 16);
const DAY_END = DAY_START + 24 * 60 * 60 * 1000;

function card(): string {
  return renderToStaticMarkup(
    createElement(TodayEnergyRecommendations, {
      dueAt: DAY_END - 1,
      todayStartMs: DAY_START,
      todayEndMs: DAY_END,
    }),
  );
}

/** One task at the picked level (an exact fit) and one at a neighbouring level. */
function suggestions(energy: EnergyLevel, titles: [string, string]) {
  const neighbour: EnergyLevel = energy === "medium" ? "low" : "medium";
  return recommendTasksForEnergy(
    [
      { id: "a", title: titles[0], status: "todo", priority: "high", energy, updatedAt: 1 },
      { id: "b", title: titles[1], status: "todo", priority: "low", energy: neighbour, updatedAt: 2 },
    ],
    { energy, todayStartMs: DAY_START, todayEndMs: DAY_END },
  );
}

function suggestionsMarkup(
  energy: EnergyLevel,
  recommendations: ReturnType<typeof recommendTasksForEnergy> | null,
): string {
  return renderToStaticMarkup(
    createElement(EnergySuggestions, {
      energy,
      recommendations,
      pendingId: null,
      onAccept: () => {},
      onDismiss: () => {},
    }),
  );
}

/** Latin words in the visible text and the labels a screen reader reads, minus product names. */
function latinWords(html: string): string[] {
  const labels = [...html.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => m[1]);
  const text = html.replace(/<[^>]*>/g, " ").replace(/&[#\w]+;/g, " ");
  const words = `${text} ${labels.join(" ")}`.match(/[A-Za-z]+/g) ?? [];
  return words.filter((word) => word !== "Tempo");
}

beforeEach(() => {
  lang = "en";
  useQueryCalls.length = 0;
});

describe("TodayEnergyRecommendations copy", () => {
  test("every card key has a Hebrew string with no English in it", () => {
    const keys = Object.keys(youEn).filter((key) => key.startsWith("today.energy.")) as MessageKey[];
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const he = MESSAGES.he[key];
      expect(he).not.toBe(MESSAGES.en[key]);
      expect(latinWords(he.replace("{title}", ""))).toEqual([]);
    }
  });

  test("English: heading, prompt and level buttons, with no query until a level is picked", () => {
    const html = card();
    expect(useQueryCalls.at(-1)?.[1]).toBe("skip");
    expect(html).toContain(">Match your energy</h2>");
    expect(html).toContain("How&#x27;s your energy right now?");
    expect(html).toContain("Pick your current energy level</legend>");
    expect(html).toContain("Low</button>");
    expect(html).toContain("Medium</button>");
    expect(html).toContain("High</button>");
  });

  test("Hebrew: heading, prompt and level buttons have no English", () => {
    lang = "he";
    const html = card();
    expect(html).toContain(">לפי האנרגיה שלכם</h2>");
    expect(html).toContain("נמוכה</button>");
    expect(html).toContain("בינונית</button>");
    expect(html).toContain("גבוהה</button>");
    expect(latinWords(html)).toEqual([]);
  });

  test("English: loading, nothing fits, and suggestions with reasons and labels", () => {
    expect(suggestionsMarkup("low", null)).toContain("Finding tasks that fit…");
    expect(suggestionsMarkup("low", [])).toContain(
      "Nothing outside today&#x27;s plan fits that energy right now.",
    );

    const html = suggestionsMarkup("low", suggestions("low", ["Send the short email", "Tidy the desk"]));
    expect(html).toContain("A gentle fit for low energy. Small effort, real progress.");
    expect(html).toContain("Close to your current energy. Only if it feels right.");
    expect(html).toContain('aria-label="Add Send the short email to Today"');
    expect(html).toContain('aria-label="Not now: Tidy the desk"');
    expect(html).toContain("Add to Today</button>");
    expect(html).toContain("Not now</button>");
  });

  test("Hebrew: loading, nothing fits, and every level's suggestions have no English", () => {
    lang = "he";
    const loading = suggestionsMarkup("low", null);
    expect(loading).toContain("מחפשים משימות שמתאימות…");
    expect(latinWords(loading)).toEqual([]);

    const empty = suggestionsMarkup("high", []);
    expect(empty).toContain("כרגע אין משימה מחוץ לתוכנית של היום שמתאימה לאנרגיה הזו.");
    expect(latinWords(empty)).toEqual([]);

    for (const energy of ["low", "medium", "high"] as const) {
      const html = suggestionsMarkup(energy, suggestions(energy, ["לשלוח מייל קצר", "לסדר את השולחן"]));
      expect(html).toContain(translate("he", `today.energy.why.${energy}`));
      expect(html).toContain(translate("he", `today.energy.near.${energy}`));
      expect(html).toContain('aria-label="הוספת לשלוח מייל קצר להיום"');
      expect(html).toContain('aria-label="לא עכשיו: לסדר את השולחן"');
      expect(html).toContain('dir="auto">לשלוח מייל קצר</p>');
      expect(latinWords(html)).toEqual([]);
    }
  });
});
