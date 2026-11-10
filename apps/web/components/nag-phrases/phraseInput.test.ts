import { describe, expect, test } from "bun:test";
import {
  isCurrentNagRequest,
  localForNag,
  splitByStatus,
  suggestSectionMessage,
  validatePhraseText,
} from "./phraseInput";

describe("validatePhraseText", () => {
  test("empty", () => {
    expect(validatePhraseText("")).toEqual({
      ok: false,
      message: "Write a phrase in your own words.",
    });
    expect(validatePhraseText("   \n\t  ")).toEqual({
      ok: false,
      message: "Write a phrase in your own words.",
    });
  });

  test("too long", () => {
    expect(validatePhraseText(` ${"a".repeat(141)} `)).toEqual({
      ok: false,
      message: "Keep it under 140 characters.",
    });
  });

  test("emoji", () => {
    expect(validatePhraseText("Take the meds 💊")).toEqual({
      ok: false,
      message: "No emoji in nags.",
    });
    expect(validatePhraseText("😀")).toEqual({
      ok: false,
      message: "No emoji in nags.",
    });
  });

  test("ok", () => {
    expect(validatePhraseText("  Meds are on the counter.  ")).toEqual({
      ok: true,
      text: "Meds are on the counter.",
    });
    expect(validatePhraseText("a".repeat(140))).toEqual({
      ok: true,
      text: "a".repeat(140),
    });
  });
});

describe("localForNag", () => {
  test("keeps local state for the same nag", () => {
    const local = {
      draft: "On the counter",
      error: null,
      suggestions: [{ key: "s1", text: "Meds are out" }],
    };
    expect(localForNag("nag-a", "nag-a", local)).toBe(local);
  });

  test("clears draft and suggestions when the nag changes", () => {
    expect(
      localForNag("nag-a", "nag-b", {
        draft: "On the counter",
        error: "That didn't save. Try again?",
        suggestions: [{ key: "s1", text: "Meds are out" }],
      })
    ).toEqual({ draft: "", error: null, suggestions: [] });
  });
});

describe("isCurrentNagRequest", () => {
  test("drops a result that belongs to a nag the editor has left", () => {
    expect(isCurrentNagRequest("nag-a", "nag-a")).toBe(true);
    expect(isCurrentNagRequest("nag-a", "nag-b")).toBe(false);
  });
});

describe("suggestSectionMessage", () => {
  const hint = "Add a phrase of your own first so suggestions can come from your words.";

  test("asks for own words only when there is nothing to derive from", () => {
    expect(suggestSectionMessage(false, 0)).toBe(hint);
    expect(suggestSectionMessage(true, 0)).toBeNull();
    expect(suggestSectionMessage(true, 2)).toBeNull();
    expect(suggestSectionMessage(false, 1)).toBeNull();
  });
});

describe("splitByStatus", () => {
  test("splitByStatus", () => {
    const phrases = [
      { id: "1", text: "Own words", status: "accepted" as const },
      { id: "2", text: "Maybe", status: "proposed" as const },
      { id: "3", text: "No thanks", status: "rejected" as const },
      { id: "4", text: "Also mine", status: "accepted" as const },
    ];
    expect(splitByStatus(phrases)).toEqual({
      accepted: [phrases[0], phrases[3]],
      proposed: [phrases[1]],
      rejected: [phrases[2]],
    });
    expect(splitByStatus([])).toEqual({ accepted: [], proposed: [], rejected: [] });
  });
});
