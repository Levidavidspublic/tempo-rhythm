import type { TimeBlockDoc } from "../firestore-docs/time-block-doc";

type TimeBlockMoveInput = Pick<
  TimeBlockDoc,
  "startMinute" | "durationMinutes" | "startsAtMs" | "endsAtMs"
>;

type TimeBlockMoveField = keyof TimeBlockMoveInput | "updatedAt";
type TimeBlockMovePatch = Partial<Pick<TimeBlockDoc, TimeBlockMoveField>>;

type PlanTimeBlockMoveResult =
  | { ok: false; reason: "deleted" | "bad-start" | "bad-length" | "bad-time" | "bad-range" }
  | { ok: true; unchanged: true }
  | {
      ok: true;
      unchanged: false;
      patch: TimeBlockMovePatch;
      changedFields: TimeBlockMoveField[];
    };

export function planTimeBlockMove(
  block: TimeBlockDoc,
  input: TimeBlockMoveInput,
  now: number
): PlanTimeBlockMoveResult {
  if (block.deletedAt !== undefined) return { ok: false, reason: "deleted" };
  if (!Number.isInteger(input.startMinute) || input.startMinute < 0 || input.startMinute > 1439) {
    return { ok: false, reason: "bad-start" };
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 5 ||
    input.durationMinutes > 720
  ) {
    return { ok: false, reason: "bad-length" };
  }
  if (![input.startsAtMs, input.endsAtMs, now].every(Number.isFinite)) {
    return { ok: false, reason: "bad-time" };
  }
  if (input.endsAtMs <= input.startsAtMs) return { ok: false, reason: "bad-range" };

  const patch: TimeBlockMovePatch = {};
  const changedFields: TimeBlockMoveField[] = [];
  const moveFields = ["startMinute", "durationMinutes", "startsAtMs", "endsAtMs"] as const;

  for (const field of moveFields) {
    if (input[field] !== block[field]) {
      patch[field] = input[field];
      changedFields.push(field);
    }
  }

  if (changedFields.length === 0) return { ok: true, unchanged: true };

  patch.updatedAt = now;
  changedFields.push("updatedAt");
  return { ok: true, unchanged: false, patch, changedFields };
}
