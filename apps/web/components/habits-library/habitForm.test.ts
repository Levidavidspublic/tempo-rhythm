import { describe, expect, test } from "bun:test";
import { habitHref, parseHabitName } from "./habitForm";

describe("parseHabitName", () => {
  test("trims surrounding whitespace", () => {
    expect(parseHabitName("  Drink water  ")).toEqual({ ok: true, name: "Drink water" });
  });

  test("rejects empty and whitespace-only input", () => {
    expect(parseHabitName("").ok).toBe(false);
    expect(parseHabitName("   ").ok).toBe(false);
  });

  test("accepts 80 characters and rejects 81", () => {
    expect(parseHabitName("a".repeat(80)).ok).toBe(true);
    expect(parseHabitName("a".repeat(81)).ok).toBe(false);
  });
});

describe("habitHref", () => {
  test("links to the habit detail route", () => {
    expect(habitHref("abc123")).toBe("/habits/abc123");
  });
});
