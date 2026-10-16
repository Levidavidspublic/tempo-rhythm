"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { notePatch, shouldAdoptRemoteTitle } from "@/lib/note-sync";
import { NoteNotFound } from "./NoteNotFound";
import { PageEditorView } from "./PageEditorView";
import { useRegisterCoachPageFlush } from "@/components/coach/CoachPage";
import { NotesList } from "@/components/notes-pages/NotesList";
import { useLocale } from "@/components/providers/LocaleProvider";
import { StateLoading } from "@/components/you/ScreenStates";
import { UndoToast } from "@/components/you/UndoToast";
import { useOnline } from "@/lib/useOnline";import { WeekGlance } from "./WeekGlance";

type NoteRecord = Doc<"notes">;

function sortPinnedFirst(notes: NoteRecord[]): NoteRecord[] {
  return [...notes].sort((a, b) => {
    if (a.pinned === b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });
}

export const PIN_SIGNED_OUT_COPY = "Sign in to pin notes.";
export const PIN_ERROR_COPY = "We couldn't update that pin. Try again in a moment.";

export type PinToggleOutcome = "toggled" | "signed-out" | "error";

export async function runPinToggle(
  isAuthenticated: boolean,
  toggle: () => Promise<unknown>,
): Promise<PinToggleOutcome> {
  if (!isAuthenticated) return "signed-out";
  try {
    await toggle();
    return "toggled";
  } catch {
    return "error";
  }
}

export { sortPinnedFirst };

type NotesScreenProps = {
  noteId?: string;
};

export type NoteLoadState = "loading" | "not-found" | "ready";

export function getNoteLoadState(note: NoteRecord | null | undefined): NoteLoadState {
  if (note === undefined) return "loading";
  if (note === null) return "not-found";
  return "ready";
}

export function NotesScreen({ noteId }: NotesScreenProps) {
  if (noteId) {
    return <NotePage noteId={noteId} />;
  }
  return <NotesList />;
}

type SaveState = "idle" | "saving" | "saved" | "error";

type NotePageProps = {
  noteId: string;
  /** Passed to the page view: where "Back" goes, or null to hide it. */
  backHref?: string | null;
  /** Shown on the paper above the body. */
  lead?: ReactNode;
  /** False hides Delete on this page view. */
  canDelete?: boolean;
};

/** Loads one page, saves edits (debounced), and draws it with PageEditorView. Also used by Today. */
export function NotePage({ noteId, backHref, lead, canDelete }: NotePageProps) {
  const router = useRouter();
  const { t } = useLocale();
  const online = useOnline();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  // notes.getSafe calls requireUser, so wait until the corresponding user row exists.
  // During sign-in getProfile resolves safely while the user record is being created.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const note = useQuery(
    api.notes.getSafe,
    isAuthenticated && profile != null ? { noteId } : "skip",
  );
  const updateNote = useMutation(api.notes.update);
  const togglePin = useMutation(api.notes.togglePin);
  const removeNote = useMutation(api.notes.remove);
  const restoreNote = useMutation(api.notes.restore);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [undoUntilMs, setUndoUntilMs] = useState<number | null>(null);
  const wasDeleted = useRef(false);
  const loadedNoteId = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef("");
  const bodyRef = useRef("");
  // Which fields were edited here since their last successful save. Saves send only those, so a
  // failed save is never taken for saved, and another tab's change to the other field survives.
  const edits = useRef({ title: false, body: false });

  useEffect(() => {
    if (note && loadedNoteId.current !== note._id) {
      setTitle(note.title);
      setBody(note.body);
      titleRef.current = note.title;
      bodyRef.current = note.body;
      loadedNoteId.current = note._id;
      setSaveState("idle");
    }
  }, [note]);

  useEffect(() => {
    return () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      if (!wasDeleted.current) {
        void updateNote({ noteId: noteId as Id<"notes">, ...notePatch(edits.current, titleRef.current, bodyRef.current) });
      }
    };
  }, [noteId, updateNote]);

  // Another writer changed this page while it is open: the coach saving a decision to today's
  // page, or the same page in another tab. With no unsaved body edit here the editor takes the
  // new text, so the next autosave can't write over it. Unsaved edits here (or a save on its
  // way) win, as before.
  const [remoteBody, setRemoteBody] = useState<{ before: string; after: string; seq: number } | null>(null);
  useEffect(() => {
    if (!note || loadedNoteId.current !== note._id || wasDeleted.current) return;
    if (note.body === bodyRef.current || edits.current.body || saveTimer.current) return;
    const before = bodyRef.current;
    bodyRef.current = note.body;
    setBody(note.body);
    setRemoteBody((current) => ({ before, after: note.body, seq: (current?.seq ?? 0) + 1 }));
  }, [note]);
  // The same for the title: a rename saved in another tab shows here instead of being written back.
  useEffect(() => {
    if (!note || loadedNoteId.current !== note._id || wasDeleted.current) return;
    if (!shouldAdoptRemoteTitle(note.title, titleRef.current, edits.current.title, saveTimer.current !== null)) return;
    titleRef.current = note.title;
    setTitle(note.title);
  }, [note]);
  const saveNow = async () => {
    const title = titleRef.current;
    const body = bodyRef.current;
    const patch = notePatch(edits.current, title, body);
    if (patch.title === undefined && patch.body === undefined) return;
    await updateNote({ noteId: noteId as Id<"notes">, ...patch });
    if (titleRef.current === title) edits.current.title = false;
    if (bodyRef.current === body) edits.current.body = false;
  };

  const scheduleSave = () => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      try {
        await saveNow();
        setSaveState("saved");
      } catch {
        // Stays dirty: the next edit, Try again or the coach's flush saves it again. The page says so
        // instead of showing "Saving…" forever.
        setSaveState("error");
      }
    }, 500);
  };

  const retrySave = async () => {
    setSaveState("saving");
    try {
      await saveNow();
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  // The coach beside this page saves its pending edits before it reads the page (Codex P2 on #923).
  useRegisterCoachPageFlush(async () => {
    if (wasDeleted.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!edits.current.title && !edits.current.body) return;
    try {
      await saveNow();
      setSaveState("saved");
    } catch (error) {
      // Keep the edit queued, so it is not lost, and let the coach know it did not save.
      scheduleSave();
      throw error;
    }
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    titleRef.current = value;
    edits.current.title = true;
    scheduleSave();
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    bodyRef.current = value;
    edits.current.body = true;
    scheduleSave();
  };

  const handleTogglePin = async () => {
    await togglePin({ noteId: noteId as Id<"notes"> });
  };

  const handleDelete = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      await updateNote({
        noteId: noteId as Id<"notes">,
        ...notePatch(edits.current, titleRef.current, bodyRef.current),
      });
    }
    const result = await removeNote({ noteId: noteId as Id<"notes"> });
    wasDeleted.current = true;
    setUndoUntilMs(result.undoUntilMs);
    window.history.replaceState(window.history.state, "", "/notes");
  };

  const handleUndo = async () => {
    const result = await restoreNote({ noteId: noteId as Id<"notes"> });
    // The toast keeps itself open with "That didn't undo" when this throws.
    if (!result.success) throw new Error("undo window ended");
    wasDeleted.current = false;
    setConfirmingDelete(false);
    window.history.replaceState(window.history.state, "", `/notes/${noteId}`);
    setUndoUntilMs(null);
    router.refresh();
  };

  const handleUndoExpire = () => {
    // replaceState above changed the visible URL without changing Next's mounted route.
    // A document navigation guarantees the deleted editor is unmounted on expiry.
    window.location.replace("/notes");
  };

  if (undoUntilMs !== null) {
    // The page is gone: the v3 notes list, with the shared glass toast (5:00 countdown, Undo).
    return (
      <>
        <NotesList />
        <UndoToast
          title={t("notes.removedShort")}
          untilMs={undoUntilMs}
          onUndo={handleUndo}
          onClose={() => {
            // After a successful Undo the page is back: stay. Otherwise (expired or dismissed) leave.
            if (wasDeleted.current) handleUndoExpire();
          }}
        />
      </>
    );
  }

  const loadState = getNoteLoadState(note);

  // Until sign-in resolves there is no page yet: never an editable empty "Untitled" page.
  if (loadState === "loading" && (isAuthenticated || authLoading)) {
    return (
      <div className="tp-paper" data-component="PageEditor">
        <div className="tp-page__body">
          <StateLoading label={t("page.loading")} rows={4} box={false} />
        </div>
      </div>
    );
  }

  if (loadState === "not-found") {
    return <NoteNotFound />;
  }

  return (
    <PageEditorView
      key={note?._id ?? noteId}
      noteId={noteId}
      title={title}
      initialBody={note?.body ?? body}
      body={body}
      remoteBody={remoteBody}
      pinned={note?.pinned ?? false}
      saveState={saveState}
      onRetrySave={() => void retrySave()}
      offline={!online}
      confirmingDelete={confirmingDelete}
      onTitleChange={handleTitleChange}
      onBodyChange={handleBodyChange}
      onTogglePin={() => void handleTogglePin()}
      onAskDelete={() => setConfirmingDelete(true)}
      onConfirmDelete={() => void handleDelete()}
      onCancelDelete={() => setConfirmingDelete(false)}
      backHref={backHref}
      lead={lead ?? (note?.pageType === "weekly" && note.date ? <WeekGlance monday={note.date} /> : undefined)}
      canDelete={canDelete}
    />
  );
}
