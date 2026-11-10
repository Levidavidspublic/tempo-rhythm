import { describe, expect, test } from "bun:test";
import { getLandingCopy, type LandingCopy } from "./landing-copy";

const en = getLandingCopy("en");
const he = getLandingCopy("he");

/** The dictionary with every string replaced by "string", so two languages can be compared. */
function shape(value: unknown): unknown {
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return value.map(shape);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, shape(child)])
  );
}

/**
 * Every visible string with its path, e.g. ["hero.facts[0].label", "during the beta"].
 * `kind` (the example page's line type) is structure, not copy, so it is left out.
 */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value))
    return value.flatMap((child, index) => strings(child, `${path}[${index}]`));
  return Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "kind")
    .flatMap(([key, child]) => strings(child, path ? `${path}.${key}` : key));
}

const HEBREW = /\p{Script=Hebrew}/u;

// HARD_RULES §1, the same words as lib/i18n.test.ts and tests/unit/tempo_empty_state.test.ts.
const SHAME_EN = [
  /\bfailed\b/i,
  /\bfailing\b/i,
  /\boverdue\b/i,
  /\bstreak lost\b/i,
  /\bmust\b/i,
  /\bbehind\b/i,
  /\blazy\b/i,
  /\bforgot\b/i,
  /\bshould have\b/i,
];
const SHAME_HE = ["נכשל", "באיחור", "עצלן", "בפיגור", "שכחת"];

describe("landing copy", () => {
  test("Hebrew has the same shape as English", () => {
    expect(shape(he)).toEqual(shape(en));
  });

  test("no string is empty", () => {
    for (const [lang, copy] of [
      ["en", en],
      ["he", he],
    ] as const) {
      for (const [path, value] of strings(copy)) {
        expect(value.trim(), `${lang}:${path}`).not.toBe("");
      }
    }
  });

  test("every Hebrew string has Hebrew in it", () => {
    for (const [path, value] of strings(he)) {
      expect(value, path).toMatch(HEBREW);
    }
  });

  test("English has no Hebrew in it", () => {
    for (const [path, value] of strings(en)) {
      expect(value, path).not.toMatch(HEBREW);
    }
  });

  test("no shaming words (HARD_RULES §1)", () => {
    for (const [path, value] of strings(en)) {
      for (const word of SHAME_EN) expect(value, path).not.toMatch(word);
    }
    for (const [path, value] of strings(he)) {
      for (const word of SHAME_HE) expect(value.includes(word), path).toBe(false);
    }
  });

  test("the example page has the same lines in both languages", () => {
    const kinds = (copy: LandingCopy) => copy.features.page.sample.map((line) => line.kind);
    expect(kinds(he)).toEqual(kinds(en));
  });

  test("every sample coach line and sample card is labelled as an example", () => {
    for (const [copy, word] of [
      [en, "example"],
      [he, "דוגמה"],
    ] as const) {
      const labels = [
        ...copy.coach.examples.map((example) => example.caption),
        copy.features.coach.exampleLabel,
        copy.features.page.sampleLabel,
        copy.features.brainDump.orderLabel,
        copy.hero.dumpLabel,
        copy.hero.coachLabel,
        copy.hero.weekLabel,
      ];
      for (const label of labels) expect(label.toLowerCase(), label).toContain(word);
    }
  });

  test("claims the beta can't back are gone: no stores, no voice, no testers, no screen counts", () => {
    const unbacked = [
      /\biOS\b/,
      /Android/,
      /App Store/,
      /Google Play/i,
      /\bvoice\b/i,
      /\btesters?\b/i,
      /\d+ (handcrafted )?screens/i,
    ];
    for (const [path, value] of strings(en)) {
      for (const claim of unbacked) expect(value, path).not.toMatch(claim);
    }
    for (const [path, value] of strings(he)) {
      for (const claim of [/iOS/, /Android/, /App Store/, /Google Play/i, /קולי/, /בודקי/]) {
        expect(value, path).not.toMatch(claim);
      }
    }
  });

  test("the approval gate is said plainly in both languages", () => {
    expect(en.pricing.lede).toContain("by hand");
    expect(he.pricing.lede).toContain("ידנית");
  });
});
