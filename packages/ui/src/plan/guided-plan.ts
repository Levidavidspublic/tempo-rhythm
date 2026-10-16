import { type TempoBlockSpec, tempoBlockToSpec } from "../blocks/block-spec";

/**
 * GuidedPlanCard logic (kitchen S9): the pure side of a step plan the person can Accept, Edit or
 * Reject. Editing is a reducer over the steps; nothing here reads a clock, the network or React.
 *
 * A step has two halves:
 * - its content (`id`, `title`, `minutes`, `kind`), which moves when the person moves the step;
 * - its slot (`date`, `startMinute`, `groupId`, `groupLabel`), which stays where it is in the list.
 * Moving a step up therefore puts it into the earlier slot, and the step that was there drops into
 * the later one. After every change, steps on the same date follow each other from that date's
 * first start time again, so the times stay true to the lengths.
 */

export type GuidedStepKind = "learn" | "review" | "practice" | "rest" | "task";
export type GuidedStepStatus = "todo" | "doing" | "done";

export const GUIDED_STEP_STATUSES: readonly GuidedStepStatus[] = ["todo", "doing", "done"];

export type GuidedStep = {
  /** Stable for the life of the card; never shown. */
  id: string;
  title: string;
  /** Length in whole minutes. While editing it can hold an invalid value (NaN, 0). */
  minutes: number;
  kind: GuidedStepKind;
  /** Local `YYYY-MM-DD`. Part of the slot. */
  date?: string;
  /** Minutes after local midnight, 0 to 1439. Part of the slot. */
  startMinute?: number;
  /** Steps with the same group id, next to each other, are drawn under one heading. */
  groupId?: string;
  groupLabel?: string;
};

/** Limits the editor checks before Accept: a minute to 12 hours, as the plans backend takes. */
export const GUIDED_LIMITS = {
  minMinutes: 1,
  maxMinutes: 720,
  maxTitle: 200,
  minSteps: 1,
} as const;

const LAST_MINUTE = 1439;

export type GuidedEditAction =
  | { type: "rename"; id: string; title: string }
  | { type: "setMinutes"; id: string; minutes: number }
  | { type: "move"; id: string; by: -1 | 1 }
  | { type: "remove"; id: string }
  | { type: "reset"; steps: readonly GuidedStep[] };

type Content = Pick<GuidedStep, "id" | "title" | "minutes" | "kind">;
type Slot = Omit<GuidedStep, keyof Content>;

function content(step: GuidedStep): Content {
  return { id: step.id, title: step.title, minutes: step.minutes, kind: step.kind };
}

function slot(step: GuidedStep): Slot {
  const { id: _id, title: _title, minutes: _minutes, kind: _kind, ...rest } = step;
  return rest;
}

/**
 * Steps on the same date, next to each other, follow one another from the first one's start.
 * A step without a date or start time is left as it is. Times never pass 23:59.
 */
export function restack(steps: readonly GuidedStep[]): GuidedStep[] {
  const out: GuidedStep[] = [];
  for (const step of steps) {
    const prev = out.at(-1);
    if (
      prev &&
      step.date !== undefined &&
      step.startMinute !== undefined &&
      prev.date === step.date &&
      prev.startMinute !== undefined
    ) {
      const length = Number.isFinite(prev.minutes) && prev.minutes > 0 ? prev.minutes : 0;
      out.push({ ...step, startMinute: Math.min(prev.startMinute + length, LAST_MINUTE) });
    } else {
      out.push({ ...step });
    }
  }
  return out;
}

/** The editor's reducer. Unknown ids and moves past either end leave the steps unchanged. */
export function guidedEditReducer(
  steps: readonly GuidedStep[],
  action: GuidedEditAction
): GuidedStep[] {
  switch (action.type) {
    case "reset":
      return restack(action.steps);
    case "rename":
      return steps.map((s) => (s.id === action.id ? { ...s, title: action.title } : s));
    case "setMinutes":
      return restack(steps.map((s) => (s.id === action.id ? { ...s, minutes: action.minutes } : s)));
    case "remove": {
      const at = steps.findIndex((s) => s.id === action.id);
      if (at < 0) return [...steps];
      const gone = steps[at] as GuidedStep;
      const next = steps.filter((s) => s.id !== action.id);
      // The day still starts when it did: the step after it on that date takes its start time.
      const follower = next[at];
      if (follower && follower.date === gone.date && gone.startMinute !== undefined) {
        next[at] = { ...follower, startMinute: gone.startMinute };
      }
      return restack(next);
    }
    case "move": {
      const from = steps.findIndex((s) => s.id === action.id);
      const to = from + action.by;
      if (from < 0 || to < 0 || to >= steps.length) return [...steps];
      const next = [...steps];
      const a = steps[from] as GuidedStep;
      const b = steps[to] as GuidedStep;
      // Contents swap; each slot stays at its position.
      next[to] = { ...slot(b), ...content(a) };
      next[from] = { ...slot(a), ...content(b) };
      return restack(next);
    }
  }
}

export type GuidedStepError = "titleEmpty" | "titleLong" | "minutesRange";

/** What is wrong with one step, or null. */
export function stepError(step: GuidedStep): GuidedStepError | null {
  const title = step.title.trim();
  if (title === "") return "titleEmpty";
  if (title.length > GUIDED_LIMITS.maxTitle) return "titleLong";
  if (
    !Number.isInteger(step.minutes) ||
    step.minutes < GUIDED_LIMITS.minMinutes ||
    step.minutes > GUIDED_LIMITS.maxMinutes
  ) {
    return "minutesRange";
  }
  return null;
}

export type GuidedValidation = {
  ok: boolean;
  /** Step id → its problem. */
  errors: Record<string, GuidedStepError>;
  /** True when there are fewer steps than `GUIDED_LIMITS.minSteps`. */
  tooFew: boolean;
};

export function validateGuidedPlan(steps: readonly GuidedStep[]): GuidedValidation {
  const errors: Record<string, GuidedStepError> = {};
  for (const step of steps) {
    const error = stepError(step);
    if (error) errors[step.id] = error;
  }
  const tooFew = steps.length < GUIDED_LIMITS.minSteps;
  return { ok: !tooFew && Object.keys(errors).length === 0, errors, tooFew };
}

/** Trimmed titles, as Accept hands them to the host. */
export function cleanSteps(steps: readonly GuidedStep[]): GuidedStep[] {
  return steps.map((s) => ({ ...s, title: s.title.trim() }));
}

export type GuidedGroup = { id: string; label: string | null; steps: GuidedStep[] };

/**
 * Neighbouring steps with the same `groupId` form one group, in list order. Steps without a group
 * id share one unlabelled group, so a plan with no groups is a single list.
 */
export function groupSteps(steps: readonly GuidedStep[]): GuidedGroup[] {
  const groups: GuidedGroup[] = [];
  for (const step of steps) {
    const id = step.groupId ?? "";
    const last = groups.at(-1);
    if (last && last.id === id) last.steps.push(step);
    else groups.push({ id, label: step.groupLabel ?? null, steps: [step] });
  }
  return groups;
}

export type GuidedSummary = {
  steps: number;
  /** Distinct dates the steps sit on (0 when no step has a date). */
  days: number;
  totalMinutes: number;
  hours: number;
  minutes: number;
};

/** The numbers behind the one-line "what this adds". Invalid lengths count as 0. */
export function summarizeGuidedPlan(steps: readonly GuidedStep[]): GuidedSummary {
  let totalMinutes = 0;
  const dates = new Set<string>();
  for (const step of steps) {
    if (Number.isFinite(step.minutes) && step.minutes > 0) totalMinutes += Math.round(step.minutes);
    if (step.date) dates.add(step.date);
  }
  return {
    steps: steps.length,
    days: dates.size,
    totalMinutes,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

/** 0–1439 → "09:30". */
export function formatStepClock(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** The status shown for a step: the host's value, else "todo". */
export function statusOf(
  statuses: Readonly<Record<string, GuidedStepStatus>> | undefined,
  id: string
): GuidedStepStatus {
  return statuses?.[id] ?? "todo";
}

/* ------------------------------------------------------------------ */
/* json-render bridge                                                  */
/* ------------------------------------------------------------------ */

/** Never rendered and never stored: the bridge needs a valid envelope id to check a block. */
const DISPLAY_ONLY_BLOCK_ID = "blk_00000000000000000000000000";

const BLOCK_STATUS: Record<GuidedStepStatus, "later" | "now" | "done"> = {
  todo: "later",
  doing: "now",
  done: "done",
};

/**
 * The task block a step becomes, the same shape a saved plan keeps on a page: To do is "later",
 * Doing is "now", Done is "done". Lengths are clamped into the block's range so a half-typed
 * value still draws; Accept is gated on `validateGuidedPlan`, not on this.
 */
export function guidedStepBlock(step: GuidedStep, index: number, status: GuidedStepStatus) {
  const minutes = Number.isFinite(step.minutes) ? Math.round(step.minutes) : 1;
  return {
    type: "task" as const,
    id: DISPLAY_ONLY_BLOCK_ID,
    v: 1 as const,
    data: {
      title: step.title.trim() === "" ? " " : step.title,
      durationMin: Math.min(Math.max(minutes, 1), 1440),
      status: BLOCK_STATUS[status],
      order: index,
      inelastic: false,
    },
  };
}

/** One display-only json-render spec per step (no checkbox binding, no action). */
export function guidedStepSpecs(
  steps: readonly GuidedStep[],
  statuses?: Readonly<Record<string, GuidedStepStatus>>
): TempoBlockSpec[] {
  return steps.map((step, index) =>
    tempoBlockToSpec(guidedStepBlock(step, index, statusOf(statuses, step.id)), {
      interactive: false,
    })
  );
}
