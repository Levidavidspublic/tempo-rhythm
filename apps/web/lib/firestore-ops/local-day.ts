export type LocalDayWindow =
  | {
      ok: true;
      localDate: string;
      dayStartMs: number;
      dayEndMs: number;
      timeZone: string;
    }
  | { ok: false; reason: "bad-time" };

type DateParts = { year: number; month: number; day: number };

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function partsAt(
  formatter: Intl.DateTimeFormat,
  instantMs: number
): DateParts & {
  hour: number;
  minute: number;
  second: number;
} {
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(instantMs)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function offsetAt(formatter: Intl.DateTimeFormat, instantMs: number): number {
  const parts = partsAt(formatter, instantMs);
  const localAsUtc = utcDateMs(parts, parts.hour, parts.minute, parts.second);
  return localAsUtc - Math.trunc(instantMs / 1_000) * 1_000;
}

function utcDateMs(date: DateParts, hour = 0, minute = 0, second = 0): number {
  const instant = new Date(0);
  instant.setUTCFullYear(date.year, date.month - 1, date.day);
  instant.setUTCHours(hour, minute, second, 0);
  return instant.getTime();
}

function boundaryFor(formatter: Intl.DateTimeFormat, date: DateParts): number {
  const utcMidnight = utcDateMs(date);
  const firstCandidate = utcMidnight - offsetAt(formatter, utcMidnight);
  return utcMidnight - offsetAt(formatter, firstCandidate);
}

function formatLocalDate(date: DateParts): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(
    date.day
  ).padStart(2, "0")}`;
}

export function shiftLocalDate(localDate: string, days: number): string | null {
  const match = LOCAL_DATE_PATTERN.exec(localDate);
  if (!match || !Number.isInteger(days) || !Number.isSafeInteger(days)) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = utcDateMs({ year, month, day });
  const parsed = new Date(instant);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  if (!Number.isFinite(parsed.getTime())) return null;
  return formatLocalDate({
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  });
}

export function localDayWindow(nowMs: number, requestedTimeZone?: string): LocalDayWindow {
  if (!Number.isFinite(nowMs)) return { ok: false, reason: "bad-time" };

  let timeZone = requestedTimeZone?.trim() || "UTC";
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = formatterFor(timeZone);
  } catch {
    timeZone = "UTC";
    formatter = formatterFor(timeZone);
  }

  try {
    const current = partsAt(formatter, nowMs);
    const localDate = formatLocalDate(current);
    const nextLocalDate = shiftLocalDate(localDate, 1);
    if (nextLocalDate === null) return { ok: false, reason: "bad-time" };
    const nextMatch = LOCAL_DATE_PATTERN.exec(nextLocalDate);
    if (nextMatch === null) return { ok: false, reason: "bad-time" };

    return {
      ok: true,
      localDate,
      dayStartMs: boundaryFor(formatter, current),
      dayEndMs: boundaryFor(formatter, {
        year: Number(nextMatch[1]),
        month: Number(nextMatch[2]),
        day: Number(nextMatch[3]),
      }),
      timeZone,
    };
  } catch {
    return { ok: false, reason: "bad-time" };
  }
}
