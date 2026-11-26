import { describe, expect, test } from "bun:test";
import { dirFor, isLang, MESSAGES, resolveLang, translate } from "./i18n";

describe("resolveLang", () => {
  test("the URL parameter wins, then the stored choice, then English", () => {
    expect(resolveLang("he", "en")).toBe("he");
    expect(resolveLang(null, "he")).toBe("he");
    expect(resolveLang(undefined, null)).toBe("en");
  });
  test("unknown values are ignored", () => {
    expect(resolveLang("fr", "de")).toBe("en");
    expect(isLang("ar")).toBe(false);
  });
});

describe("direction", () => {
  test("Hebrew is right-to-left, English left-to-right", () => {
    expect(dirFor("he")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });
});

describe("messages", () => {
  test("every English key has a non-empty Hebrew string", () => {
    for (const key of Object.keys(MESSAGES.en) as (keyof typeof MESSAGES.en)[]) {
      expect(MESSAGES.he[key]?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
  test("copy never uses shaming words (HARD_RULES §1)", () => {
    const all = [...Object.values(MESSAGES.en)].join(" ").toLowerCase();
    for (const word of ["failed", "overdue", "streak lost", "must"]) {
      expect(all.includes(word)).toBe(false);
    }
  });
  test("translate returns the language's string", () => {
    expect(translate("he", "nav.today")).toBe("היום");
    expect(translate("en", "nav.today")).toBe("Today");
  });
});
