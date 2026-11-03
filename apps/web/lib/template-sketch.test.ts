import { describe, expect, test } from "bun:test";
import { parseSketch, SKETCH_MAX_CHARS, sketchBody } from "./template-sketch";

const OUTLINE = [
  "Thursday talk prep",
  "The one thing I want to land (question)",
  "Finish the last slides (tasks)",
  "Send the deck to Dana (tasks)",
  "Practice run, 20 min (time block)",
  "Notes",
].join("\n");

describe("parseSketch", () => {
  test("the first line is the name; hints pick each part; words are kept", () => {
    const draft = parseSketch(OUTLINE);
    expect(draft?.name).toBe("Thursday talk prep");
    expect(draft?.parts).toEqual([
      { kind: "question", text: "The one thing I want to land" },
      { kind: "task", text: "Finish the last slides" },
      { kind: "task", text: "Send the deck to Dana" },
      { kind: "section", text: "Practice run, 20 min (time block)" },
      { kind: "section", text: "Notes" },
    ]);
    expect(draft?.counts).toEqual({ section: 2, task: 2, question: 1 });
  });

  test("the body is plain Markdown: tasks next to each other share one checklist", () => {
    expect(parseSketch(OUTLINE)?.body).toBe(
      [
        "# Thursday talk prep",
        "",
        "> The one thing I want to land",
        "",
        "- [ ] Finish the last slides",
        "- [ ] Send the deck to Dana",
        "",
        "## Practice run, 20 min (time block)",
        "",
        "## Notes",
        "",
      ].join("\n"),
    );
  });

  test("Hebrew hints work, and blank lines, bullets and spaces are tidied", () => {
    const draft = parseSketch("\n\n  הכנה להרצאה  \n- לסיים שקופיות (משימות)\n\n* מה הכי חשוב? (שאלה)\n1. סיכום\n");
    expect(draft?.name).toBe("הכנה להרצאה");
    expect(draft?.parts).toEqual([
      { kind: "task", text: "לסיים שקופיות" },
      { kind: "question", text: "מה הכי חשוב?" },
      { kind: "section", text: "סיכום" },
    ]);
  });

  test("a line already written as a checklist item is a task", () => {
    expect(parseSketch("Plan\n- [ ] Call the bank\n- [x] Done one")?.parts).toEqual([
      { kind: "task", text: "Call the bank" },
      { kind: "task", text: "Done one" },
    ]);
  });

  test("no name yet means no proposal", () => {
    expect(parseSketch("")).toBeNull();
    expect(parseSketch("   \n \n")).toBeNull();
  });

  test("a hint with no words stays as text, and the outline is capped", () => {
    expect(parseSketch("Name\n(tasks)")?.parts).toEqual([{ kind: "section", text: "(tasks)" }]);
    const long = `Name\n${"a".repeat(SKETCH_MAX_CHARS * 2)}`;
    expect(parseSketch(long)?.parts[0]?.text.length).toBe(SKETCH_MAX_CHARS - "Name\n".length);
  });

  test("the name alone still makes a template", () => {
    expect(sketchBody("Only a name", [])).toBe("# Only a name\n");
    expect(parseSketch("Only a name")?.counts).toEqual({ section: 0, task: 0, question: 0 });
  });
});
