"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { notePatch, shouldAdoptRemoteTitle } from "@/lib/note-sync";
import { NoteNotFound } from "./NoteNotFound";
import { PageEditorView } from "./PageEditorView";
import { useRegisterCoachPageFlush } from "@/components/coach/CoachPage";
import { UndoDeleteToast } from "./UndoDeleteToast";
import { WeekGlance } from "./WeekGlance";

type NoteRecord = Doc<"notes">;

function sortPinnedFirst(notes: NoteRecord[]): NoteRecord[] {
  return [...notes].sort((a, b) => {
    if (a.pinned === b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });
}

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

function snippet(body: string, empty: string): string {
  const trimmed = body.trim();
  if (!trimmed) return empty;
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
  const { t } = useLocale();
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
  const [pinMessage, setPinMessage] = useState<MessageKey | null>(null);

  const isLoading = isAuthenticated && notes === undefined;
  const visibleNotes = sortPinnedFirst(notes ?? []);
  const label = (note: NoteRecord) => note.title || t("notes.untitled");

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const id = await createNote({ title: t("notes.untitled"), body: "" });
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
      if (outcome === "signed-out") setPinMessage("notes.pinSignedOut");
      else if (outcome === "error") setPinMessage("notes.pinError");
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

  // A div, not a main: the shell's <main id="main"> already holds this screen.
  return (
    <div className="container mx-auto max-w-4xl px-6 py-12">
      <div className="space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-eyebrow text-muted-foreground">{t("notes.eyebrow")}</p>
            <h1 className="font-heading text-4xl font-semibold text-foreground">
              {t("notes.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {isLoading
                ? t("notes.loading")
                : visibleNotes.length === 0
                  ? t("notes.emptyLede")
                  : visibleNotes.length === 1
                    ? t("notes.count.one")
                    : t("notes.count.many").replace("{n}", String(visibleNotes.length))}
            </p>
          </div>
          <Button type="button" disabled={isCreating} onClick={() => void handleCreate()}>
            {t("notes.new")}
          </Button>
        </header>

        {pinMessage ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {t(pinMessage)}
          </p>
        ) : null}

        {visibleNotes.length === 0 && !isLoading ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/70 px-6 py-12 text-center">
            <p className="text-lg font-medium text-foreground">{t("notes.none")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("notes.noneHint")}</p>
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
                      <p className="text-lg font-medium text-foreground">{label(note)}</p>
                      {note.pinned ? (
                        <span className="rounded-pill bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {t("notes.pinned")}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {snippet(note.body, t("notes.noContent"))}
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pinningId !== null}
                      aria-label={`${note.pinned ? t("notes.unpin") : t("notes.pin")} ${label(note)}`}
                      onClick={() => void handleTogglePin(note._id)}
                    >
                      {note.pinned ? t("notes.unpin") : t("notes.pin")}
                    </Button>
                    {pendingDeleteId === note._id ? (
                      <>
                        <Button
                          type="button"
                          variant="destructive"
                          aria-label={`${t("notes.confirmDelete")} ${label(note)}`}
                          onClick={() => void handleDelete(note._id)}
                        >
                          {t("notes.confirmDelete")}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setPendingDeleteId(null)}>
                          {t("notes.cancel")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={`${t("notes.delete")} ${label(note)}`}
                        onClick={() => setPendingDeleteId(note._id)}
                      >
                        {t("notes.delete")}
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
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved";

// Pending requests survive a page remount; settled entries never retain a note draft.
const pendingPageSaves = new Map<string, Promise<void>>();

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
  // Which fields were edited here since their last successful save. Saves send only those, so a
  // failed save is never taken for saved, and another tab's change to the other field survives.
  const edits = useRef({ title: false, body: false });
  type Operation = "save" | "pin" | "delete";
  type Owner = {
    noteId: string;
    alive: boolean;
    revision: number;
    save: Promise<void> | null;
    saveRevision: number;
    savedRevision: number;
    pin: boolean;
    deleting: boolean;
    deleteIntent: number;
  };
  const ownerRef = useRef<Owner | null>(null);
  const flushLeavingSave = useRef<(owner: Owner) => void>(() => {});
  const [errors, setErrors] = useState({ save: false, pin: false, delete: false });
  const [busy, setBusy] = useState({ save: false, pin: false, delete: false });

  // A completion belongs to this mounted note, not merely to a matching note id.
  // Layout cleanup also fences settlements during removal and StrictMode replay.
  useLayoutEffect(() => {
    const owner: Owner = { noteId, alive: true, revision: 0, save: null, saveRevision: 0, savedRevision: -1, pin: false, deleting: false, deleteIntent: 0 };
    ownerRef.current = owner;
    setErrors({ save: false, pin: false, delete: false });
    setBusy({ save: false, pin: false, delete: false });
    return () => {
      owner.alive = false;
      flushLeavingSave.current(owner);
    };
  }, [noteId]);
  const owns = (owner: Owner | null): owner is Owner =>
    owner?.alive === true && ownerRef.current === owner && owner.noteId === noteId && !wasDeleted.current;
  const markError = (owner: Owner, operation: Operation, failed: boolean) => {
    if (owns(owner)) setErrors((current) => ({ ...current, [operation]: failed }));
  };
  const markBusy = (owner: Owner, operation: Operation, pending: boolean) => {
    if (owns(owner)) setBusy((current) => ({ ...current, [operation]: pending }));
  };

  useEffect(() => {
    if (note && loadedNoteId.current !== note._id) {
      setTitle(note.title);
      setBody(note.body);
      titleRef.current = note.title;
      bodyRef.current = note.body;
      loadedNoteId.current = note._id;
      edits.current = { title: false, body: false };
      wasDeleted.current = false;
      setConfirmingDelete(false);
      setUndoUntilMs(null);
      setSaveState("idle");
    }
  }, [note]);



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
  const saveSnapshot = (owner: Owner) => ({
    savedTitle: titleRef.current,
    savedBody: bodyRef.current,
    revision: owner.revision,
    patch: notePatch(edits.current, titleRef.current, bodyRef.current),
  });
  const saveNow = async (owner: Owner, snapshot = saveSnapshot(owner)) => {
    const { savedTitle, savedBody, revision, patch } = snapshot;
    // Joining this revision propagates its rejection without silently retrying it.
    if (owner.save && revision <= owner.saveRevision) return owner.save;
    if (revision <= owner.savedRevision || (patch.title === undefined && patch.body === undefined)) {
      // A clean reopened editor still waits for this note's outgoing write before chat/delete.
      return pendingPageSaves.get(owner.noteId);
    }
    markBusy(owner, "save", true);
    if (owns(owner)) setSaveState("saving");
    owner.saveRevision = revision;
    // Enqueue immediately: a reopened page must follow this outgoing immutable snapshot.
    // An earlier rejected revision releases the queue for this explicit newer write.
    const previous = pendingPageSaves.get(owner.noteId);
    const request = Promise.resolve(previous).catch(() => {}).then(async () => {
      try {
        await updateNote({ noteId: owner.noteId as Id<"notes">, ...patch });
        owner.savedRevision = revision;
        if (!owns(owner)) return;
        if (patch.title !== undefined && titleRef.current === savedTitle) edits.current.title = false;
        if (patch.body !== undefined && bodyRef.current === savedBody) edits.current.body = false;
        if (!edits.current.title && !edits.current.body) {
          setSaveState("saved");
          markError(owner, "save", false);
        }
      } catch (error) {
        if (owns(owner) && owner.revision === revision) {
          setSaveState("idle");
          markError(owner, "save", true);
        }
        throw error;
      } finally {
        if (owner.save === request) {
          owner.save = null;
          markBusy(owner, "save", false);
        }
        if (pendingPageSaves.get(owner.noteId) === request) pendingPageSaves.delete(owner.noteId);
      }
    });
    owner.save = request;
    pendingPageSaves.set(owner.noteId, request);
    await request;
  };

  flushLeavingSave.current = (owner) => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (wasDeleted.current) return;
    // Layout cleanup captures the outgoing refs before another note replaces them.
    // The same writer keeps this pending debounce behind any earlier request.
    void saveNow(owner, saveSnapshot(owner)).catch(() => {
      // The page has left; retain the existing best-effort cleanup contract.
    });
  };

  const scheduleSave = () => {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const owner = ownerRef.current;
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      if (!owns(owner)) return;
      try {
        await saveNow(owner);
      } catch {
        // saveNow exposed recovery and kept dirty fields; this event has no promise consumer.
      }
    }, 500);
  };

  // The coach beside this page saves its pending edits before it reads the page (Codex P2 on #923).
  useRegisterCoachPageFlush(async () => {
    if (wasDeleted.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const owner = ownerRef.current;
    if (!owns(owner)) return;
    // A rejected save still rejects the coach's flush. Recovery never sends a coach turn.
    do {
      await saveNow(owner);
      if (!owns(owner)) throw new Error("Page changed before its save completed");
    } while (edits.current.title || edits.current.body);
  });

  // A reload or a closed tab never unmounts this page, so the unmount save above doesn't run and
  // the timer may never fire. When the tab is hidden or the page goes away, a waiting save is sent
  // at once, in place of the timer (so the timer can't send it a second time).
  const sendWaitingSave = useRef(() => {});
  sendWaitingSave.current = () => {
    if (!saveTimer.current || wasDeleted.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const owner = ownerRef.current;
    if (owns(owner)) void saveNow(owner).catch(() => {
      // The current page keeps its draft and exposes the same explicit save recovery.
    });
  };
  useEffect(() => {
    const onPageHide = () => sendWaitingSave.current();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendWaitingSave.current();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    titleRef.current = value;
    edits.current.title = true;
    if (ownerRef.current) ownerRef.current.revision += 1;
    scheduleSave();
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    bodyRef.current = value;
    edits.current.body = true;
    if (ownerRef.current) ownerRef.current.revision += 1;
    scheduleSave();
  };

  const handleTogglePin = async () => {
    const owner = ownerRef.current;
    if (!owns(owner) || owner.pin || owner.deleting) return;
    owner.pin = true;
    markBusy(owner, "pin", true);
    try {
      await togglePin({ noteId: owner.noteId as Id<"notes"> });
      markError(owner, "pin", false);
    } catch {
      markError(owner, "pin", true);
    } finally {
      owner.pin = false;
      markBusy(owner, "pin", false);
    }
  };

  const handleDelete = async () => {
    const owner = ownerRef.current;
    if (!owns(owner) || owner.deleting || owner.pin) return;
    owner.deleting = true;
    const intent = owner.deleteIntent;
    markBusy(owner, "delete", true);
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      // A failed autosave has no timer, but its draft still must save before deletion.
      while (owns(owner) && (pendingPageSaves.has(owner.noteId) || edits.current.title || edits.current.body)) {
        await saveNow(owner);
      }
      if (!owns(owner) || owner.deleteIntent !== intent) return;
      const result = await removeNote({ noteId: owner.noteId as Id<"notes"> });
      if (!owns(owner)) return;
      setBusy({ save: false, pin: false, delete: false });
      setErrors({ save: false, pin: false, delete: false });
      wasDeleted.current = true;
      setUndoUntilMs(result.undoUntilMs);
      window.history.replaceState(window.history.state, "", "/notes");
    } catch {
      if (owner.deleteIntent === intent) markError(owner, "delete", true);
    } finally {
      owner.deleting = false;
      markBusy(owner, "delete", false);
    }
  };

  const retrySave = async () => {
    const owner = ownerRef.current;
    if (!owns(owner) || owner.save || owner.deleting) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    try { await saveNow(owner); } catch {
      // The error stays visible and the draft stays dirty until a successful save.
    }
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
      <div className="container mx-auto max-w-3xl px-6 py-12">
        <p className="text-muted-foreground">{t("notes.loadingNote")}</p>
      </div>
    );
  }

  if (loadState === "not-found") {
    return <NoteNotFound />;
  }

  return (
    <>
    {(["save", "pin", "delete"] as const).map((operation) => errors[operation] ? (
      <div className="tp-notice" role="alert" data-component="PageActionError" data-operation={operation} key={operation}>
        <p className="tp-notice__text">{t(operation === "pin" ? "notes.pinError" : "notes.error")}</p>
        <button
          type="button"
          className="tp-btn tp-btn--secondary tp-notice__action"
          disabled={busy[operation] || (operation === "save" && busy.delete)}
          aria-busy={busy[operation]}
          onClick={() => void (operation === "save" ? retrySave() : operation === "pin" ? handleTogglePin() : handleDelete())}
        >
          {t("coachChat.retry")}
        </button>
      </div>
    ) : null)}
    <PageEditorView
      key={note?._id ?? noteId}
      noteId={noteId}
      title={title}
      initialBody={note?.body ?? body}
      body={body}
      remoteBody={remoteBody}
      pinned={note?.pinned ?? false}
      saveState={saveState}
      confirmingDelete={confirmingDelete}
      onTitleChange={handleTitleChange}
      onBodyChange={handleBodyChange}
      onTogglePin={() => void handleTogglePin()}
      onAskDelete={() => setConfirmingDelete(true)}
      onConfirmDelete={() => void handleDelete()}
      onCancelDelete={() => {
        if (ownerRef.current) ownerRef.current.deleteIntent += 1;
        setConfirmingDelete(false);
        setErrors((current) => ({ ...current, delete: false }));
      }}
      backHref={backHref}
      lead={lead ?? (note?.pageType === "weekly" && note.date ? <WeekGlance monday={note.date} /> : undefined)}
      canDelete={canDelete}
    />
    </>
  );
}
