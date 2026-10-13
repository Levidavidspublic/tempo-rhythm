import { describe, expect, test } from "bun:test";
import { CHANGELOG, changelogDate, sortedEntries } from "./changelog";
import { MESSAGES } from "./i18n";

describe("changelog", () => {
  test("newest entry first", () => {
    const entries = sortedEntries([
      { version: "0.1", date: "2026-09-01", changes: [] },
      { version: "0.3", date: "2026-10-09", changes: [] },
      { version: "0.2", date: "2026-09-14", changes: [] },
    ]);
    expect(entries.map((e) => e.version)).toEqual(["0.3", "0.2", "0.1"]);
  });

  test("dates read as the calendar day in each language", () => {
    expect(changelogDate("2026-10-09", "en")).toBe("9 October 2026");
    expect(changelogDate("2026-10-09", "he")).toContain("2026");
    expect(changelogDate("2026-10-09", "he")).toContain("9");
  });

  test("every change has copy in both languages and no ticket numbers", () => {
    for (const entry of CHANGELOG) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const change of entry.changes) {
        expect(MESSAGES.en[change.text].length).toBeGreaterThan(0);
        expect(MESSAGES.he[change.text].length).toBeGreaterThan(0);
        expect(MESSAGES.en[change.text]).not.toMatch(/#\d|TEMPO-|PR /);
      }
    }
  });
});
