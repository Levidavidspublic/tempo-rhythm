import { checkHabitDoc, type HabitDoc } from "../firestore-docs/habit-doc";

export const HABIT_NAME_MAX = 80;

type DraftHabitInput = {
  name: string;
  cadence?: string;
};

export function draftHabit(input: DraftHabitInput, now: number) {
  const normalizedName = input.name.trim().replace(/\s+/g, " ");
  if (normalizedName === "") return { ok: false as const, reason: "empty-name" };

  const cadence = input.cadence ?? "daily";
  if (cadence !== "daily" && cadence !== "weekly") {
    return { ok: false as const, reason: "invalid-cadence" };
  }

  let name = normalizedName.slice(0, HABIT_NAME_MAX);
  const finalCodeUnit = name.charCodeAt(name.length - 1);
  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) name = name.slice(0, -1);

  const checked = checkHabitDoc({
    name,
    cadence,
    currentStreak: 0,
    longestStreak: 0,
    createdAt: now,
    updatedAt: now,
  });

  return checked.ok ? checked : { ok: false as const, reason: checked.reason };
}

export function sortHabitsForList(habits: Array<HabitDoc & { id: string }>) {
  return habits
    .filter((habit) => habit.deletedAt === undefined)
    .slice()
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}
