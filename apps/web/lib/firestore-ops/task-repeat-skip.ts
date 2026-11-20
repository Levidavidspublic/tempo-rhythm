import { parseTaskRepeatDoc, type TaskRepeatDoc } from "../firestore-docs/task-repeat-doc";

const CHANGED_FIELDS = ["deletedInstanceDates", "updatedAt"] as const;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealLocalDate(localDate: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(localDate);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export function planRepeatSkipDate(rule: TaskRepeatDoc, localDate: string, now: number) {
  if (rule.deletedAt !== undefined) {
    return { ok: false as const, reason: "deleted" as const };
  }
  if (!isRealLocalDate(localDate)) {
    return { ok: false as const, reason: "bad-date" as const };
  }
  if (!Number.isFinite(now)) {
    return { ok: false as const, reason: "bad-time" as const };
  }
  if (rule.deletedInstanceDates.includes(localDate)) {
    return { ok: true as const, alreadySkipped: true as const };
  }

  const deletedInstanceDates = [...rule.deletedInstanceDates, localDate].sort();
  const patch = { deletedInstanceDates, updatedAt: now };

  // Keep this plan aligned with the persisted repeat-document contract.
  parseTaskRepeatDoc({ ...rule, ...patch });

  return {
    ok: true as const,
    alreadySkipped: false as const,
    patch,
    changedFields: CHANGED_FIELDS,
  };
}
