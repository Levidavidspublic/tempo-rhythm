import { describe, expect, test } from "bun:test";

import { draftNote, NOTE_TITLE_MAX } from "./note-draft";

describe("draftNote", () => {
  test("builds a note from a normal title and body", () => {
    const result = draftNote({ title: "Meeting notes", body: "Call Sam", pinned: true }, 1_000);

    expect(result).toEqual({
      ok: true,
      doc: {
        title: "Meeting notes",
        body: "Call Sam",
        pinned: true,
        periodType: "none",
        pageType: "plain",
        revision: 0,
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    });
  });

  test("collapses whitespace in the title", () => {
    const result = draftNote({ title: "  Weekly\n\t planning   notes  " }, 1_000);

    expect(result.ok && result.doc.title).toBe("Weekly planning notes");
  });

  test("cuts a 250-character title to 200 characters", () => {
    const result = draftNote({ title: "a".repeat(250) }, 1_000);

    expect(result.ok && result.doc.title).toBe("a".repeat(NOTE_TITLE_MAX));
  });

  test("uses the first non-empty body line when the title is empty", () => {
    const result = draftNote({ title: "  ", body: "\n  First body line  \nSecond line" }, 1_000);

    expect(result.ok && result.doc.title).toBe("First body line");
  });

  test("refuses an empty title and empty body", () => {
    expect(draftNote({ title: " \t ", body: "\n  " }, 1_000)).toEqual({
      ok: false,
      reason: "note is empty",
    });
  });

  test("refuses an invalid date without adding undefined values", () => {
    const result = draftNote({ title: "Dated note", date: "2026-02-30" }, 1_000);

    expect(result).toEqual({
      ok: false,
      reason: "date must be a real YYYY-MM-DD calendar date",
    });
    expect(Object.values(result)).not.toContain(undefined);
  });
});
