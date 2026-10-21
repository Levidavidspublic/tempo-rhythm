import { describe, expect, test } from "bun:test";
import { acceptedPhrases, canEnable, enableHint, validateLabel } from "./nagRules";

const phrase = (status: "proposed" | "accepted" | "rejected") => ({ status });

describe("canEnable", () => {
  test("is false with no phrases", () => {
    expect(canEnable({ phrases: [] })).toBe(false);
  });
  test("is true with one accepted phrase", () => {
    expect(canEnable({ phrases: [phrase("accepted")] })).toBe(true);
  });
  test("is false with only proposed or rejected phrases", () => {
    expect(canEnable({ phrases: [phrase("proposed"), phrase("rejected")] })).toBe(false);
  });
});

describe("acceptedPhrases and enableHint", () => {
  test("counts only accepted phrases", () => {
    const nag = { phrases: [phrase("accepted"), phrase("proposed"), phrase("accepted")] };
    expect(acceptedPhrases(nag)).toHaveLength(2);
  });
  test("hint only when blocked", () => {
    expect(enableHint({ phrases: [] })).toBe("Add a phrase in your own words to switch this on.");
    expect(enableHint({ phrases: [phrase("accepted")] })).toBeNull();
  });
});

describe("validateLabel", () => {
  test("trims", () => {
    expect(validateLabel("  Water  ")).toEqual({ ok: true, label: "Water" });
  });
  test("rejects empty", () => {
    expect(validateLabel("   ").ok).toBe(false);
  });
  test("allows 60 and rejects 61", () => {
    expect(validateLabel("a".repeat(60)).ok).toBe(true);
    expect(validateLabel("a".repeat(61)).ok).toBe(false);
  });
  test("rejects emoji", () => {
    expect(validateLabel("Stretch \u{1F525}").ok).toBe(false);
  });
});
