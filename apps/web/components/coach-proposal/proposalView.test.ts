import { describe, expect, test } from "bun:test";
import {
  EMPTY_COPY,
  REALISM_OK,
  REALISM_TOO_MUCH,
  nextLoadNote,
  toView,
  type ProposalInput,
} from "./proposalView";

const tasks = [
  { taskId: "a", title: "Reply to Sam", minutes: 10 },
  { taskId: "b", title: "Book dentist", minutes: 5 },
];
const proposal = (ok: boolean, list = tasks): ProposalInput => ({
  tasks: list,
  tenSecondAction: "Open the document.",
  realism: { ok },
});
const settings = { taskLoad: 2 };
const calm = { isBadDay: false };

describe("toView", () => {
  test("ok realism", () => {
    const v = toView(proposal(true), settings, calm);
    expect(v.heading).toBe("Your plan for today");
    expect(v.taskLines).toEqual(["Reply to Sam (10 min)", "Book dentist (5 min)"]);
    expect(v.tenSecondAction).toBe("Open the document.");
    expect(v.realismNote).toBe(REALISM_OK);
    expect(v.loadNote).toBe("Today: 2 tasks");
  });

  test("not-ok realism asks about fewer", () => {
    expect(toView(proposal(false), settings, calm).realismNote).toBe(REALISM_TOO_MUCH);
    expect(REALISM_TOO_MUCH).toBe("This is a lot for the time you have. Want fewer?");
  });

  test("bad day says lighter", () => {
    expect(toView(proposal(true), settings, { isBadDay: true }).loadNote).toBe(
      "Lighter day: 2 tasks",
    );
  });

  test("empty and single task", () => {
    const empty = toView(proposal(true, []), settings, calm);
    expect(empty.taskLines).toEqual([]);
    expect(empty.loadNote).toBe("Today: 0 tasks");
    expect(EMPTY_COPY).toBe("Nothing to plan yet. Add a task or do a brain dump.");
    expect(toView(proposal(true, [tasks[0]]), undefined, undefined).loadNote).toBe("Today: 1 task");
  });

  test("no shame wording", () => {
    const v = toView(proposal(false), settings, { isBadDay: true });
    expect(JSON.stringify(v)).not.toMatch(new RegExp(["over" + "due", "mis" + "sed", "fai" + "led", "streak " + "lost"].join("|"), "i"));
  });

  test("next load note", () => {
    expect(nextLoadNote(3)).toBe("Next time: 3 tasks");
  });
});
