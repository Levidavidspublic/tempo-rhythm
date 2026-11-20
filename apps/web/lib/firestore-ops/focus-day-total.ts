import type { FocusBlockDoc } from "../firestore-docs/calendar-doc";

export type FocusDayTotal = {
  totalMs: number;
  totalMinutes: number;
  sessions: number;
  copyKey: "today.focus.none" | "today.focus.some";
};

const EMPTY_TOTAL: FocusDayTotal = {
  totalMs: 0,
  totalMinutes: 0,
  sessions: 0,
  copyKey: "today.focus.none",
};

export function focusDayTotal(
  blocks: readonly FocusBlockDoc[],
  dayStartMs: number,
  dayEndMs: number
): FocusDayTotal {
  if (!Number.isFinite(dayStartMs) || !Number.isFinite(dayEndMs) || dayEndMs <= dayStartMs) {
    return { ...EMPTY_TOTAL };
  }

  let totalMs = 0;
  let sessions = 0;

  for (const block of blocks) {
    if (
      block.deletedAt !== undefined ||
      !Number.isFinite(block.startedAtMs) ||
      !Number.isFinite(block.durationMs) ||
      block.durationMs < 0 ||
      block.startedAtMs < dayStartMs ||
      block.startedAtMs >= dayEndMs
    ) {
      continue;
    }

    totalMs += block.durationMs;
    sessions += 1;
  }

  return {
    totalMs,
    totalMinutes: Math.floor(totalMs / 60_000),
    sessions,
    copyKey: sessions === 0 ? "today.focus.none" : "today.focus.some",
  };
}
