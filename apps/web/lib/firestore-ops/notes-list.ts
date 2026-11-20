import type { NoteDoc } from "../firestore-docs/note-doc";

type NoteListFields = Pick<NoteDoc, "title" | "pinned" | "updatedAt" | "deletedAt">;

export type NoteListRow = NoteListFields & { id: string };

export function pickNotes<Row extends NoteListRow>(
  rows: readonly Row[],
  search = "",
  max = 200
): Row[] {
  const query = search.trim().toLocaleLowerCase();

  return rows
    .filter(
      (row) => row.deletedAt === undefined && row.title.toLocaleLowerCase().includes(query)
    )
    .toSorted(
      (left, right) =>
        Number(right.pinned) - Number(left.pinned) ||
        right.updatedAt - left.updatedAt ||
        left.id.localeCompare(right.id)
    )
    .slice(0, Math.max(0, max));
}

export function notesListState(
  total: number,
  shown: number,
  search: string
): "empty" | "no_match" | "list" {
  if (total === 0) return "empty";
  if (search.trim() !== "" && shown === 0) return "no_match";
  return "list";
}
