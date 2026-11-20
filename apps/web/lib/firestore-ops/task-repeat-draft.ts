import { parseTaskRepeatDoc, type TaskRepeatDoc } from "../firestore-docs/task-repeat-doc";

export type TaskRepeatDraftInput = {
  cycle: "DAILY" | "WEEKLY";
  every?: number;
  weekdays?: number[];
};

export type TaskRepeatDraft =
  | { ok: true; doc: TaskRepeatDoc }
  | {
      ok: false;
      reason: "bad-cycle" | "bad-every" | "no-weekday" | "bad-weekday" | "bad-time" | "invalid";
    };

export function draftTaskRepeat(input: TaskRepeatDraftInput, now: number): TaskRepeatDraft {
  if (input.cycle !== "DAILY" && input.cycle !== "WEEKLY") {
    return { ok: false, reason: "bad-cycle" };
  }
  if (input.every !== undefined && (!Number.isInteger(input.every) || input.every < 1)) {
    return { ok: false, reason: "bad-every" };
  }

  const weekdays = input.weekdays ?? [];
  if (input.cycle === "WEEKLY" && weekdays.length === 0) {
    return { ok: false, reason: "no-weekday" };
  }
  if (weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 0 || weekday > 6)) {
    return { ok: false, reason: "bad-weekday" };
  }
  if (!Number.isFinite(now)) return { ok: false, reason: "bad-time" };

  const rule = {
    repeatCycle: input.cycle,
    repeatEvery: input.every ?? 1,
    weekdays:
      input.cycle === "DAILY" ? [] : [...new Set(weekdays)].sort((left, right) => left - right),
    deletedInstanceDates: [],
    skipOverdue: false,
    waitForCompletion: false,
    repeatFromCompletionDate: false,
    isPaused: false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    return { ok: true, doc: parseTaskRepeatDoc(rule) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
