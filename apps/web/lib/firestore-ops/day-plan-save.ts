import type { DayPlanDoc as DayPlan } from "../firestore-docs/day-plan-doc";

type DayPlanEdit = {
  localDate: string;
  timezone?: string;
  intention?: string;
  topTaskIds?: string[];
  energy?: "low" | "medium" | "high";
};

type RefusalReason = "bad-date" | "date-mismatch" | "too-many-tasks" | "deleted" | "bad-time";

type SaveResult =
  | { ok: false; reason: RefusalReason }
  | { ok: true; kind: "create"; doc: DayPlan }
  | {
      ok: true;
      kind: "update";
      patch: Partial<DayPlan>;
      changedFields: Array<"timezone" | "intention" | "topTaskIds" | "energy">;
    };

type CommitResult =
  | { ok: false; reason: RefusalReason }
  | { ok: true; kind: "create"; doc: DayPlan }
  | {
      ok: true;
      kind: "update";
      patch: Pick<DayPlan, "status" | "committedAt" | "updatedAt">;
    }
  | { ok: true; kind: "none"; committedAt: number };

function isLocalDate(value: string): boolean {
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

function validateExisting(
  existing: DayPlan | null,
  localDate: string,
  now: number
): { ok: true } | { ok: false; reason: RefusalReason } {
  if (!Number.isFinite(now)) return { ok: false, reason: "bad-time" };
  if (!isLocalDate(localDate)) return { ok: false, reason: "bad-date" };
  if (existing?.deletedAt !== undefined) return { ok: false, reason: "deleted" };
  if (existing && existing.localDate !== localDate) return { ok: false, reason: "date-mismatch" };
  return { ok: true };
}

export function planDayPlanSave(
  existing: DayPlan | null,
  edit: DayPlanEdit,
  now: number
): SaveResult {
  const validation = validateExisting(existing, edit.localDate, now);
  if (!validation.ok) return validation;
  if (
    edit.topTaskIds !== undefined &&
    (edit.topTaskIds.length > 3 || new Set(edit.topTaskIds).size !== edit.topTaskIds.length)
  ) {
    return { ok: false, reason: "too-many-tasks" };
  }

  const fields: Pick<Partial<DayPlan>, "timezone" | "intention" | "topTaskIds" | "energy"> = {};
  const changedFields: Array<"timezone" | "intention" | "topTaskIds" | "energy"> = [];
  if (edit.timezone !== undefined) {
    fields.timezone = edit.timezone;
    changedFields.push("timezone");
  }
  if (edit.intention !== undefined) {
    fields.intention = edit.intention.trim();
    changedFields.push("intention");
  }
  if (edit.topTaskIds !== undefined) {
    fields.topTaskIds = edit.topTaskIds;
    changedFields.push("topTaskIds");
  }
  if (edit.energy !== undefined) {
    fields.energy = edit.energy;
    changedFields.push("energy");
  }

  if (!existing) {
    return {
      ok: true,
      kind: "create",
      doc: {
        localDate: edit.localDate,
        ...fields,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  return {
    ok: true,
    kind: "update",
    patch: { ...fields, updatedAt: now },
    changedFields,
  };
}

export function planDayPlanCommit(
  existing: DayPlan | null,
  localDate: string,
  now: number
): CommitResult {
  const validation = validateExisting(existing, localDate, now);
  if (!validation.ok) return validation;

  if (!existing) {
    return {
      ok: true,
      kind: "create",
      doc: {
        localDate,
        status: "committed",
        committedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    };
  }
  if (existing.status === "committed" && existing.committedAt !== undefined) {
    return { ok: true, kind: "none", committedAt: existing.committedAt };
  }
  return {
    ok: true,
    kind: "update",
    patch: { status: "committed", committedAt: now, updatedAt: now },
  };
}
