import { expect, test } from "bun:test";
import { draftThread, sortThreads, THREAD_TITLE_MAX } from "./thread-draft";

test("short message becomes the title", () => {
  expect(draftThread("Plan my afternoon", 1_700_000_000_000)).toEqual({
    ok: true,
    doc: {
      title: "Plan my afternoon",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
  });
});

test("multi-line message uses the first non-empty line", () => {
  const result = draftThread("  \n\t  First   useful\tline  \nSecond line", 10);
  expect(result.ok && result.doc.title).toBe("First useful line");
});

test("long title is shortened to 60 characters ending with an ellipsis", () => {
  const result = draftThread("a".repeat(80), 10);
  expect(result.ok && result.doc.title).toBe(`${"a".repeat(59)}…`);
  expect(result.ok && result.doc.title.length).toBe(THREAD_TITLE_MAX);
});

test("Hebrew text and an emoji at the cut point stay well-formed", () => {
  const result = draftThread(`${"א".repeat(58)}😀more`, 10);
  expect(result.ok && result.doc.title).toBe(`${"א".repeat(58)}…`);
  expect(result.ok && !result.doc.title.includes("�")).toBe(true);
});

test("empty message is refused", () => {
  expect(draftThread(" \n\t ", 10)).toEqual({ ok: false, reason: "empty" });
  expect(draftThread(null, 10)).toEqual({ ok: false, reason: "empty" });
});

test("invalid now is refused", () => {
  expect(draftThread("Hello", Number.NaN)).toEqual({ ok: false, reason: "invalid-now" });
  expect(draftThread("Hello", 0)).toEqual({ ok: false, reason: "invalid-now" });
});

test("sortThreads orders newest first, breaks ties by id, drops deleted, and does not mutate", () => {
  const threads = [
    { id: "c", updatedAt: 20 },
    { id: "b", updatedAt: 30 },
    { id: "a", updatedAt: 30 },
    { id: "deleted", updatedAt: 40, deletedAt: 41 },
  ] as const;
  const original = JSON.stringify(threads);

  expect(sortThreads(threads).map(({ id }) => id)).toEqual(["a", "b", "c"]);
  expect(JSON.stringify(threads)).toBe(original);
});
