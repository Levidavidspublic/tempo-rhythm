import { describe, expect, test } from "bun:test";
import { MEMORY_MAX, SECTOR_LABELS, sortForDisplay, validateMemory } from "./memoryView";

describe("SECTOR_LABELS", () => {
  test("uses plain labels", () => {
    expect(SECTOR_LABELS).toEqual({
      semantic: "Facts",
      episodic: "Events",
      procedural: "How I do things",
      emotional: "Feelings",
      general: "General",
    });
  });
});

describe("validateMemory", () => {
  test("trims the text", () => {
    expect(validateMemory("  likes tea  ")).toEqual({ ok: true, text: "likes tea" });
  });

  test("rejects empty and whitespace-only text", () => {
    expect(validateMemory("").ok).toBe(false);
    expect(validateMemory("   \n").ok).toBe(false);
  });

  test("accepts exactly 500 characters and rejects 501", () => {
    expect(validateMemory("a".repeat(MEMORY_MAX)).ok).toBe(true);
    expect(validateMemory("a".repeat(MEMORY_MAX + 1)).ok).toBe(false);
  });
});

describe("sortForDisplay", () => {
  test("salience descending, then updatedAt descending, without mutating", () => {
    const input = [
      { id: "a", salience: 0.5, updatedAt: 1 },
      { id: "b", salience: 0.9, updatedAt: 1 },
      { id: "c", salience: 0.5, updatedAt: 5 },
    ];
    const out = sortForDisplay(input);
    expect(out.map((m) => m.id)).toEqual(["b", "c", "a"]);
    expect(input.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});
