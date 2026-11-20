import { describe, expect, test } from "bun:test";
import { notesListState, pickNotes, type NoteListRow } from "./notes-list";

const rows: NoteListRow[] = [
  { id: "older", title: "First note", pinned: false, updatedAt: 10 },
  { id: "newer", title: "Second NOTE", pinned: false, updatedAt: 30 },
  { id: "pinned", title: "Pinned note", pinned: true, updatedAt: 5 },
  { id: "deleted", title: "Deleted note", pinned: true, updatedAt: 50, deletedAt: 60 },
  { id: "hebrew", title: "פתק בעברית", pinned: false, updatedAt: 20 },
];

describe("pickNotes", () => {
  test("leaves out deleted notes and orders pinned first, then newest edits", () => {
    expect(pickNotes(rows).map(({ id }) => id)).toEqual(["pinned", "newer", "hebrew", "older"]);
  });

  test("orders equal update times by id", () => {
    const tied: NoteListRow[] = [
      { id: "z", title: "Z", pinned: false, updatedAt: 10 },
      { id: "a", title: "A", pinned: false, updatedAt: 10 },
    ];

    expect(pickNotes(tied).map(({ id }) => id)).toEqual(["a", "z"]);
  });

  test("trims search and matches titles without regard to case", () => {
    expect(pickNotes(rows, "  nOtE  ").map(({ id }) => id)).toEqual(["pinned", "newer", "older"]);
  });

  test("matches a Hebrew title", () => {
    expect(pickNotes(rows, "בעברית").map(({ id }) => id)).toEqual(["hebrew"]);
  });

  test("an empty search returns every non-deleted note", () => {
    expect(pickNotes(rows, "   ")).toHaveLength(4);
  });

  test("cuts the sorted result to max", () => {
    expect(pickNotes(rows, "", 2).map(({ id }) => id)).toEqual(["pinned", "newer"]);
  });

  test("does not change the input array", () => {
    const before = structuredClone(rows);

    pickNotes(rows);

    expect(rows).toEqual(before);
  });
});

describe("notesListState", () => {
  test("returns empty when there are no notes", () => {
    expect(notesListState(0, 0, "query")).toBe("empty");
  });

  test("returns no_match when a search has no shown notes", () => {
    expect(notesListState(3, 0, " query ")).toBe("no_match");
  });

  test("returns list when notes can be shown", () => {
    expect(notesListState(3, 3, "")).toBe("list");
    expect(notesListState(3, 1, "query")).toBe("list");
  });
});
