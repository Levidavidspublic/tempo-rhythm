/** Local-day helpers for the `today_plan_get` tool. */
const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(timeZone: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return true;
	} catch {
		return false;
	}
}

/** Offset of `timeZone` from UTC at the instant `utcMs`, in ms (east is positive). */
export function tzOffsetMs(timeZone: string, utcMs: number): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(new Date(utcMs));
	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		get("year"),
		get("month") - 1,
		get("day"),
		get("hour"),
		get("minute"),
		get("second"),
	);
	return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "YYYY-MM-DD" of `utcMs` in `timeZone`. */
export function localDateOf(timeZone: string, utcMs: number): string {
	return new Date(utcMs + tzOffsetMs(timeZone, utcMs))
		.toISOString()
		.slice(0, 10);
}

/** [start, end) of a local calendar day, as epoch ms. */
export function dayBoundsMs(
	localDate: string,
	timeZone: string,
): { startMs: number; endMs: number } {
	const midnightUtc = Date.parse(`${localDate}T00:00:00Z`);
	// Offset can differ between the guess and the real instant around a DST change: resolve twice.
	let start = midnightUtc - tzOffsetMs(timeZone, midnightUtc);
	start = midnightUtc - tzOffsetMs(timeZone, start);
	const nextMidnightUtc = midnightUtc + DAY_MS;
	let end = nextMidnightUtc - tzOffsetMs(timeZone, nextMidnightUtc);
	end = nextMidnightUtc - tzOffsetMs(timeZone, end);
	return { startMs: start, endMs: end };
}
