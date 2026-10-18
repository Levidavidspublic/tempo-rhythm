import { type Draft, draftToData, type StudyPreview } from "./preview";
import type { SetBlock } from "./StudySetView";

/**
 * Editing a saved set on its screen (/study/[setId]), the pure part. The edit list is the Turn-into
 * preview's (preview.ts), drafted from the block as the page holds it. The flow: closed → editing
 * → saving → closed (with a 5-minute Undo), or back to editing when the save didn't go through or
 * the page's block moved on since the edit started (`baseVersion`, from `getSet`'s
 * `blockVersion`). Nothing here saves: the screen calls `study.updateBlock`.
 */

/** What `study.updateBlock` and `study.undoUpdate` answer. */
export type EditResult =
  | { status: "saved"; version: string; undoUntil: number }
  | { status: "changed"; version: string };

export type SetEditState = {
  phase: "closed" | "editing" | "saving";
  /** The block version the edit list was drafted from; a save is refused once the page moves on. */
  baseVersion: string | null;
  /** The last save didn't go through ("save"), or the server found newer words ("changed"). */
  error: "save" | "changed" | null;
};

export type SetEditAction =
  | { type: "open"; version: string }
  | { type: "cancel" }
  | { type: "save" }
  | { type: "saved" }
  | { type: "saveError" }
  | { type: "changed" }
  | { type: "reload"; version: string };

export const closedEdit: SetEditState = { phase: "closed", baseVersion: null, error: null };

export function setEditReducer(state: SetEditState, action: SetEditAction): SetEditState {
  switch (action.type) {
    case "open":
      return state.phase === "closed"
        ? { phase: "editing", baseVersion: action.version, error: null }
        : state;
    case "cancel":
      return state.phase === "editing" ? closedEdit : state;
    case "save":
      return state.phase === "editing" ? { ...state, phase: "saving", error: null } : state;
    case "saved":
      return state.phase === "saving" ? closedEdit : state;
    case "saveError":
      return state.phase === "saving" ? { ...state, phase: "editing", error: "save" } : state;
    case "changed":
      return state.phase === "saving" ? { ...state, phase: "editing", error: "changed" } : state;
    case "reload":
      return state.phase === "editing"
        ? { phase: "editing", baseVersion: action.version, error: null }
        : state;
  }
}

/**
 * The page's block moved on since the edit list was drafted: the server said so, or the live
 * `blockVersion` no longer matches. A save would be refused, so the screen offers Reload instead.
 */
export function isStale(state: SetEditState, currentVersion: string): boolean {
  if (state.phase !== "editing") return false;
  return state.error === "changed" || state.baseVersion !== currentVersion;
}

/** Save goes through only from the edit list, on a fresh base, with data the codec accepts. */
export function canSave(state: SetEditState, draft: Draft, currentVersion: string): boolean {
  return (
    state.phase === "editing" && !isStale(state, currentVersion) && draftToData(draft) !== null
  );
}

/** The block as an edit list's starting point. */
export function blockPreview(block: SetBlock): StudyPreview {
  switch (block.type) {
    case "flashcards":
      return { kind: "flashcards", data: block.data };
    case "quiz":
      return { kind: "quiz", data: block.data };
    case "test":
      return { kind: "test", data: block.data };
  }
}

/** JSON with every object's keys sorted, so the same content compares equal in any key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** True when the draft reads back as exactly the block it started from: nothing to save. */
export function draftUnchanged(draft: Draft): boolean {
  const data = draftToData(draft);
  return data !== null && canonical(data.data) === canonical(draft.preview.data);
}
