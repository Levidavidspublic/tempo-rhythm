/**
 * Guided routine run (docs/design/v3/screens/mobile/routines.html, ?view=guide): one step at a
 * time; Done, Skip, Pause and Back. Skipping is a normal choice. Pure reducer, saved on the phone.
 */

export type StepMark = "done" | "skipped" | "open";

export type RoutineRun = {
  routineId: string;
  index: number;
  marks: StepMark[];
  paused: boolean;
  pausedAt: number | null;
  finished: boolean;
  updatedAt: number;
};

export type RunAction =
  | { type: "done"; now: number }
  | { type: "skip"; now: number }
  | { type: "back"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number };

export function startRun(routineId: string, steps: number, now: number): RoutineRun {
  return {
    routineId,
    index: 0,
    marks: Array.from({ length: Math.max(steps, 0) }, () => "open" as const),
    paused: false,
    pausedAt: null,
    finished: steps === 0,
    updatedAt: now,
  };
}

function mark(run: RoutineRun, value: StepMark, now: number): RoutineRun {
  const marks = [...run.marks];
  marks[run.index] = value;
  const last = run.index >= marks.length - 1;
  return {
    ...run,
    marks,
    index: last ? run.index : run.index + 1,
    finished: last,
    paused: false,
    pausedAt: null,
    updatedAt: now,
  };
}

export function runReducer(run: RoutineRun, action: RunAction): RoutineRun {
  if (run.finished) return run;
  switch (action.type) {
    case "done":
      return mark(run, "done", action.now);
    case "skip":
      return mark(run, "skipped", action.now);
    case "back": {
      if (run.index === 0) return run;
      const marks = [...run.marks];
      const index = run.index - 1;
      marks[index] = "open";
      return { ...run, marks, index, updatedAt: action.now };
    }
    case "pause":
      return run.paused ? run : { ...run, paused: true, pausedAt: action.now, updatedAt: action.now };
    case "resume":
      return run.paused ? { ...run, paused: false, pausedAt: null, updatedAt: action.now } : run;
    default:
      return run;
  }
}

export function runCounts(run: RoutineRun): { done: number; skipped: number } {
  return {
    done: run.marks.filter((m) => m === "done").length,
    skipped: run.marks.filter((m) => m === "skipped").length,
  };
}

/** A run worth offering to continue: started, not finished. */
export function isResumable(run: RoutineRun | null | undefined): run is RoutineRun {
  return !!run && !run.finished && (run.index > 0 || run.paused);
}

/** A saved run read back from storage, or null when it does not fit the routine any more. */
export function parseRun(raw: string | null, routineId: string, steps: number): RoutineRun | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RoutineRun>;
    if (value.routineId !== routineId || !Array.isArray(value.marks) || value.marks.length !== steps) return null;
    if (typeof value.index !== "number" || value.index < 0 || value.index >= steps) return null;
    return {
      routineId,
      index: value.index,
      marks: value.marks.map((m) => (m === "done" || m === "skipped" ? m : "open")),
      paused: value.paused === true,
      pausedAt: typeof value.pausedAt === "number" ? value.pausedAt : null,
      finished: value.finished === true,
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    };
  } catch {
    return null;
  }
}
