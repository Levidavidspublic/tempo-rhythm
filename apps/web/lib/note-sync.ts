/**
 * Autosave rules for a page open in more than one place (two tabs, or a tab and the coach saving a
 * decision to today's page). Each place sends only what it changed, and takes what another place
 * saved when it has nothing unsaved of its own.
 */

/** Which fields were edited here since their last successful save. */
export type NoteEdits = { title: boolean; body: boolean };

/**
 * What an autosave sends: only the fields edited here. A tab that only typed in the body never
 * writes back its old copy of a title another tab has since renamed (and the same for the body).
 */
export function notePatch(edited: NoteEdits, title: string, body: string): { title?: string; body?: string } {
  return {
    ...(edited.title ? { title } : {}),
    ...(edited.body ? { body } : {}),
  };
}

/**
 * True when a title saved elsewhere should replace the one shown here: nothing unsaved here and no
 * save on its way. The server trims titles, so a trailing space still being typed here is no change.
 */
export function shouldAdoptRemoteTitle(
  remote: string,
  local: string,
  editedHere: boolean,
  savePending: boolean,
): boolean {
  return !editedHere && !savePending && remote.trim() !== local.trim();
}
