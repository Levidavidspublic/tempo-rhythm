import { describe, expect, test } from "bun:test";
import { JOURNAL_PROMPTS, journalDate, promptFor } from "./journal";

describe("journal", () => {
  test("one prompt per day, rotating; Another prompt moves on and wraps", () => {
    const today = promptFor("2026-10-12");
    expect(JOURNAL_PROMPTS as readonly string[]).toContain(today);
    expect(promptFor("2026-10-13")).not.toBe(today);
    expect(promptFor("2026-10-12", JOURNAL_PROMPTS.length)).toBe(today);
    expect(promptFor("2026-10-12", -1)).toBe(promptFor("2026-10-11"));
  });

  test("dates read in the viewer's language", () => {
    expect(journalDate("2026-10-12", "en")).toBe("Monday 12 October 2026");
    expect(journalDate("2026-10-12", "he")).toContain("אוקטובר");
    expect(journalDate("not a date", "en")).toBe("not a date");
  });
});
