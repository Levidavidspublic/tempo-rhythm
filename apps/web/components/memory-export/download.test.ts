import { describe, expect, test } from "bun:test";
import { safeFilename, summaryLine, toBlobParts } from "./download";

describe("safeFilename", () => {
  test("normalises unsafe characters while keeping safe filename characters", () => {
    expect(safeFilename(" Tempo Memories (October)!.MD ")).toBe(
      "tempo-memories-october-.md",
    );
  });

  test("falls back when no safe filename remains", () => {
    expect(safeFilename("☀️")).toBe("tempo-memories.md");
  });
});

describe("summaryLine", () => {
  test("describes memories and non-empty sections", () => {
    expect(
      summaryLine({
        total: 3,
        sectors: [
          { sector: "semantic", count: 2 },
          { sector: "general", count: 1 },
          { sector: "emotional", count: 0 },
        ],
      }),
    ).toBe("3 memories across 2 sections");
  });

  test("uses singular labels", () => {
    expect(summaryLine({ total: 1, sectors: [{ sector: "general", count: 1 }] })).toBe(
      "1 memory across 1 section",
    );
  });

  test("provides a clear empty state", () => {
    expect(summaryLine({ total: 0, sectors: [] })).toBe("Nothing to export yet.");
  });
});

test("toBlobParts returns the markdown and its UTF-8 media type", () => {
  expect(toBlobParts("# My memories")).toEqual({
    parts: ["# My memories"],
    type: "text/markdown;charset=utf-8",
  });
});
