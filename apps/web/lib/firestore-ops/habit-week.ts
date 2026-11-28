import type { HabitCheckInDoc } from "../firestore-docs/habit-doc";

type HabitWeekDay = {
  localDate: string;
  done: boolean;
  checkedAt?: number;
};

export function habitWeekStrip(
  checkIns: readonly HabitCheckInDoc[],
  habitId: string,
  localDates: readonly string[]
): { days: HabitWeekDay[]; doneCount: number } {
  const dates = [...new Set(localDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].slice(
    0,
    7
  );
  const latestCheckInByDate = new Map<string, number>();

  if (habitId !== "") {
    for (const checkIn of checkIns) {
      if (checkIn.habitId !== habitId || checkIn.deletedAt !== undefined) continue;

      const latestCheckedAt = latestCheckInByDate.get(checkIn.localDate);
      if (latestCheckedAt === undefined || checkIn.checkedAt > latestCheckedAt) {
        latestCheckInByDate.set(checkIn.localDate, checkIn.checkedAt);
      }
    }
  }

  let doneCount = 0;
  const days = dates.map((localDate): HabitWeekDay => {
    const checkedAt = latestCheckInByDate.get(localDate);
    if (checkedAt === undefined) return { localDate, done: false };

    doneCount += 1;
    return { localDate, done: true, checkedAt };
  });

  return { days, doneCount };
}
