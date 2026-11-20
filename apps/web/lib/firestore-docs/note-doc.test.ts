import { describe, expect, test } from "bun:test";
import { checkNoteDoc, softDeleteNote, type NoteDoc } from "./note-doc";

const validNote: NoteDoc = {
  title: "Plan the day",
  body: "Start with the most important task.",
  pinned: false,
  periodType: "daily",
  pageType: "plain",
  date: "2026-11-19",
  aiGenerated: false,
  revision: 0,
  createdAt: 1_795_046_400_000,
  updatedAt: 1_795_046_400_000,
};

describe("note document", () => {
  test("accepts a valid note", () => {
    expect(checkNoteDoc(validNote)).toEqual({ ok: true, doc: validNote });
  });

  test("rejects unknown keys, including an empty-string key", () => {
    expect(checkNoteDoc({ ...validNote, userId: "user-1" })).toEqual({
      ok: false,
      reason: "unknown key: userId",
    });
    expect(checkNoteDoc({ ...validNote, "": 123 })).toEqual({
      ok: false,
      reason: "unknown key: ",
    });

    const uninspectableNote = new Proxy(validNote, {
      ownKeys() {
        throw new Error("uninspectable input");
      },
    });

    expect(checkNoteDoc(uninspectableNote)).toEqual({
      ok: false,
      reason: "note could not be inspected",
    });
  });

  test("rejects an invalid periodType", () => {
    expect(checkNoteDoc({ ...validNote, periodType: "yearly" })).toEqual({
      ok: false,
      reason: "invalid periodType",
    });
  });

  test("rejects a date that is not a real calendar date", () => {
    expect(checkNoteDoc({ ...validNote, date: "2026-02-30" })).toEqual({
      ok: false,
      reason: "date must be a real YYYY-MM-DD calendar date",
    });
  });

  test("rejects a negative revision", () => {
    expect(checkNoteDoc({ ...validNote, revision: -1 })).toEqual({
      ok: false,
      reason: "revision must be a safe integer >= 0",
    });
  });

  test("soft deletes a copy without changing the input", () => {
    const before = { ...validNote };
    const deleted = softDeleteNote(validNote, 1_795_132_800_000);

    expect(deleted).toEqual({
      ...validNote,
      deletedAt: 1_795_132_800_000,
      updatedAt: 1_795_132_800_000,
    });
    expect(validNote).toEqual(before);
  });
});
