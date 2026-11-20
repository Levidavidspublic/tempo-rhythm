import { parseFocusBlockDoc, type FocusBlockDoc } from "../firestore-docs/calendar-doc";

const MIN_FOCUS_DURATION_MS = 60_000;
const MAX_FOCUS_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_LABEL_LENGTH = 120;

type FocusSessionFinishInput = {
  startedAtMs: unknown;
  label?: unknown;
  taskId?: unknown;
};

type FocusSessionFinishResult =
  | { ok: true; doc: FocusBlockDoc }
  | { ok: false; reason: "bad_start" | "bad_now" | "too_short" | "bad_task" };

type FocusRangeRow = {
  startedAtMs: number;
  durationMs: number;
  deletedAt?: unknown;
};

export function planFocusSessionFinish(
  input: FocusSessionFinishInput,
  now: number
): FocusSessionFinishResult {
  if (!Number.isFinite(now) || now < 0) return { ok: false, reason: "bad_now" };
  if (
    typeof input.startedAtMs !== "number" ||
    !Number.isFinite(input.startedAtMs) ||
    input.startedAtMs < 0 ||
    input.startedAtMs > now
  ) {
    return { ok: false, reason: "bad_start" };
  }

  const elapsedMs = now - input.startedAtMs;
  if (elapsedMs < MIN_FOCUS_DURATION_MS) return { ok: false, reason: "too_short" };

  if (
    input.taskId !== undefined &&
    (typeof input.taskId !== "string" || input.taskId.length === 0 || input.taskId.includes("/"))
  ) {
    return { ok: false, reason: "bad_task" };
  }

  const label =
    typeof input.label === "string" ? input.label.trim().slice(0, MAX_LABEL_LENGTH) : "";
  const doc = parseFocusBlockDoc({
    startedAtMs: input.startedAtMs,
    durationMs: Math.min(elapsedMs, MAX_FOCUS_DURATION_MS),
    createdAt: now,
    updatedAt: now,
    ...(label ? { label } : {}),
    ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
  });

  return { ok: true, doc };
}

export function focusMinutesInRange(
  rows: readonly FocusRangeRow[],
  fromMs: number,
  toMs: number
): number {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0;

  const focusedMs = rows.reduce((total, row) => {
    if (
      row.deletedAt !== undefined ||
      !Number.isFinite(row.startedAtMs) ||
      !Number.isFinite(row.durationMs) ||
      row.durationMs <= 0
    ) {
      return total;
    }

    const overlapStart = Math.max(row.startedAtMs, fromMs);
    const overlapEnd = Math.min(row.startedAtMs + row.durationMs, toMs);
    return total + Math.max(0, overlapEnd - overlapStart);
  }, 0);

  return Math.floor(focusedMs / MIN_FOCUS_DURATION_MS);
}
