import { checkNoteDoc, type NoteDoc } from "../firestore-docs/note-doc";
import { checkTemplateDoc } from "../firestore-docs/template-doc";
import { stampCreate } from "./write-stamps";

type PlanNoteFromTemplateResult =
  | { ok: true; doc: NoteDoc }
  | {
      ok: false;
      reason: "invalid-template" | "deleted" | "invalid-date" | "invalid-now" | "invalid-note";
    };

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function planNoteFromTemplate(
  template: unknown,
  localDate: string,
  now: number
): PlanNoteFromTemplateResult {
  const checkedTemplate = checkTemplateDoc(template);
  if (!checkedTemplate.ok) return { ok: false, reason: "invalid-template" };
  if (checkedTemplate.doc.deletedAt !== undefined) return { ok: false, reason: "deleted" };
  if (!isCalendarDate(localDate)) return { ok: false, reason: "invalid-date" };
  if (!Number.isFinite(now) || now <= 0) return { ok: false, reason: "invalid-now" };

  const { name, body, periodType } = checkedTemplate.doc;
  const pageType = periodType === "daily" ? "daily" : periodType === "weekly" ? "weekly" : "plain";
  const fields: Omit<NoteDoc, "createdAt" | "updatedAt"> = {
    title: name,
    body,
    pinned: false,
    periodType,
    pageType,
    revision: 1,
  };

  if (periodType !== "none") fields.date = localDate;

  const checkedNote = checkNoteDoc(stampCreate(fields, now));
  if (!checkedNote.ok) return { ok: false, reason: "invalid-note" };

  return { ok: true, doc: checkedNote.doc };
}
