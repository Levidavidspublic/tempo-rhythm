import { describe, expect, test } from "bun:test";
import { MESSAGES } from "@/lib/i18n";
import { WAITING_NAME_HINT, WAITING_NAME_MAX, checkWaitingName, prefillWaitingName } from "./waiting-name";

describe("checkWaitingName", () => {
  test("trims the name before saving it", () => {
    expect(checkWaitingName("  Dana  ")).toEqual({ ok: true, name: "Dana" });
  });

  test("refuses an empty or blank name", () => {
    expect(checkWaitingName("")).toEqual({ ok: false, problem: "empty" });
    expect(checkWaitingName("   \t ")).toEqual({ ok: false, problem: "empty" });
  });

  test("allows a name of exactly the cap and refuses one character more", () => {
    expect(checkWaitingName("a".repeat(WAITING_NAME_MAX))).toEqual({ ok: true, name: "a".repeat(WAITING_NAME_MAX) });
    expect(checkWaitingName("a".repeat(WAITING_NAME_MAX + 1))).toEqual({ ok: false, problem: "tooLong" });
  });

  test("counts the cap after trimming, so outer spaces never push a name over", () => {
    const name = "b".repeat(WAITING_NAME_MAX);
    expect(checkWaitingName(`   ${name}   `)).toEqual({ ok: true, name });
  });

  test("counts letters, not code units, so a Hebrew name or an emoji is counted fairly", () => {
    expect(checkWaitingName("דנה")).toEqual({ ok: true, name: "דנה" });
    const emoji = "🌿".repeat(WAITING_NAME_MAX);
    expect(checkWaitingName(emoji)).toEqual({ ok: true, name: emoji });
  });
});

describe("prefillWaitingName", () => {
  test("offers the profile's own name", () => {
    expect(prefillWaitingName("Dana Katz", "dana.k84@example.com")).toBe("Dana Katz");
    expect(prefillWaitingName("  Dana ", "dana.k84@example.com")).toBe("Dana");
  });

  test("offers nothing when there is no name", () => {
    expect(prefillWaitingName(undefined, "dana.k84@example.com")).toBe("");
    expect(prefillWaitingName(null, null)).toBe("");
    expect(prefillWaitingName("   ", "dana.k84@example.com")).toBe("");
  });

  test("never offers the old placeholder", () => {
    expect(prefillWaitingName("User", "dana.k84@example.com")).toBe("");
  });

  test("never offers the email handle or the email itself as a name", () => {
    expect(prefillWaitingName("dana.k84", "dana.k84@example.com")).toBe("");
    expect(prefillWaitingName("Dana.K84", "dana.k84@example.com")).toBe("");
    expect(prefillWaitingName("dana.k84@example.com", "Dana.K84@Example.com")).toBe("");
  });
});

describe("hint strings", () => {
  test("every hint has calm English and Hebrew copy with no exclamation mark", () => {
    for (const key of Object.values(WAITING_NAME_HINT)) {
      for (const lang of ["en", "he"] as const) {
        const text = MESSAGES[lang][key];
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text.includes("!")).toBe(false);
      }
    }
  });

  test("the too-long hint names the same cap the check uses", () => {
    for (const lang of ["en", "he"] as const) {
      expect(MESSAGES[lang][WAITING_NAME_HINT.tooLong]).toContain("{max}");
    }
  });
});
