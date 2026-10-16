export type FocusBlockLike = {
  startedAtMs: number;
  durationMs: number;
};

export type FocusDayPoint = {
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  blocks: number;
  minutes: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localDayOffset(nowMs: number, offsetDays: number): Date {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays);
}

/** Window covering the last `days` local days, ending at the start of tomorrow (local). */
export function lastLocalDaysRange(nowMs: number, days = 7): { startMs: number; endMs: number } {
  return {
    startMs: localDayOffset(nowMs, -(days - 1)).getTime(),
    endMs: localDayOffset(nowMs, 1).getTime(),
  };
}

export function minutesFromMs(durationMs: number): number {
  return Math.max(1, Math.round(durationMs / 60_000));
}

/** focusBlocks.create accepts a block of up to 8 hours. */
export const MAX_BLOCK_MINUTES = 8 * 60;

/** Whole minutes from the form's field, or null when the server would refuse the block. */
export function parseBlockMinutes(raw: string): number | null {
  const minutes = Number.parseInt(raw, 10);
  return Number.isFinite(minutes) && minutes >= 1 && minutes <= MAX_BLOCK_MINUTES ? minutes : null;
}

/** One point per local day that has blocks, oldest first. */
export function totalsPerLocalDay(blocks: FocusBlockLike[]): FocusDayPoint[] {
  const byDay = new Map<string, FocusDayPoint>();
  for (const block of blocks) {
    const day = localDayKey(block.startedAtMs);
    const point = byDay.get(day) ?? { day, blocks: 0, minutes: 0 };
    point.blocks += 1;
    point.minutes += block.durationMs / 60_000;
    byDay.set(day, point);
  }
  return Array.from(byDay.values())
    .map((p) => ({ ...p, minutes: Math.round(p.minutes) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Exactly `days` points ending today (local), zero-filled for empty days. */
export function lastSevenDaysSeries(
  blocks: FocusBlockLike[],
  nowMs: number,
  days = 7
): FocusDayPoint[] {
  const totals = new Map(totalsPerLocalDay(blocks).map((p) => [p.day, p]));
  const series: FocusDayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = localDayKey(localDayOffset(nowMs, -i).getTime());
    series.push(totals.get(day) ?? { day, blocks: 0, minutes: 0 });
  }
  return series;
}
