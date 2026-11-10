/** Pure load rules for the adaptive coach. Accept / reject is law; nothing here shames. */

export const MIN_LOAD = 2;
export const MAX_LOAD = 4;
export const STREAK_FOR_RAISE = 3;
export const DEFAULT_TASK_MINUTES = 25;
export const MS_PER_MINUTE = 60_000;

/** Load after an accept: 3 accepts in a row raise it by 1, up to 4. */
export function afterAccept(
  taskLoad: number,
  acceptedStreak: number,
): { taskLoad: number; acceptedStreak: number } {
  const streak = acceptedStreak + 1;
  if (streak >= STREAK_FOR_RAISE) {
    return { taskLoad: Math.min(MAX_LOAD, taskLoad + 1), acceptedStreak: 0 };
  }
  return { taskLoad, acceptedStreak: streak };
}

/** A reject costs nothing: load returns to 2 and the streak restarts (forgiveness contract). */
export function afterReject(): { taskLoad: number; acceptedStreak: number } {
  return { taskLoad: MIN_LOAD, acceptedStreak: 0 };
}

/** On a bad day the load is 2. */
export function effectiveLoad(taskLoad: number, isBadDay: boolean): number {
  return isBadDay ? MIN_LOAD : Math.max(MIN_LOAD, Math.min(MAX_LOAD, taskLoad));
}

/** Minutes from the task's estimate (ms) if it has one, else 25. */
export function taskMinutes(task: { timeEstimate?: number }): number {
  if (typeof task.timeEstimate === "number" && task.timeEstimate > 0) {
    return Math.max(1, Math.round(task.timeEstimate / MS_PER_MINUTE));
  }
  return DEFAULT_TASK_MINUTES;
}

export function checkRealism(
  tasks: { timeEstimate?: number }[],
  availableMinutes: number,
): { ok: boolean; totalMinutes: number; availableMinutes: number; note: string } {
  const totalMinutes = tasks.reduce((sum, t) => sum + taskMinutes(t), 0);
  const ok = totalMinutes <= availableMinutes;
  return {
    ok,
    totalMinutes,
    availableMinutes,
    note: ok
      ? "This fits the time you have. Pick it up when you are ready."
      : "This is more than the time you have today. Do what you can; the rest can wait, and that is fine.",
  };
}

/** One 10-second action, picked by code from a fixed list. */
export const TEN_SECOND_ACTIONS: readonly string[] = [
  "Take one slow breath, then put your hand on the first thing you need.",
  "Stand up and drink a sip of water.",
  "Open the first task and read just its title.",
  "Unclench your jaw and drop your shoulders once.",
  "Put one thing you do not need away from your desk.",
];

export function pickTenSecondAction(seed: number): string {
  const i = Math.abs(Math.floor(seed)) % TEN_SECOND_ACTIONS.length;
  return TEN_SECOND_ACTIONS[i] as string;
}
