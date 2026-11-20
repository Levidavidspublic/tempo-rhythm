import { describe, expect, test } from "bun:test";
import type { NoteDoc } from "../firestore-docs/note-doc";
import { planNoteEdit } from "./note-edit";

const storedNote: NoteDoc = {
  title: "Plan the day",
  body: "Start with the most important task.",
  pinned: false,
  periodType: "daily",
  revision: 3,
  createdAt: 1_795_046_400_000,
  updatedAt: 1_795_046_400_000,
};

describe("note edit plan", () => {
  test("plans a body change with its revision and update time", () => {
    expect(planNoteEdit(storedNote, { body: "Take a short walk." }, 1_795_132_800_000)).toEqual({
      kind: "patch",
      patch: {
        body: "Take a short walk.",
        revision: 4,
        updatedAt: 1_795_132_800_000,
      },
      fields: ["body", "revision", "updatedAt"],
    });
  });

  test("plans a pin-only change", () => {
    expect(planNoteEdit(storedNote, { pinned: true }, 1_795_132_800_000)).toEqual({
      kind: "patch",
      patch: { pinned: true, revision: 4, updatedAt: 1_795_132_800_000 },
      fields: ["pinned", "revision", "updatedAt"],
    });
  });

  test("starts the revision at one when the stored note has no revision", () => {
    const { revision: _revision, ...withoutRevision } = storedNote;

    expect(planNoteEdit(withoutRevision, { body: "Revised body" }, 1_795_132_800_000)).toEqual({
      kind: "patch",
      patch: { body: "Revised body", revision: 1, updatedAt: 1_795_132_800_000 },
      fields: ["body", "revision", "updatedAt"],
    });
  });

  test("reports unchanged when the edited values are the same", () => {
    expect(
      planNoteEdit(
        storedNote,
        { title: "  Plan the day  ", body: storedNote.body, pinned: false },
        1_795_132_800_000
      )
    ).toEqual({ kind: "unchanged" });
  });

  test("refuses to edit a deleted note", () => {
    expect(
      planNoteEdit({ ...storedNote, deletedAt: 1_795_100_000_000 }, { pinned: true }, 1_795_132_800_000)
    ).toEqual({ kind: "refused", reason: "note is deleted" });
  });

  test("refuses an empty title without mutating the frozen stored note", () => {
    const frozen = Object.freeze({ ...storedNote });

    expect(planNoteEdit(frozen, { title: "   " }, 1_795_132_800_000)).toEqual({
      kind: "refused",
      reason: "title must not be empty",
    });
    expect(frozen).toEqual(storedNote);
  });
});
