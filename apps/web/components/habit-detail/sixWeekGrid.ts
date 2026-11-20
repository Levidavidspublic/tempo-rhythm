import { startOfLocalWeekMondayMs } from "@/lib/localDay";

/** One local day in the 6-week habit grid. */
export type SixWeekCell = {
  localDate: string;
  checked: boolean;
  isFuture: boolean;
  isToday: boolean;
};

export type SixWeekRow = [
  SixWeekCell,
  SixWeekCell,
  SixWeekCell,
  SixWeekCell,
  SixWeekCell,
  SixWeekCell,
  SixWeekCell,
];

/** Six Monday-start weeks, ending with the week that contains `today`. */
export type SixWeekGrid = [SixWeekRow, SixWeekRow, SixWeekRow, SixWeekRow, SixWeekRow, SixWeekRow];

const WEEKS = 6;
const DAYS = 7;

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cellAt(day: Date, todayKey: string, checkedDates: Set<string>): SixWeekCell {
  const localDate = formatLocalDate(day);
  return {
    localDate,
    checked: checkedDates.has(localDate),
    isFuture: localDate > todayKey,
    isToday: localDate === todayKey,
  };
}

/**
 * 42 local days ending with the Monday-start week that contains `today`.
 * Dates are `YYYY-MM-DD`. Days after `today` are `isFuture`.
 */
export function buildSixWeekGrid(today: Date, checkedDates: Set<string>): SixWeekGrid {
  const weekStart = new Date(startOfLocalWeekMondayMs(today));
  const gridStart = new Date(weekStart);
  gridStart.setDate(gridStart.getDate() - (WEEKS - 1) * DAYS);
  const todayKey = formatLocalDate(today);

  const rows: SixWeekRow[] = [];
  for (let week = 0; week < WEEKS; week++) {
    const cells: SixWeekCell[] = [];
    for (let dayIndex = 0; dayIndex < DAYS; dayIndex++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + week * DAYS + dayIndex);
      cells.push(cellAt(day, todayKey, checkedDates));
    }
    rows.push(cells as SixWeekRow);
  }
  return rows as SixWeekGrid;
}
