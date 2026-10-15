import { describe, expect, test } from "bun:test";
import {
  finishStep,
  isRoutinePage,
  isRunFinished,
  newRoutineBody,
  parseRoutineSteps,
  reopenStep,
  routineThatFitsNow,
  routineUsualTime,
  runTally,
  startRun,
  togglePause,
  totalMinutes,
} from "./routines";

const MORNING = `#routine 07:30

1. Drink a glass of water (1 min)
   There's a glass by the kettle.
2. Take your meds with **breakfast** (5 min)
   Blue box, top shelf.
3. Open the curtains
- [ ] Look at today's [[Plan|plan]] (3 min)
- [x] Pack your bag (5 דק׳)
  - Keys, wallet, laptop

Notes after the list are not steps.

\`\`\`
1. not a step either
\`\`\`
`;

describe("routine pages", () => {
  test("the #routine tag marks a routine, but not inside code or as part of a longer word", () => {
    expect(isRoutinePage(MORNING)).toBe(true);
    expect(isRoutinePage("Morning\n\n(#Routine) steps")).toBe(true);
    expect(isRoutinePage("#routines are nice")).toBe(false);
    expect(isRoutinePage("```\n#routine\n```")).toBe(false);
    expect(isRoutinePage("no tag here")).toBe(false);
  });

  test("a time after the tag is when it usually happens", () => {
    expect(routineUsualTime(MORNING)).toBe("07:30");
    expect(routineUsualTime("#routine 7:05 most days")).toBe("07:05");
    // A time before the tag is prose, not the usual time.
    expect(routineUsualTime("Meet at 09:00 #routine")).toBeNull();
    expect(routineUsualTime("Meet at 09:00 #routine 07:30")).toBe("07:30");
  });

  test("a tag inside indented code does not make a routine", () => {
    expect(isRoutinePage("Notes on tags:\n\n    #routine\n")).toBe(false);
    expect(isRoutinePage("\t#routine 07:30\n")).toBe(false);
    expect(isRoutinePage("- Stretch\n    - Breathe #routine\n")).toBe(true);
    // A bullet-looking indented line with no list above it is still code.
    expect(isRoutinePage("Example:\n\n    - #routine 07:30\n")).toBe(false);
    expect(isRoutinePage("\t- #routine\n")).toBe(false);
    expect(routineUsualTime("    - #routine 07:30")).toBeNull();
    expect(routineUsualTime("#routine")).toBeNull();
    expect(routineUsualTime("#routine 24:00")).toBeNull();
    expect(routineUsualTime("Meet at 09:00\n#routine")).toBeNull();
  });

  test("list items are the steps, with lengths and notes", () => {
    expect(parseRoutineSteps(MORNING)).toEqual([
      { title: "Drink a glass of water", note: "There's a glass by the kettle.", minutes: 1 },
      { title: "Take your meds with breakfast", note: "Blue box, top shelf.", minutes: 5 },
      { title: "Open the curtains" },
      { title: "Look at today's plan", minutes: 3 },
      { title: "Pack your bag", note: "Keys, wallet, laptop", minutes: 5 },
    ]);
  });

  test("a new routine page is tagged and has no steps yet", () => {
    const body = newRoutineBody();
    expect(isRoutinePage(body)).toBe(true);
    expect(parseRoutineSteps(body)).toEqual([]);
  });

  test("total minutes add the known lengths, or say nothing", () => {
    expect(totalMinutes(parseRoutineSteps(MORNING))).toBe(14);
    expect(totalMinutes([{ title: "Stretch" }])).toBeNull();
  });
});

describe("fits right now", () => {
  const routines = [
    { id: "morning", usualTime: "07:30" },
    { id: "evening", usualTime: "22:00" },
    { id: "weekend", usualTime: null },
  ];

  test("an hour ahead or two hours behind fits; the closest wins", () => {
    expect(routineThatFitsNow(routines, 6 * 60 + 45)?.id).toBe("morning");
    expect(routineThatFitsNow(routines, 9 * 60)?.id).toBe("morning");
    expect(routineThatFitsNow(routines, 12 * 60)).toBeNull();
    expect(routineThatFitsNow(routines, 23 * 60 + 30)?.id).toBe("evening");
  });

  test("the window wraps around midnight", () => {
    expect(routineThatFitsNow([{ usualTime: "23:30" }], 30)).not.toBeNull();
    expect(routineThatFitsNow([{ usualTime: "00:15" }], 23 * 60 + 30)).not.toBeNull();
  });
});

describe("guided run", () => {
  test("done and skip move on; skipping is just a word, not a failure", () => {
    let run = startRun(3);
    expect(run.statuses).toEqual(["now", "next", "next"]);
    run = finishStep(run, "done");
    run = finishStep(run, "skipped");
    expect(run).toMatchObject({ index: 2, statuses: ["done", "skipped", "now"] });
    run = finishStep(run, "done");
    expect(isRunFinished(run)).toBe(true);
    expect(runTally(run)).toEqual({ done: 2, skipped: 1 });
    expect(finishStep(run, "done")).toBe(run);
  });

  test("pause keeps the place and holds every move until Resume", () => {
    let run = finishStep(startRun(3), "done");
    run = togglePause(run);
    expect(finishStep(run, "done")).toBe(run);
    expect(reopenStep(run)).toBe(run);
    run = togglePause(run);
    expect(run).toMatchObject({ index: 1, paused: false });
  });

  test("back a step reopens the previous step", () => {
    const run = reopenStep(finishStep(startRun(3), "skipped"));
    expect(run).toMatchObject({ index: 0, statuses: ["now", "next", "next"] });
    expect(reopenStep(run)).toBe(run);
  });

  test("an empty routine has nothing to run", () => {
    const run = startRun(0);
    expect(isRunFinished(run)).toBe(false);
    expect(finishStep(run, "done")).toBe(run);
  });
});
