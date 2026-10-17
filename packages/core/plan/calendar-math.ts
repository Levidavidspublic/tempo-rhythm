/**
 * Local calendar dates as plain `YYYY-MM-DD` strings, kitchen T8.
 *
 * Pure functions, no clock and no `Date`: every helper works on year / month / day integers
 * through a day number (days since 1970-01-01 in the proleptic Gregorian calendar), so there are
 * no time zones, no DST hours and no surprises at month or year ends. Callers pass `today`.
 *
 * Weekdays follow `Date#getDay`: 0 = Sunday … 6 = Saturday. A Hebrew calendar week starts on
 * Sunday (`weekStartsOn: 0`); the default here is Monday (`weekStartsOn: 1`), like the web
 * calendar's week view.
 */

/** A local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string;

/** 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type YearMonthDay = { year: number; month: number; day: number };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month, `month` 1–12. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Splits a `YYYY-MM-DD` date. Throws a RangeError for anything else. */
export function parseLocalDate(date: LocalDate): YearMonthDay {
  if (!isLocalDate(date)) throw new RangeError(`not a YYYY-MM-DD date: ${String(date)}`);
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/** Writes a date as `YYYY-MM-DD`. Throws a RangeError for an impossible date. */
export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  const text = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!isLocalDate(text)) throw new RangeError(`not a calendar date: ${year}-${month}-${day}`);
  return text;
}

/** Days since 1970-01-01 (H. Hinnant's `days_from_civil`). */
export function toDayNumber(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const shiftedMonth = (month + 9) % 12;
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** The date for a day number (H. Hinnant's `civil_from_days`). */
export function fromDayNumber(dayNumber: number): LocalDate {
  if (!Number.isInteger(dayNumber)) throw new RangeError("day number must be an integer");
  const z = dayNumber + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36524) -
      Math.floor(dayOfEra / 146096)) /
      365
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1;
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return formatLocalDate(year, month, day);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) throw new RangeError("days must be an integer");
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** -1, 0 or 1, for sorting. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return Math.sign(toDayNumber(a) - toDayNumber(b));
}

/** 0 = Sunday … 6 = Saturday. 1970-01-01 was a Thursday. */
export function weekday(date: LocalDate): Weekday {
  return ((((toDayNumber(date) + 4) % 7) + 7) % 7) as Weekday;
}

export type WeekOptions = { weekStartsOn?: Weekday };

function checkWeekStart(weekStartsOn: number): Weekday {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new RangeError("weekStartsOn must be an integer from 0 (Sunday) to 6 (Saturday)");
  }
  return weekStartsOn as Weekday;
}

/** The first day of the week holding `date`. Monday-first unless `weekStartsOn` says otherwise. */
export function startOfWeek(date: LocalDate, options: WeekOptions = {}): LocalDate {
  const first = checkWeekStart(options.weekStartsOn ?? 1);
  const back = (weekday(date) - first + 7) % 7;
  return addDays(date, -back);
}

/** The 7 dates of the week starting on `weekStart`. */
export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Every date from `from` to `to`, both included. Empty when `to` is earlier. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const start = toDayNumber(from);
  const count = toDayNumber(to) - start + 1;
  return count > 0 ? Array.from({ length: count }, (_, index) => fromDayNumber(start + index)) : [];
}

export type MonthCell = {
  date: LocalDate;
  /** Day of the month, 1–31. */
  day: number;
  /** False for the leading and trailing days from the months around it. */
  inMonth: boolean;
  weekday: Weekday;
};

/**
 * A month as 6 rows × 7 cells, starting on the week day `weekStartsOn` (Monday by default).
 * Always 6 rows so the grid never jumps in height between months.
 */
export function monthMatrix(year: number, month: number, options: WeekOptions = {}): MonthCell[][] {
  const first = formatLocalDate(year, month, 1);
  const start = toDayNumber(startOfWeek(first, options));
  const rows: MonthCell[][] = [];
  for (let row = 0; row < 6; row += 1) {
    const cells: MonthCell[] = [];
    for (let column = 0; column < 7; column += 1) {
      const date = fromDayNumber(start + row * 7 + column);
      const parts = parseLocalDate(date);
      cells.push({
        date,
        day: parts.day,
        inMonth: parts.year === year && parts.month === month,
        weekday: weekday(date),
      });
    }
    rows.push(cells);
  }
  return rows;
}
