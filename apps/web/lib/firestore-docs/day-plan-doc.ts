export type DayPlanDoc = {
	localDate: string;
	timezone?: string;
	intention?: string;
	topTaskIds?: string[];
	energy?: "low" | "medium" | "high";
	status: "draft" | "committed";
	committedAt?: number;
	reflection?: string;
	createdAt: number;
	updatedAt: number;
	deletedAt?: number;
};

const DAY_PLAN_KEYS = new Set<keyof DayPlanDoc>([
	"localDate",
	"timezone",
	"intention",
	"topTaskIds",
	"energy",
	"status",
	"committedAt",
	"reflection",
	"createdAt",
	"updatedAt",
	"deletedAt",
]);

function isLocalDate(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

export function checkDayPlanDoc(
	input: unknown,
): { ok: true; doc: DayPlanDoc } | { ok: false; reason: string } {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return { ok: false, reason: "day plan must be an object" };
	}

	const value = input as Record<string, unknown>;
	for (const key of Object.keys(value)) {
		if (!DAY_PLAN_KEYS.has(key as keyof DayPlanDoc)) {
			return { ok: false, reason: `unknown key: ${key}` };
		}
	}

	if (!isLocalDate(value.localDate)) return { ok: false, reason: "invalid localDate" };
	if (value.status !== "draft" && value.status !== "committed") {
		return { ok: false, reason: "invalid status" };
	}
	if (value.energy !== undefined && !["low", "medium", "high"].includes(value.energy as string)) {
		return { ok: false, reason: "invalid energy" };
	}

	for (const key of ["timezone", "intention", "reflection"] as const) {
		if (value[key] !== undefined && typeof value[key] !== "string") {
			return { ok: false, reason: `${key} must be a string` };
		}
	}
	for (const key of ["committedAt", "createdAt", "updatedAt", "deletedAt"] as const) {
		if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
			if (key === "createdAt" || key === "updatedAt" || value[key] !== undefined) {
				return { ok: false, reason: `${key} must be a finite number` };
			}
		}
	}

	if (value.topTaskIds !== undefined) {
		if (!Array.isArray(value.topTaskIds)) {
			return { ok: false, reason: "topTaskIds must be an array" };
		}
		if (value.topTaskIds.length > 3) return { ok: false, reason: "topTaskIds has more than 3 tasks" };
		if (value.topTaskIds.some((id) => typeof id !== "string" || id.trim() === "")) {
			return { ok: false, reason: "topTaskIds contains an empty or invalid id" };
		}
		if (new Set(value.topTaskIds).size !== value.topTaskIds.length) {
			return { ok: false, reason: "topTaskIds contains a duplicate id" };
		}
	}

	if (value.status === "committed" && value.committedAt === undefined) {
		return { ok: false, reason: "committed status requires committedAt" };
	}

	return { ok: true, doc: value as DayPlanDoc };
}

export function dayPlanDocId(localDate: string): string {
	if (!isLocalDate(localDate)) throw new Error("invalid localDate");
	return localDate;
}
