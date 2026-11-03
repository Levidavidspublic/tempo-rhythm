import { describe, expect, test } from "bun:test";
import { withoutTempoBlocks } from "@/components/editor/live-preview";

describe("copy gives Markdown without block JSON (contract ED-07)", () => {
  test("a closed json tempo fence in the selection adds nothing", () => {
    const text = 'Before\n```json tempo\n{"id":"blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2X","v":1,"type":"task","data":{}}\n```\nAfter';
    expect(withoutTempoBlocks(text)).toBe("Before\nAfter");
  });
  test("plain Markdown and ordinary code fences are copied as they are", () => {
    const text = "# Title\n\n- [ ] item\n\n```ts\nconst x = 1;\n```\n";
    expect(withoutTempoBlocks(text)).toBe(text);
  });
  test("a fence the user is still typing stays", () => {
    expect(withoutTempoBlocks("note\n```json tempo\n{")).toBe("note\n```json tempo\n{");
  });
});
