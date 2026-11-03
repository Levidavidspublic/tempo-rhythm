const DAY_MS = 24 * 60 * 60 * 1000;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isLocalDate(value: string): boolean {
	if (!LOCAL_DATE_RE.test(value)) {
		return false;
	}
	const ms = Date.parse(`${value}T00:00:00Z`);
	return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** Whole days since the epoch for a "YYYY-MM-DD" local date (calendar math, no time zone). */
export function localDateIndex(localDate: string): number {
	return Math.round(Date.parse(`${localDate}T00:00:00Z`) / DAY_MS);
}

export type HabitCheckInStreaks = {
	currentStreak: number;
	longestStreak: number;
	/** Latest checked local date, if any. */
	lastLocalDate: string | undefined;
};

/**
 * Pure streak math over live check-in local dates. Exported for unit tests.
 *
 * - Duplicates are ignored (one check-in per day counts once).
 * - `currentStreak` is the run of consecutive local dates ending on `asOfLocalDate`
 *   or the day before it (or later). Missing today does not reset it until a full day is skipped.
 * - Never negative. A gap only means the run restarts at 0; there is no "lost" state.
 */
export function computeHabitCheckInStreaks(
	localDates: readonly string[],
	asOfLocalDate: string,
): HabitCheckInStreaks {
	const days = Array.from(new Set(localDates.map(localDateIndex))).sort((a, b) => a - b);
	if (days.length === 0) {
		return { currentStreak: 0, longestStreak: 0, lastLocalDate: undefined };
	}

	let longest = 1;
	let run = 1;
	for (let i = 1; i < days.length; i++) {
		run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
		longest = Math.max(longest, run);
	}

	// `run` now holds the length of the final run (ending on the latest check-in).
	const latest = days[days.length - 1];
	const asOf = localDateIndex(asOfLocalDate);
	// A latest check-in after `asOf` (backfilled or clock skew) still counts as recent.
	const endsRecently = latest >= asOf - 1;
	const current = endsRecently ? run : 0;

	const lastLocalDate = new Date(latest * DAY_MS).toISOString().slice(0, 10);
	return {
		currentStreak: Math.max(0, current),
		longestStreak: Math.max(0, longest),
		lastLocalDate,
	};
}
