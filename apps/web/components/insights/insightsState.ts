export type InsightsState = "loading" | "signed-out" | "empty" | "ready" | "error";

export type InsightsStateInput = {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  /** `undefined` = loading or skipped, `null` = no Convex user row. */
  profile: unknown;
  summary:
    | {
        tasksOpen: number;
        tasksCompletedThisWeek: number;
        habitsTotal: number;
        goalsActive: number;
      }
    | null
    | undefined;
  /** The summary query threw, or loading ran past the allowed wait. */
  failed: boolean;
};

/**
 * Maps auth/profile/summary to one screen state. "loading" is only returned
 * while something is genuinely still in flight and nothing has failed, so the
 * skeleton can never be the answer once auth is done and the profile is null.
 */
export function deriveInsightsState(input: InsightsStateInput): InsightsState {
  const { isAuthLoading, isAuthenticated, profile, summary, failed } = input;
  if (failed) return "error";
  if (isAuthLoading) return "loading";
  if (!isAuthenticated) return "signed-out";
  if (profile === undefined) return "loading";
  if (profile === null) return "signed-out";
  if (summary === undefined) return "loading";
  if (summary === null) return "error";
  const nothingTrackedYet =
    summary.tasksOpen === 0 &&
    summary.tasksCompletedThisWeek === 0 &&
    summary.habitsTotal === 0 &&
    summary.goalsActive === 0;
  return nothingTrackedYet ? "empty" : "ready";
}
