import { describe, expect, test } from "bun:test";
import {
  allEntries,
  fill,
  isLang,
  NEEDS_NATIVE_REVIEW,
  rowDirection,
  startAlign,
  textDirection,
  translate,
} from "../../apps/mobile/lib/v3/i18n";
import { STRINGS } from "../../apps/mobile/lib/v3/strings";

const HEBREW = /[֐-׿]/;
// DESIGN.md §13: never "failed", "overdue", "streak lost", "must".
const SHAME = [/\bfailed\b/i, /\boverdue\b/i, /streak lost/i, /\bmust\b/i, /\blazy\b/i];

describe("mobile v3 strings", () => {
  test("every entry has English and Hebrew copy", () => {
    const entries = allEntries();
    expect(entries.length).toBeGreaterThan(400);
    for (const e of entries) {
      expect([e.screen, e.key, e.en.trim().length > 0]).toEqual([e.screen, e.key, true]);
      expect([e.screen, e.key, e.he.trim().length > 0]).toEqual([e.screen, e.key, true]);
      expect(e.en).not.toContain("TODO");
      expect(e.he).not.toContain("TODO");
    }
  });

  test("Hebrew copy is Hebrew (brand names and placeholders aside)", () => {
    for (const e of allEntries()) {
      const letters = e.he.replace(/\{\w+\}|Tempo|Markdown|Enter|\d+|[^\p{L}]/gu, "");
      if (letters.length === 0) continue;
      expect([e.screen, e.key, HEBREW.test(e.he)]).toEqual([e.screen, e.key, true]);
    }
  });

  test("copy stays shame-free", () => {
    for (const e of allEntries()) {
      for (const word of SHAME) expect([e.key, word.test(e.en)]).toEqual([e.key, false]);
    }
  });

  test("placeholders match between English and Hebrew", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const e of allEntries()) expect([e.key, names(e.he)]).toEqual([e.key, names(e.en)]);
  });

  test("every key listed for native review exists", () => {
    const keys = new Set(allEntries().map((e) => `${e.screen}.${e.key}`));
    for (const key of NEEDS_NATIVE_REVIEW) expect([key, keys.has(key)]).toEqual([key, true]);
  });

  test("no fictional names from the mockups leak into the copy", () => {
    for (const e of allEntries()) {
      expect([e.key, /\bMaya\b|מאיה/.test(`${e.en} ${e.he}`)]).toEqual([e.key, false]);
    }
  });
});

describe("translate", () => {
  test("reads the screen's own key, then the shared ones", () => {
    expect(translate("en", "today", "next.eyebrow")).toBe("Next up");
    expect(translate("he", "today", "next.eyebrow")).toBe(STRINGS.today["next.eyebrow"][1]);
    expect(translate("en", "tasks", "tab.more")).toBe("More");
    expect(translate("he", "tasks", "tab.more")).toBe("עוד");
  });

  test("fills placeholders", () => {
    expect(translate("en", "today", "next.start.n", { n: 30 })).toBe("Start 30 minutes");
    expect(translate("he", "today", "date.eyebrow.morning", { name: "דנה" })).toBe("בוקר טוב, דנה");
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });

  test("a missing key shows the key, never an empty string", () => {
    // @ts-expect-error deliberately unknown
    expect(translate("en", "today", "no.such.key")).toBe("no.such.key");
  });

  test("isLang", () => {
    expect(isLang("he")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});

describe("direction", () => {
  test("user text takes the direction of its first strong letter", () => {
    expect(textDirection("לקנות חלב")).toBe("rtl");
    expect(textDirection("Call the bank")).toBe("ltr");
    expect(textDirection("12:30 פגישה")).toBe("rtl");
    expect(textDirection("12:30", "rtl")).toBe("rtl");
    expect(textDirection("")).toBe("ltr");
  });

  test("rows and alignment follow the language on any native layout", () => {
    expect(rowDirection(false, false)).toBe("row");
    expect(rowDirection(true, true)).toBe("row");
    expect(rowDirection(false, true)).toBe("row-reverse");
    expect(rowDirection(true, false)).toBe("row-reverse");
    expect(startAlign(false, false)).toBe("left");
    expect(startAlign(true, true)).toBe("left");
    expect(startAlign(true, false)).toBe("right");
    expect(startAlign(false, true)).toBe("right");
  });
});
