/**
 * Routines as Markdown pages (docs/design/v3/screens/web/routines.html: "a routine is a page
 * with a step list"). Until a routines backend exists, a routine is any page tagged `#routine`;
 * its list items are the steps, in order. A time after the tag (`#routine 07:30`) is when it
 * usually happens. The guided run (routine-detail.html) is a small pure state machine.
 */

export const ROUTINE_TAG = "#routine";

export type RoutineStep = {
  title: string;
  note?: string;
  minutes?: number;
};

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const TAG = /(^|[\s(])#routine(?=$|[\s.,;:!?)])/i;
const TIME = /(?:^|[^\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/;
// Top-level items start in the first column (one space allowed); deeper ones belong to the step above.
const LIST_ITEM = /^( ?)(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$)(.*)$/;
const NESTED_ITEM = /^\s+(?:[-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const CHECKBOX = /^\[[ xX]\][ \t]+/;
const MINUTES = /\s*\((\d{1,3})\s*(?:min|mins|minutes|m|דק׳|דק'|דקות|דקה)\)\s*$/i;

/** Lines outside fenced code blocks (Tempo blocks are fenced too). */
function proseLines(body: string): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const match = FENCE.exec(line);
    if (fence) {
      if (match && match[1]?.[0] === fence[0] && (match[1]?.length ?? 0) >= fence.length)
        fence = null;
      continue;
    }
    if (match) {
      fence = match[1] as string;
      continue;
    }
    out.push(line);
  }
  return out;
}

/** Four spaces or a tab: Markdown indented code, unless the line is a nested list item. */
const INDENTED_CODE = /^(?: {4}|\t)/;

/**
 * Lines where a tag counts: outside fenced and indented code. An indented line counts only as a
 * nested item directly under a list; on its own, `    - #routine` is still indented code.
 */
function tagLines(body: string): string[] {
  const out: string[] = [];
  let inList = false;
  for (const line of proseLines(body)) {
    if (!line.trim()) {
      inList = false;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      inList = true;
      out.push(line);
      continue;
    }
    if (INDENTED_CODE.test(line)) {
      if (inList && NESTED_ITEM.test(line)) out.push(line);
      continue;
    }
    inList = false;
    out.push(line);
  }
  return out;
}

/** True when the page carries the `#routine` tag outside code. */
export function isRoutinePage(body: string): boolean {
  return tagLines(body).some((line) => TAG.test(line));
}

/** "07:30" from the first tagged line with a time after the tag (`#routine 07:30`), or null. */
export function routineUsualTime(body: string): string | null {
  for (const line of tagLines(body)) {
    const tag = TAG.exec(line);
    if (!tag) continue;
    // Only what follows the tag: "Meet at 09:00 #routine" has no usual time.
    const match = TIME.exec(line.slice(tag.index + tag[0].length));
    if (match) return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }
  return null;
}

/** Plain step text: no tag, no wiki brackets, no bold or code marks. */
function plain(text: string): string {
  return text
    .replace(TAG, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The page's steps: every top-level list item (bullets, numbers or checkboxes), in order.
 * A trailing "(5 min)" is the step's length. Indented lines under an item are its note.
 */
export function parseRoutineSteps(body: string): RoutineStep[] {
  const steps: RoutineStep[] = [];
  let current: { title: string; note: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    let title = current.title;
    let minutes: number | undefined;
    const length = MINUTES.exec(title);
    if (length) {
      minutes = Number(length[1]);
      title = title.slice(0, length.index);
    }
    title = plain(title);
    if (title) {
      const note = plain(current.note.join(" "));
      steps.push({ title, ...(note ? { note } : {}), ...(minutes ? { minutes } : {}) });
    }
    current = null;
  };
  for (const line of proseLines(body)) {
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      current = { title: (item[2] ?? "").replace(CHECKBOX, ""), note: [] };
      continue;
    }
    if (!current) continue;
    if (line.trim() === "") continue;
    if (/^\s{2,}\S/.test(line)) {
      const nested = NESTED_ITEM.exec(line);
      current.note.push((nested ? (nested[1] ?? "") : line).replace(CHECKBOX, ""));
      continue;
    }
    flush();
  }
  flush();
  return steps;
}

/** The sum of the steps' lengths, or null when no step says how long it takes. */
export function totalMinutes(steps: readonly RoutineStep[]): number | null {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.minutes) {
      total += step.minutes;
      known = true;
    }
  }
  return known ? total : null;
}

/** The body of a new routine page: the tag, then an empty numbered list to type the steps in. */
export function newRoutineBody(): string {
  return `${ROUTINE_TAG}\n\n1. `;
}

function minutesOf(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * The routine that fits the local time of day (`nowMinutes` since midnight): its usual time is at
 * most an hour ahead or two hours behind. The closest one wins; null when none fits.
 */
export function routineThatFitsNow<T extends { usualTime: string | null }>(
  routines: readonly T[],
  nowMinutes: number
): T | null {
  let best: T | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const routine of routines) {
    const usual = routine.usualTime ? minutesOf(routine.usualTime) : null;
    if (usual === null) continue;
    // Signed gap in (-720, 720]: positive when the usual time has passed.
    let gap = (((nowMinutes - usual) % 1440) + 1440) % 1440;
    if (gap > 720) gap -= 1440;
    if (gap < -60 || gap > 120) continue;
    if (Math.abs(gap) < bestGap) {
      best = routine;
      bestGap = Math.abs(gap);
    }
  }
  return best;
}

/* ---------- Guided run ---------- */

export type StepStatus = "done" | "now" | "skipped" | "next";

export type RoutineRun = {
  /** The current step; equal to the step count once the run is finished. */
  index: number;
  statuses: StepStatus[];
  paused: boolean;
};

export function startRun(count: number): RoutineRun {
  return {
    index: 0,
    statuses: Array.from({ length: count }, (_, k) => (k === 0 ? "now" : "next")),
    paused: false,
  };
}

export function isRunFinished(run: RoutineRun): boolean {
  return run.statuses.length > 0 && run.index >= run.statuses.length;
}

/** Done or skipped: the current step gets that word and the next one becomes Now. */
export function finishStep(run: RoutineRun, kind: "done" | "skipped"): RoutineRun {
  if (run.paused || run.index >= run.statuses.length) return run;
  const statuses = [...run.statuses];
  statuses[run.index] = kind;
  const index = run.index + 1;
  if (index < statuses.length) statuses[index] = "now";
  return { ...run, index, statuses };
}

/** Back a step: the previous step is Now again; the one that was Now waits as Up next. */
export function reopenStep(run: RoutineRun): RoutineRun {
  if (run.paused || run.index === 0 || isRunFinished(run)) return run;
  const statuses = [...run.statuses];
  statuses[run.index] = "next";
  const index = run.index - 1;
  statuses[index] = "now";
  return { ...run, index, statuses };
}

/** Pause keeps the place; Resume picks it up. A finished run does not pause. */
export function togglePause(run: RoutineRun): RoutineRun {
  if (isRunFinished(run)) return run;
  return { ...run, paused: !run.paused };
}

export function runTally(run: RoutineRun): { done: number; skipped: number } {
  let done = 0;
  let skipped = 0;
  for (const status of run.statuses) {
    if (status === "done") done += 1;
    else if (status === "skipped") skipped += 1;
  }
  return { done, skipped };
}
