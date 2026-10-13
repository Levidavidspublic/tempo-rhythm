"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { NoteNotFound } from "./NoteNotFound";
import { PageEditorView } from "./PageEditorView";
import { useRegisterCoachPageFlush } from "@/components/coach/CoachPage";
import { UndoDeleteToast } from "./UndoDeleteToast";

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

function snippet(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "No content yet.";
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

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

function NotesList() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const notes = useQuery(api.notes.list, isAuthenticated ? {} : "skip");
  const createNote = useMutation(api.notes.create);
  const togglePin = useMutation(api.notes.togglePin);
  const removeNote = useMutation(api.notes.remove);
  const restoreNote = useMutation(api.notes.restore);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  // Pages deleted from this list, each with its own 5-minute Undo (the same window as a page's
  // own). The newest shows first; once it is undone or expires, the one before it shows again.
  const [removedStack, setRemovedStack] = useState<{ id: Id<"notes">; undoUntilMs: number }[]>([]);
  const removed = removedStack.at(-1) ?? null;
  const [isCreating, setIsCreating] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const isLoading = isAuthenticated && notes === undefined;
  const visibleNotes = sortPinnedFirst(notes ?? []);

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const id = await createNote({ title: "Untitled note", body: "" });
      router.push(`/notes/${id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePin = async (id: Id<"notes">) => {
    if (pinningId) return;
    setPinMessage(null);
    setPinningId(id);
    try {
      const outcome = await runPinToggle(isAuthenticated, () => togglePin({ noteId: id }));
      if (outcome === "signed-out") setPinMessage(PIN_SIGNED_OUT_COPY);
      else if (outcome === "error") setPinMessage(PIN_ERROR_COPY);
    } finally {
      setPinningId(null);
    }
  };

  const handleDelete = async (id: Id<"notes">) => {
    const result = await removeNote({ noteId: id });
    setPendingDeleteId(null);
    setRemovedStack((stack) => [...stack.filter((r) => r.id !== id), { id, undoUntilMs: result.undoUntilMs }]);
  };

  const handleUndo = async () => {
    if (!removed) return;
    const result = await restoreNote({ noteId: removed.id });
    if (result.success) setRemovedStack((stack) => stack.filter((r) => r.id !== removed.id));
  };

  // Drops the shown entry and any other whose window has ended.
  const handleUndoExpire = () => {
    const now = Date.now();
    setRemovedStack((stack) => stack.filter((r) => r.id !== removed?.id && r.undoUntilMs > now));
  };

  return (
    <main className="container mx-auto max-w-4xl px-6 py-12">
      <div className="space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-eyebrow text-muted-foreground">Library</p>
            <h1 className="font-heading text-4xl font-semibold text-foreground">Notes</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {isLoading
                ? "Loading your notes."
                : visibleNotes.length === 0
                  ? "Nothing here yet. A note takes one click."
                  : `${visibleNotes.length} ${visibleNotes.length === 1 ? "note" : "notes"}, pinned first.`}
            </p>
          </div>
          <Button type="button" disabled={isCreating} onClick={() => void handleCreate()}>
            New note
          </Button>
        </header>

        {pinMessage ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {pinMessage}
          </p>
        ) : null}

        {visibleNotes.length === 0 && !isLoading ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/70 px-6 py-12 text-center">
            <p className="text-lg font-medium text-foreground">No notes yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">Start with whatever is on your mind.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleNotes.map((note) => (
              <li
                key={note._id}
                className="rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <Link href={`/notes/${note._id}`} className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-medium text-foreground">{note.title || "Untitled note"}</p>
                      {note.pinned ? (
                        <span className="rounded-pill bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{snippet(note.body)}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pinningId !== null}
                      aria-label={note.pinned ? `Unpin ${note.title || "Untitled note"}` : `Pin ${note.title || "Untitled note"}`}
                      onClick={() => void handleTogglePin(note._id)}
                    >
                      {note.pinned ? "Unpin" : "Pin"}
                    </Button>
                    {pendingDeleteId === note._id ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          aria-label={`Confirm delete ${note.title || "Untitled note"}`}
                          onClick={() => void handleDelete(note._id)}
                        >
                          Confirm delete
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setPendingDeleteId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`Delete ${note.title || "Untitled note"}`}
                        onClick={() => setPendingDeleteId(note._id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {removed ? (
        <UndoDeleteToast
          key={removed.id}
          undoUntilMs={removed.undoUntilMs}
          onUndo={handleUndo}
          onExpire={handleUndoExpire}
        />
      ) : null}
    </main>
  );
}

type SaveState = "idle" | "saving" | "saved";

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
  const { isAuthenticated } = useConvexAuth();
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
        void updateNote({ noteId: noteId as Id<"notes">, title: titleRef.current, body: bodyRef.current });
      }
    };
  }, [noteId, updateNote]);

  const scheduleSave = () => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      await updateNote({ noteId: noteId as Id<"notes">, title: titleRef.current, body: bodyRef.current });
      setSaveState("saved");
    }, 500);
  };

  // The coach beside this page saves its pending edits before it reads the page (Codex P2 on #923).
  useRegisterCoachPageFlush(async () => {
    if (!saveTimer.current || wasDeleted.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    await updateNote({ noteId: noteId as Id<"notes">, title: titleRef.current, body: bodyRef.current });
    setSaveState("saved");
  });

  const handleTitleChange = (value: string) => {
    setTitle(value);
    titleRef.current = value;
    scheduleSave();
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    bodyRef.current = value;
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
        title: titleRef.current,
        body: bodyRef.current,
      });
    }
    const result = await removeNote({ noteId: noteId as Id<"notes"> });
    wasDeleted.current = true;
    setUndoUntilMs(result.undoUntilMs);
    window.history.replaceState(window.history.state, "", "/notes");
  };

  const handleUndo = async () => {
    const result = await restoreNote({ noteId: noteId as Id<"notes"> });
    if (!result.success) return;
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
    return (
      <>
        <NotesList />
        <UndoDeleteToast
          undoUntilMs={undoUntilMs}
          onUndo={handleUndo}
          onExpire={handleUndoExpire}
        />
      </>
    );
  }

  const loadState = getNoteLoadState(note);

  if (loadState === "loading" && isAuthenticated) {
    return (
      <main className="container mx-auto max-w-3xl px-6 py-12">
        <p className="text-muted-foreground">Loading note.</p>
      </main>
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
      pinned={note?.pinned ?? false}
      saveState={saveState}
      confirmingDelete={confirmingDelete}
      onTitleChange={handleTitleChange}
      onBodyChange={handleBodyChange}
      onTogglePin={() => void handleTogglePin()}
      onAskDelete={() => setConfirmingDelete(true)}
      onConfirmDelete={() => void handleDelete()}
      onCancelDelete={() => setConfirmingDelete(false)}
      backHref={backHref}
      lead={lead}
      canDelete={canDelete}
    />
  );
}
