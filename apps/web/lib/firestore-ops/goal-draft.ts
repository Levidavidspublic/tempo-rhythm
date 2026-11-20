import { checkGoalDoc, type GoalDoc } from "../firestore-docs/goal-doc";

export const GOAL_TITLE_MAX = 120;

type GoalDraftInput = {
  title: string;
  description?: string;
  targetDate?: number;
};

type GoalDraftResult = { ok: true; doc: GoalDoc } | { ok: false; reason: string };

function shortenTitle(title: string): string {
  let shortened = title.slice(0, GOAL_TITLE_MAX);
  const finalCodeUnit = shortened.charCodeAt(shortened.length - 1);

  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) {
    shortened = shortened.slice(0, -1);
  }

  return shortened;
}

export function draftGoal(input: GoalDraftInput, now: number): GoalDraftResult {
  const normalizedTitle = input.title.trim().replace(/\s+/g, " ");
  if (normalizedTitle === "") {
    return { ok: false, reason: "empty-title" };
  }

  if (
    input.targetDate !== undefined &&
    (!Number.isFinite(input.targetDate) || input.targetDate <= 0)
  ) {
    return { ok: false, reason: "invalid-target-date" };
  }

  const description = input.description?.trim();
  const candidate: GoalDoc = {
    title: shortenTitle(normalizedTitle),
    progressPercent: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...(description ? { description } : {}),
    ...(input.targetDate !== undefined ? { targetDate: input.targetDate } : {}),
  };

  return checkGoalDoc(candidate);
}
