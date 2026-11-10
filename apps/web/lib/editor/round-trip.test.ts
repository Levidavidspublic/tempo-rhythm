import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EditorState } from "@codemirror/state";
import { parseTempoBlocks, serializeTempoBlocks } from "@tempo/utils";
import { LINE_SEPARATOR, setTaskDone, tempoBlockRanges } from "./markdown-model";

/**
 * OVERNIGHT-RUN.md decision 2: saving is byte-exact. An untouched page loads into the editor and
 * saves back identical. The fixture holds every Tempo block type (page-meta, task, template, a
 * broken block), Hebrew + English mixed paragraphs, a GFM table, code and tilde fences, a plain
 * `- [ ]` checkbox, emoji with joiners, bidi marks, tabs and trailing whitespace, and no final
 * newline.
 */
const FIXTURE = readFileSync(join(import.meta.dir, "fixtures", "round-trip.md"), "utf8");

/** What the editor does with a body: load it into a CodeMirror state and read the doc back. */
function loadAndSave(body: string): string {
  const state = EditorState.create({ doc: body, extensions: [EditorState.lineSeparator.of(LINE_SEPARATOR)] });
  return state.doc.toString();
}

describe("byte-exact round trip", () => {
  test("the fixture really holds every block type, Hebrew, English and a GFM table", () => {
    const kinds = parseTempoBlocks(FIXTURE).map((s) => (s.kind === "valid" ? s.block.type : s.kind));
    expect(kinds).toContain("page-meta");
    expect(kinds).toContain("task");
    expect(kinds).toContain("template");
    expect(kinds).toContain("broken");
    expect(FIXTURE).toMatch(/[֐-׿]/);
    expect(FIXTURE).toContain("| :--- | ---: | :---: |");
    expect(FIXTURE.endsWith("\n")).toBe(false);
  });

  test("an untouched page loads and saves back identical", () => {
    expect(loadAndSave(FIXTURE)).toBe(FIXTURE);
  });

  test("CRLF and lone CR bodies are not normalised", () => {
    const crlf = FIXTURE.replace(/\n/g, "\r\n");
    expect(loadAndSave(crlf)).toBe(crlf);
    const mixed = "a\r\nb\rc\nd";
    expect(loadAndSave(mixed)).toBe(mixed);
  });

  test("an edit that is undone saves back identical", () => {
    const state = EditorState.create({ doc: FIXTURE, extensions: [EditorState.lineSeparator.of(LINE_SEPARATOR)] });
    const edited = state.update({ changes: { from: 10, insert: "XYZ" } }).state;
    expect(edited.doc.toString()).not.toBe(FIXTURE);
    const reverted = edited.update({ changes: { from: 10, to: 13 } }).state;
    expect(reverted.doc.toString()).toBe(FIXTURE);
  });

  test("the codec serialises the parsed fixture back byte for byte", () => {
    expect(serializeTempoBlocks(parseTempoBlocks(FIXTURE))).toBe(FIXTURE);
  });

  test("ticking one task changes only that block's source", () => {
    const ranges = tempoBlockRanges(FIXTURE);
    const task = ranges.find((r) => r.segment.kind === "valid" && r.segment.block.type === "task");
    expect(task).toBeDefined();
    const next = setTaskDone(FIXTURE, task!, true);
    expect(next.slice(0, task!.from)).toBe(FIXTURE.slice(0, task!.from));
    const tailLength = FIXTURE.length - task!.to;
    expect(next.slice(next.length - tailLength)).toBe(FIXTURE.slice(task!.to));
    const after = parseTempoBlocks(next).filter((s) => s.kind !== "markdown");
    const before = parseTempoBlocks(FIXTURE).filter((s) => s.kind !== "markdown");
    expect(after.length).toBe(before.length);
    const ticked = after.find((s) => s.kind === "valid" && s.block.id === (task!.segment as { block: { id: string } }).block.id);
    expect(ticked?.kind === "valid" && ticked.block.type === "task" && ticked.block.data.status).toBe("done");
  });
});
