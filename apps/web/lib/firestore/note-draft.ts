import { checkNoteDoc, type NoteDoc } from "../firestore-docs/note-doc";

export const NOTE_TITLE_MAX = 200;

type DraftNoteInput = {
  title: string;
  body?: string;
  pinned?: boolean;
  date?: string;
};

type DraftNoteResult = { ok: true; doc: NoteDoc } | { ok: false; reason: string };

function shortenTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").slice(0, NOTE_TITLE_MAX);
}

export function draftNote(input: DraftNoteInput, now: number): DraftNoteResult {
  try {
    const body = input.body ?? "";
    let title = shortenTitle(input.title);

    if (title.length === 0 && body.trim().length === 0) {
      return { ok: false, reason: "note is empty" };
    }

    if (title.length === 0) {
      const firstBodyLine = body.split(/\r?\n/).find((line) => line.trim().length > 0);
      title = (firstBodyLine ?? "").trim().slice(0, NOTE_TITLE_MAX);
    }

    const doc: NoteDoc = {
      title,
      body,
      pinned: input.pinned ?? false,
      periodType: "none",
      pageType: "plain",
      revision: 0,
      createdAt: now,
      updatedAt: now,
      ...(input.date !== undefined ? { date: input.date } : {}),
    };

    return checkNoteDoc(doc);
  } catch {
    return { ok: false, reason: "note could not be drafted" };
  }
}
