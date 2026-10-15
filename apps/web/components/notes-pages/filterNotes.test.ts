import { describe, expect, test } from "bun:test";
import { filterByPeriod, plainPreview } from "./filterNotes";

describe("note previews and period filters", () => {
  const notes = [
    { periodType: "none", title: "Plain" },
    { periodType: "daily", title: "Today" },
    { periodType: "weekly", title: "This week" },
    { periodType: "monthly", title: "This month" },
  ] as const;

  test("all includes plain notes; each period excludes other types without mutating input", () => {
    expect(filterByPeriod(notes, "all")).toEqual([...notes]);
    expect(filterByPeriod(notes, "daily")).toEqual([notes[1]]);
    expect(filterByPeriod(notes, "weekly")).toEqual([notes[2]]);
    expect(filterByPeriod(notes, "monthly")).toEqual([notes[3]]);
    expect(filterByPeriod([], "all")).toEqual([]);
    expect(notes[0].periodType).toBe("none");
  });

  test("previews skip JSON and fenced blocks and show only the first plain line", () => {
    expect(plainPreview('```json\n{"task":"hidden"}\n```\n# Hello **there**\nSecond line')).toBe(
      "Hello there"
    );
    expect(plainPreview('{"task":"hidden"}')).toBe("No content yet.");
    expect(plainPreview('- {"token":"visible"}\n> ["x"]\nReal text')).toBe("Real text");
    expect(plainPreview('[{"task":"hidden"}]\nShown')).toBe("Shown");
    expect(plainPreview('  {"a":1}\n  ["b"]\n"c"\nPlain')).toBe("Plain");
    expect(plainPreview("~~~json\n{}\n~~~\nFirst\nSecond")).toBe("First");
    expect(plainPreview("- [ ] Call the bank\n- [x] Done")).toBe("Call the bank");
    expect(plainPreview("[[Weekly review]] notes")).toBe("[[Weekly review]] notes");
    expect(plainPreview('"Rest is productive," she said')).toBe('"Rest is productive," she said');
    expect(plainPreview('"key": 1,\n[1, 2]\n[]\n}\n- ["x", "y"]\nText')).toBe("Text");
  });
});
