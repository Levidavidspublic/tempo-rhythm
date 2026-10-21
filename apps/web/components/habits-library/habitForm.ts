/** Pure helpers for the habits library form and links. */

export const HABIT_NAME_MAX = 80;

export type ParsedHabitName = { ok: true; name: string } | { ok: false; error: string };

export function parseHabitName(input: string): ParsedHabitName {
  const name = input.trim();
  if (name.length === 0) {
    return { ok: false, error: "Give the habit a name." };
  }
  if (name.length > HABIT_NAME_MAX) {
    return { ok: false, error: `Keep the name to ${HABIT_NAME_MAX} characters or fewer.` };
  }
  return { ok: true, name };
}

export function habitHref(id: string): string {
  return `/habits/${id}`;
}
