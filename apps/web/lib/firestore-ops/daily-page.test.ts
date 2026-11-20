import { expect, test } from "bun:test";

import type { NoteDoc } from "../firestore-docs/note-doc";
import { findDailyPage } from "./daily-page";

function note(overrides: Partial<NoteDoc> = {}): NoteDoc {
  return {
    title: "2026-11-20",
    body: "Plan",
    pinned: false,
    periodType: "daily",
    pageType: "daily",
    date: "2026-11-20",
    revision: 1,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

test("finds the page", () => {
  const stored = note();
  expect(findDailyPage([{ id: "today", data: stored }], "2026-11-20", 200)).toEqual({
    ok: true,
    found: true,
    id: "today",
    note: stored,
    duplicateIds: [],
  });
});

test("ignores a deleted page", () => {
  const result = findDailyPage(
    [{ id: "deleted", data: note({ deletedAt: 150 }) }],
    "2026-11-20",
    200
  );
  expect(result).toMatchObject({ ok: true, found: false });
});

test("ignores a weekly note with the same date", () => {
  const result = findDailyPage(
    [{ id: "week", data: note({ periodType: "weekly", pageType: "weekly" }) }],
    "2026-11-20",
    200
  );
  expect(result).toMatchObject({ ok: true, found: false });
});

test("oldest wins and the other id is in duplicateIds", () => {
  const notes = [
    { id: "newer", data: note({ createdAt: 200 }) },
    { id: "z-old", data: note({ createdAt: 100 }) },
    { id: "a-old", data: note({ createdAt: 100 }) },
  ] as const;
  const snapshot = structuredClone(notes);

  expect(findDailyPage(notes, "2026-11-20", 300)).toMatchObject({
    ok: true,
    found: true,
    id: "a-old",
    duplicateIds: ["z-old", "newer"],
  });
  expect(notes).toEqual(snapshot);
});

test("returns a checked draft when there is none", () => {
  expect(findDailyPage([], "2026-11-20", 500)).toEqual({
    ok: true,
    found: false,
    draft: {
      title: "2026-11-20",
      body: "",
      pinned: false,
      periodType: "daily",
      pageType: "daily",
      date: "2026-11-20",
      revision: 1,
      createdAt: 500,
      updatedAt: 500,
    },
  });
});

test("bad date refused", () => {
  expect(findDailyPage([], "2026-02-30", 500)).toEqual({ ok: false, reason: "bad-date" });
  expect(findDailyPage([], "20-11-2026", 500)).toEqual({ ok: false, reason: "bad-date" });
});

test("bad time refused", () => {
  expect(findDailyPage([], "2026-11-20", Number.POSITIVE_INFINITY)).toEqual({
    ok: false,
    reason: "bad-time",
  });
});
