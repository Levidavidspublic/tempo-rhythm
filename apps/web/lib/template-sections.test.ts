import { describe, expect, test } from "bun:test";
import {
  insertSection,
  joinSections,
  moveSection,
  newSection,
  removeSection,
  renameSection,
  sectionKind,
  splitSections,
} from "./template-sections";

const BODY = "# Today\n\n## Intention\nOne line.\n\n## Schedule\n- [ ] Morning\n- [ ] Midday\n\n## Notes\n";

describe("splitSections / joinSections", () => {
  test("an untouched body joins back byte for byte", () => {
    for (const body of [
      BODY,
      "",
      "No headings at all.\nJust text",
      "## Last has no break\ntext",
      "Intro\r\n## Windows\r\nline\r\n",
      "## עברית\nשורה ראשונה\n## English\n",
    ]) {
      expect(joinSections(splitSections(body), "New section")).toBe(body);
    }
  });

  test("headings become rows; text before the first heading stays as the preamble", () => {
    const doc = splitSections(BODY);
    expect(doc.preamble).toBe("");
    expect(doc.sections.map((s) => [s.level, s.title])).toEqual([
      [1, "Today"],
      [2, "Intention"],
      [2, "Schedule"],
      [2, "Notes"],
    ]);
    expect(splitSections("Intro line\n## A\n").preamble).toBe("Intro line\n");
  });

  test("a # inside fenced code is text, not a section", () => {
    const body = "## Code\n```md\n# not a heading\n```\n## After\n";
    const doc = splitSections(body);
    expect(doc.sections.map((s) => s.title)).toEqual(["Code", "After"]);
    expect(doc.sections[0]?.rest).toBe("```md\n# not a heading\n```\n");
  });

  test("a hash with no words after it is not a heading", () => {
    expect(splitSections("##   \ntext\n").sections).toHaveLength(0);
    expect(splitSections("#hashtag\n").sections).toHaveLength(0);
  });
});

describe("section edits", () => {
  test("moving keeps every line of both rows and only swaps their order", () => {
    const doc = splitSections(BODY);
    const moved = moveSection(doc, 2, -1);
    expect(joinSections(moved, "x")).toBe(
      "# Today\n\n## Schedule\n- [ ] Morning\n- [ ] Midday\n\n## Intention\nOne line.\n\n## Notes\n",
    );
    expect(moveSection(doc, 0, -1)).toBe(doc);
    expect(moveSection(doc, 3, 1)).toBe(doc);
  });

  test("a last row without a line break still starts the next row on its own line", () => {
    const doc = splitSections("## A\none\n## B\ntwo");
    expect(joinSections(moveSection(doc, 1, -1), "x")).toBe("## B\ntwo\n## A\none\n");
  });

  test("remove and insert put the exact same text back (Undo)", () => {
    const doc = splitSections(BODY);
    const row = doc.sections[1];
    if (!row) throw new Error("missing row");
    const removed = removeSection(doc, 1);
    expect(joinSections(removed, "x")).toBe("# Today\n\n## Schedule\n- [ ] Morning\n- [ ] Midday\n\n## Notes\n");
    expect(joinSections(insertSection(removed, 1, row), "x")).toBe(BODY);
  });

  test("renaming rewrites only that heading line, keeping its level", () => {
    const doc = renameSection(splitSections(BODY), 1, "  Why  today ");
    expect(joinSections(doc, "x")).toBe(BODY.replace("## Intention", "## Why today"));
    expect(renameSection(doc, 9, "nope")).toBe(doc);
  });

  test("a new or blank title falls back to the given words", () => {
    const doc = splitSections("## A\n");
    const added = { ...doc, sections: [...doc.sections, newSection("n1")] };
    expect(joinSections(added, "New section")).toBe("## A\n## New section\n");
    expect(joinSections(renameSection(doc, 0, "   "), "New section")).toBe("## New section\n");
  });

  test("kind follows what the section holds", () => {
    const doc = splitSections(BODY);
    expect(doc.sections.map(sectionKind)).toEqual(["heading", "text", "tasks", "heading"]);
    const block = splitSections('## Do\n```json tempo\n{"id":"blk_x","v":1,"type":"task","data":{}}\n```\n');
    expect(sectionKind(block.sections[0] as never)).toBe("tasks");
  });
});
