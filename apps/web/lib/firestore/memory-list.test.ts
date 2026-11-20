import { describe, expect, test } from "bun:test";
import type { MemoryDoc, MemorySector } from "../firestore-docs/memory-doc";
import { pickMemories } from "./memory-list";

function memory(
  content: string,
  sector: MemorySector,
  updatedAt: number,
  deletedAt?: number
): MemoryDoc {
  return {
    content,
    sector,
    salience: 1,
    decayRate: 0,
    lastAccessed: updatedAt,
    accessCount: 0,
    createdAt: updatedAt,
    updatedAt,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

describe("pickMemories", () => {
  test("returns an empty result with every sector counted", () => {
    expect(pickMemories([], "")).toEqual({
      rows: [],
      total: 0,
      bySector: {
        semantic: 0,
        episodic: 0,
        procedural: 0,
        emotional: 0,
        general: 0,
      },
    });
  });

  test("drops deleted rows and counts live rows before searching", () => {
    const rows = [
      { id: "semantic", doc: memory("Alpha", "semantic", 1) },
      { id: "episodic", doc: memory("Beta", "episodic", 2) },
      { id: "deleted", doc: memory("Alpha deleted", "general", 3, 3) },
    ];

    expect(pickMemories(rows, "alpha")).toEqual({
      rows: [rows[0]],
      total: 2,
      bySector: {
        semantic: 1,
        episodic: 1,
        procedural: 0,
        emotional: 0,
        general: 0,
      },
    });
  });

  test("matches content without regard to case and trims the search", () => {
    const row = { id: "match", doc: memory("Keeps The Context", "general", 1) };

    expect(pickMemories([row], "  tHe CoN  ").rows).toEqual([row]);
  });

  test("returns no rows when the search has no match", () => {
    const row = { id: "memory", doc: memory("Remember this", "general", 1) };

    expect(pickMemories([row], "missing")).toEqual({
      rows: [],
      total: 1,
      bySector: {
        semantic: 0,
        episodic: 0,
        procedural: 0,
        emotional: 0,
        general: 1,
      },
    });
  });

  test("sorts newest first and breaks update-time ties by id", () => {
    const rows = [
      { id: "z", doc: memory("Old", "general", 10) },
      { id: "b", doc: memory("Newest B", "general", 20) },
      { id: "a", doc: memory("Newest A", "general", 20) },
    ];

    expect(pickMemories(rows, "").rows.map(({ id }) => id)).toEqual(["a", "b", "z"]);
  });

  test("does not reorder the input array", () => {
    const rows = [
      { id: "old", doc: memory("Old", "procedural", 1) },
      { id: "new", doc: memory("New", "emotional", 2) },
    ] as const;

    pickMemories(rows, "");

    expect(rows.map(({ id }) => id)).toEqual(["old", "new"]);
  });
});
