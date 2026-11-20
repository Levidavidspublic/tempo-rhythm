import { expect, test } from "bun:test";

import { draftBrainDumpTasks, listBrainDumpLines } from "./brain-dump-tasks";

test("splits lines and drops empty ones", () => {
  expect(listBrainDumpLines(" First\r\n\nSecond\r Third ").lines).toEqual([
    { index: 0, title: "First" },
    { index: 1, title: "Second" },
    { index: 2, title: "Third" },
  ]);
});

test("strips list markers and checkbox markers", () => {
  const result = listBrainDumpLines(
    "- dash\n* star\n• bullet\n1. dot\n2) paren\n[ ] open\n[x] done\n- [ ] nested open\n- [x] nested done"
  );
  expect(result.lines.map(({ title }) => title)).toEqual([
    "dash",
    "star",
    "bullet",
    "dot",
    "paren",
    "open",
    "done",
    "nested open",
    "nested done",
  ]);
});

test("drops repeats ignoring case and spacing", () => {
  const result = listBrainDumpLines("Plan   trip\nplan trip\nPLAN    TRIP\nCall Mum");
  expect(result).toEqual({
    lines: [
      { index: 0, title: "Plan   trip" },
      { index: 1, title: "Call Mum" },
    ],
    droppedRepeats: 2,
    overLimit: false,
  });
});

test("stops at 50 and sets overLimit", () => {
  const result = listBrainDumpLines(
    Array.from({ length: 51 }, (_, index) => `Task ${index + 1}`).join("\n")
  );
  expect(result.lines).toHaveLength(50);
  expect(result.lines.at(-1)).toEqual({ index: 49, title: "Task 50" });
  expect(result.overLimit).toBe(true);
});

test("keeps a Hebrew line as typed", () => {
  expect(listBrainDumpLines("  להתקשר לאמא  ").lines).toEqual([
    { index: 0, title: "להתקשר לאמא" },
  ]);
});

test("turns kept lines into checked todo task documents", () => {
  const result = draftBrainDumpTasks([" First task ", "Second task"], 1_700_000_000_000);
  expect(result).toEqual({
    ok: true,
    tasks: [
      {
        title: "First task",
        status: "todo",
        priority: "medium",
        energy: "medium",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
      {
        title: "Second task",
        status: "todo",
        priority: "medium",
        energy: "medium",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
    ],
    refused: 0,
  });
});

test("refuses an empty kept list", () => {
  expect(draftBrainDumpTasks([], 1)).toEqual({ ok: false, reason: "nothing-kept" });
});

test("refuses a bad time", () => {
  expect(draftBrainDumpTasks(["Task"], Number.NaN)).toEqual({
    ok: false,
    reason: "bad-time",
  });
});
