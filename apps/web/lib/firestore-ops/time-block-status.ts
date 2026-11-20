import type { TimeBlockDoc } from "../firestore-docs/time-block-doc";

const CHANGED_FIELDS = ["status", "updatedAt"] as const;
const VALID_STATUSES = new Set<TimeBlockDoc["status"]>(["planned", "done", "skipped"]);

export function planTimeBlockStatus(
  block: TimeBlockDoc,
  want: TimeBlockDoc["status"],
  now: number
) {
  if (block.deletedAt !== undefined) return { ok: false as const, reason: "deleted" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };
  if (!VALID_STATUSES.has(want)) return { ok: false as const, reason: "bad-status" as const };

  if (block.status === want) {
    return {
      ok: true as const,
      changed: false as const,
      status: want,
      patch: {},
      changedFields: [] as const,
    };
  }

  return {
    ok: true as const,
    changed: true as const,
    status: want,
    patch: { status: want, updatedAt: now },
    changedFields: CHANGED_FIELDS,
  };
}
