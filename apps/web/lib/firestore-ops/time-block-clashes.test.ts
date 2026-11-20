import { expect, test } from "bun:test";
import type { TimeBlockDoc } from "../firestore-docs/time-block-doc";
import { findTimeBlockClashes } from "./time-block-clashes";

type Block = TimeBlockDoc & { id: string };

function block(id: string, startMinute: number, durationMinutes: number): Block {
  return {
    id,
    localDate: "2026-11-20",
    title: id,
    startMinute,
    durationMinutes,
    startsAtMs: startMinute * 60_000,
    endsAtMs: (startMinute + durationMinutes) * 60_000,
    kind: "focus",
    status: "planned",
    source: "user",
    createdAt: 1,
    updatedAt: 1,
  };
}

test("no blocks gives an empty result", () => {
  expect(findTimeBlockClashes([], "2026-11-20")).toEqual({
    pairs: [],
    clashingIds: [],
    count: 0,
  });
});

test("two overlapping blocks give one pair with the overlap minutes", () => {
  expect(
    findTimeBlockClashes([block("later", 45, 30), block("earlier", 30, 30)], "2026-11-20")
  ).toEqual({
    pairs: [{ firstId: "earlier", secondId: "later", overlapMinutes: 15 }],
    clashingIds: ["earlier", "later"],
    count: 1,
  });
});

test("touching blocks do not clash", () => {
  expect(
    findTimeBlockClashes([block("first", 30, 30), block("second", 60, 30)], "2026-11-20")
  ).toEqual({ pairs: [], clashingIds: [], count: 0 });
});

test("a block inside another clashes for the inner block length", () => {
  expect(
    findTimeBlockClashes([block("outer", 30, 90), block("inner", 45, 20)], "2026-11-20")
  ).toEqual({
    pairs: [{ firstId: "outer", secondId: "inner", overlapMinutes: 20 }],
    clashingIds: ["outer", "inner"],
    count: 1,
  });
});

test("three mutually overlapping blocks give three pairs and three ids", () => {
  expect(
    findTimeBlockClashes([block("c", 40, 30), block("a", 20, 40), block("b", 30, 40)], "2026-11-20")
  ).toEqual({
    pairs: [
      { firstId: "a", secondId: "b", overlapMinutes: 30 },
      { firstId: "a", secondId: "c", overlapMinutes: 20 },
      { firstId: "b", secondId: "c", overlapMinutes: 30 },
    ],
    clashingIds: ["a", "b", "c"],
    count: 3,
  });
});

test("deleted and skipped blocks are left out", () => {
  const deleted = { ...block("deleted", 35, 30), deletedAt: 2 };
  const skipped = { ...block("skipped", 40, 30), status: "skipped" as const };
  expect(findTimeBlockClashes([block("kept", 30, 30), deleted, skipped], "2026-11-20")).toEqual({
    pairs: [],
    clashingIds: [],
    count: 0,
  });
});

test("blocks from another date are left out and the input is not changed", () => {
  const input = [
    block("later", 45, 30),
    { ...block("other-day", 35, 30), localDate: "2026-11-21" },
    block("earlier", 30, 30),
  ];
  const snapshot = structuredClone(input);

  expect(findTimeBlockClashes(input, "2026-11-20")).toEqual({
    pairs: [{ firstId: "earlier", secondId: "later", overlapMinutes: 15 }],
    clashingIds: ["earlier", "later"],
    count: 1,
  });
  expect(input).toEqual(snapshot);
});
