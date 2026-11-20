const DAY_MS = 24 * 60 * 60 * 1000;

type HabitCompleteInput = {
	currentStreak: number;
	longestStreak: number;
	lastCompletedAt?: number;
	deletedAt?: number;
};

type HabitCompletePatch = {
	currentStreak: number;
	longestStreak: number;
	lastCompletedAt: number;
	updatedAt: number;
};

export type HabitCompletePlan =
	| { ok: false; reason: "deleted" | "bad-time" }
	| { ok: true; alreadyDone: true; currentStreak: number }
	| {
			ok: true;
			alreadyDone: false;
			patch: HabitCompletePatch;
			changedFields: [
				"currentStreak",
				"longestStreak",
				"lastCompletedAt",
				"updatedAt",
			];
	  };

// Mirrors the UTC calendar-day streak rule in convex/lib/habitStreak.ts.
function computeHabitStreakUpdate(
	now: number,
	lastCompletedAt: number | undefined,
	currentStreak: number,
	longestStreak: number,
):
	| { alreadyDone: true; currentStreak: number }
	| { alreadyDone: false; currentStreak: number; longestStreak: number } {
	let current = currentStreak;
	if (lastCompletedAt !== undefined) {
		const daysSince =
			Math.floor(now / DAY_MS) - Math.floor(lastCompletedAt / DAY_MS);
		if (daysSince === 0) {
			return { alreadyDone: true, currentStreak };
		}
		current = daysSince === 1 ? current + 1 : 1;
	} else {
		current = 1;
	}

	return {
		alreadyDone: false,
		currentStreak: current,
		longestStreak: Math.max(longestStreak, current),
	};
}

export function planHabitComplete(
	habit: HabitCompleteInput,
	now: number,
): HabitCompletePlan {
	if (habit.deletedAt !== undefined) {
		return { ok: false, reason: "deleted" };
	}
	if (!Number.isFinite(now)) {
		return { ok: false, reason: "bad-time" };
	}

	const update = computeHabitStreakUpdate(
		now,
		habit.lastCompletedAt,
		habit.currentStreak,
		habit.longestStreak,
	);
	if (update.alreadyDone) {
		return { ok: true, alreadyDone: true, currentStreak: update.currentStreak };
	}

	return {
		ok: true,
		alreadyDone: false,
		patch: {
			currentStreak: update.currentStreak,
			longestStreak: update.longestStreak,
			lastCompletedAt: now,
			updatedAt: now,
		},
		changedFields: [
			"currentStreak",
			"longestStreak",
			"lastCompletedAt",
			"updatedAt",
		],
	};
}
