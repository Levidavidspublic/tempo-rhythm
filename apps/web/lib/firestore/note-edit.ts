import { checkNoteDoc, type NoteDoc } from "../firestore-docs/note-doc";

export type NoteEdit = {
  title?: string;
  body?: string;
  pinned?: boolean;
};

export type NoteEditPlan =
  | { kind: "patch"; patch: Partial<NoteDoc>; fields: string[] }
  | { kind: "unchanged" }
  | { kind: "refused"; reason: string };

export function planNoteEdit(stored: NoteDoc, edit: NoteEdit, now: number): NoteEditPlan {
  try {
    if (stored.deletedAt !== undefined) {
      return { kind: "refused", reason: "note is deleted" };
    }

    const patch: Partial<NoteDoc> = {};

    if (edit.title !== undefined) {
      const title = edit.title.trim();
      if (title.length === 0) {
        return { kind: "refused", reason: "title must not be empty" };
      }
      if (title !== stored.title) patch.title = title;
    }
    if (edit.body !== undefined && edit.body !== stored.body) patch.body = edit.body;
    if (edit.pinned !== undefined && edit.pinned !== stored.pinned) patch.pinned = edit.pinned;

    if (Object.keys(patch).length === 0) return { kind: "unchanged" };

    patch.revision = (stored.revision ?? 0) + 1;
    patch.updatedAt = now;

    const checked = checkNoteDoc({ ...stored, ...patch });
    if (!checked.ok) return { kind: "refused", reason: checked.reason };

    return { kind: "patch", patch, fields: Object.keys(patch).sort() };
  } catch {
    return { kind: "refused", reason: "note could not be inspected" };
  }
}
