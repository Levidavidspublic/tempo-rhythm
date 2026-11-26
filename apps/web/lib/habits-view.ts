/**
 * Pure helpers for the v3 Habits screens (docs/design/v3/screens/web/habits.html and
 * habit-detail.html). Days are the person's local calendar days as `YYYY-MM-DD` keys.
 * No streaks anywhere: only plain counts of logged days.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` for the local calendar day of `d`. */
export function toLocalDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Local noon of a `YYYY-MM-DD` key (noon keeps DST shifts from moving the day), or null. */
export function parseLocalDate(key: string): Date | null {
  const match = LOCAL_DATE.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return toLocalDateKey(date) === key ? date : null;
}

/** The key `count` local days after `key` (negative goes back). */
export function addLocalDays(key: string, count: number): string {
  const date = parseLocalDate(key);
  if (!date) return key;
  date.setDate(date.getDate() + count);
  return toLocalDateKey(date);
}

/** Calendar days from `fromKey` to `toKey`, both included (0 when `toKey` is earlier). */
export function daysInclusive(fromKey: string, toKey: string): number {
  const from = parseLocalDate(fromKey);
  const to = parseLocalDate(toKey);
  if (!from || !to || toKey < fromKey) return 0;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

export type LocalDay = {
  localDate: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Day of the month. */
  day: number;
  isToday: boolean;
};

/** The last `count` local days ending with `today`, oldest first. */
export function lastLocalDays(today: Date, count = 7): LocalDay[] {
  const todayKey = toLocalDateKey(today);
  const days: LocalDay[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const localDate = addLocalDays(todayKey, -back);
    const date = parseLocalDate(localDate) as Date;
    days.push({ localDate, weekday: date.getDay(), day: date.getDate(), isToday: back === 0 });
  }
  return days;
}

/** How many of `days` are in `logged`. */
export function countLogged(
  days: readonly { localDate: string }[],
  logged: ReadonlySet<string>
): number {
  let count = 0;
  for (const day of days) if (logged.has(day.localDate)) count += 1;
  return count;
}

/**
 * The weekday (0 = Sunday) logged most often, when one weekday clearly leads: at least 3 logged
 * days in all, at least 2 on that weekday, and no tie. Otherwise null (say nothing).
 */
export function easiestWeekday(dates: Iterable<string>): number | null {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const key of dates) {
    const date = parseLocalDate(key);
    if (!date) continue;
    counts[date.getDay()] += 1;
    total += 1;
  }
  if (total < 3) return null;
  const top = Math.max(...counts);
  if (top < 2) return null;
  const leaders = counts.flatMap((count, weekday) => (count === top ? [weekday] : []));
  return leaders.length === 1 ? (leaders[0] as number) : null;
}

export type DetailSummary = {
  /** Logged days counted in the sentence. */
  logged: number;
  /** Days the sentence counts ("of the last N days"). */
  total: number;
  easiestWeekday: number | null;
  todayLogged: boolean;
};

/**
 * The plain sentence under the 6-week grid. Counting starts on the habit's first local day (or
 * the first logged day, if earlier), never before the grid starts, and ends today.
 */
export function detailSummary(input: {
  gridStartKey: string;
  todayKey: string;
  createdKey: string;
  logged: ReadonlySet<string>;
}): DetailSummary {
  const { gridStartKey, todayKey, createdKey, logged } = input;
  const inGrid = [...logged].filter((key) => key >= gridStartKey && key <= todayKey).sort();
  const firstLogged = inGrid[0];
  let start = createdKey;
  if (firstLogged !== undefined && firstLogged < start) start = firstLogged;
  if (start < gridStartKey) start = gridStartKey;
  if (start > todayKey) start = todayKey;
  const counted = inGrid.filter((key) => key >= start);
  return {
    logged: counted.length,
    total: daysInclusive(start, todayKey),
    easiestWeekday: easiestWeekday(counted),
    todayLogged: logged.has(todayKey),
  };
}

/**
 * Optimistic toggles waiting for the server: drops every entry the server now agrees with.
 * Returns the same map when nothing changed, so React can skip the update.
 */
export function settlePending<K>(
  pending: ReadonlyMap<K, boolean>,
  serverHas: (key: K) => boolean
): ReadonlyMap<K, boolean> {
  if (pending.size === 0) return pending;
  let next: Map<K, boolean> | null = null;
  for (const [key, want] of pending) {
    if (serverHas(key) === want) {
      next ??= new Map(pending);
      next.delete(key);
    }
  }
  return next ?? pending;
}

/** The set of logged days with pending optimistic toggles applied on top. */
export function withPending(
  server: Iterable<string>,
  pending: ReadonlyMap<string, boolean>
): Set<string> {
  const out = new Set(server);
  for (const [key, on] of pending) {
    if (on) out.add(key);
    else out.delete(key);
  }
  return out;
}

export type TemplatePart = { text: string } | { slot: string };

/** Splits "Logged on {n} of {total}" into text and `{slot}` parts, so numbers can sit in tp-num. */
export function splitTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  const pattern = /\{(\w+)\}/g;
  let last = 0;
  for (let match = pattern.exec(template); match; match = pattern.exec(template)) {
    if (match.index > last) parts.push({ text: template.slice(last, match.index) });
    parts.push({ slot: match[1] as string });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ text: template.slice(last) });
  return parts;
}

/** Fills `{slot}`s with plain values; unknown slots stay as written. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}

/** "4:59" for the 5-minute Undo countdown (never below 0:00). */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
