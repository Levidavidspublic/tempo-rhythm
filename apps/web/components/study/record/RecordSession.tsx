"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { studyHref } from "@/components/ingest";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { UndoToast } from "@/components/you/UndoToast";
import type { Id } from "@/convex/_generated/dataModel";
import { translate } from "@/lib/i18n";
import { buildRecordingPage, extractActions, type RecordLang } from "../../../../../packages/core/record";
import { useToastRoom } from "../useToastRoom";
import { CaptureStep, type TranscriptLine } from "./CaptureStep";
import { ConsentStep, type OffReason } from "./ConsentStep";
import {
  IDLE_CLOCK,
  acceptedTasks,
  addPin,
  anyDecided,
  clockElapsed,
  clockPause,
  clockStart,
  defaultTitle,
  editRow,
  isPinKey,
  joinTranscript,
  type Pin,
  type RecordCopy,
  recordCopy,
  removePin,
  type ReviewRow,
  type RowSource,
  rowsFromProposal,
  rowsFromSuggestions,
  setPinNote,
  setRowStatus,
} from "./recordFlow";
import { useRecordingAvailability, useRecordingSave } from "./recordApi";
import { ReviewStep } from "./ReviewStep";
import { useLiveWords } from "./useLiveWords";

type Step = "consent" | "capture" | "review" | "saved";
type Saved = { noteId: Id<"notes">; taskIds: Id<"tasks">[]; undoUntil: number; count: number };
/** Bring it back lasts 5 minutes from the Undo; the server's `redoUntil` says exactly when. */
const BRING_BACK_MS = 5 * 60_000;

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  } catch {
    return false;
  }
}

let idCounter = 0;
const nextId = (prefix: string) => {
  idCounter += 1;
  return `${prefix}${idCounter}`;
};

/**
 * RecordSession (kitchen T8, S7): record a meeting or lecture. Consent → live words (or typed
 * notes) with pins → review → one page and the tasks the person accepted, with a 5-minute Undo.
 * Undo always takes back what that save made, in one click (HARD_RULES §1), and only that; when
 * that also took changes made since (the page or a task changed, or a task is done), a toast says
 * so in words and offers Bring it back for 5 minutes.
 * Audio is never stored; the transcript lives only in this screen until the person saves.
 *
 * Offline (`online` false), the screen says so and Save waits instead of sending: the button says
 * "Saves when you're back online" and the save goes ahead by itself once the browser is back
 * online (as SetEditor and IngestSheet do). RecordScreen (the route's component) passes `online`
 * and handles signed out; this component assumes a signed-in person.
 */
export function RecordSession({
  online = true,
  signedOut = false,
  canSend = !signedOut,
}: {
  online?: boolean;
  /**
   * The session dropped after the screen was ready (RecordKeeper keeps this screen mounted): a
   * notice says so, and Save waits for the sign-in the way it waits for the connection.
   */
  signedOut?: boolean;
  /**
   * Whether the person this screen opened for is signed in right now (RecordKeeper). False while
   * the session is being checked again or signed out: Save waits, and Undo and Bring it back send
   * nothing and say so, so nothing is written before the account is known to be the same one.
   */
  canSend?: boolean;
} = {}) {
  const { lang: uiLang } = useLocale();
  const copy = recordCopy(uiLang);
  const [talkLang, setTalkLang] = useState<RecordLang>(uiLang);
  const availability = useRecordingAvailability(talkLang);
  const { propose, saveSession, undoSave, redoUndo } = useRecordingSave();

  const [step, setStep] = useState<Step>("consent");
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<"live" | "type">("type");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [pins, setPins] = useState<Pin[]>([]);
  const [clock, setClock] = useState(IDLE_CLOCK);
  const [now, setNow] = useState(() => Date.now());
  const [reducedMotion, setReducedMotion] = useState(false);
  const startedAt = useRef(0);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [transcript, setTranscript] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [rowSource, setRowSource] = useState<RowSource>("local");
  const [proposing, setProposing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // Save was pressed offline: it waits for the connection.
  const [held, setHeld] = useState(false);
  // A save found no title (a waiting save whose title was cleared): the field says so.
  const [titleMissing, setTitleMissing] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [undone, setUndone] = useState(false);
  // After an Undo that took changes made since: that save, until Bring it back closes.
  const [bringBack, setBringBack] = useState<{ saved: Saved; until: number } | null>(null);
  useToastRoom(bringBack ?? (toastOpen ? saved : null));
  const [restored, setRestored] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleTouched = useRef(false);
  const reviewRun = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const onFinal = useCallback((text: string) => {
    setLines((current) => [...current, { id: nextId("w"), text }]);
  }, []);
  const live = useLiveWords({ lang: talkLang, onFinal, onInterim: setInterim });

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
  }, []);

  // When live words stop on their own (no minutes, a dropped socket, a hidden tab), the notes
  // box takes over so the person can keep going by typing.
  useEffect(() => {
    if (live.issue && step === "capture") setMode("type");
  }, [live.issue, step]);

  // The elapsed clock ticks while capturing.
  useEffect(() => {
    if (step !== "capture") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const paused = step === "capture" && clock.runningSince === null;
  const elapsedMs = clockElapsed(clock, now);

  const pinNow = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setPins((current) => addPin(current, clockElapsed(clock, at), nextId("p")));
  }, [clock]);

  // The P key pins "now" while capturing, unless the person is typing in a field.
  useEffect(() => {
    if (step !== "capture") return;
    const onKey = (event: Event) => {
      const key = event as KeyboardEvent;
      if (!isPinKey(key)) return;
      key.preventDefault();
      pinNow();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, pinNow]);

  const beginCapture = (nextMode: "live" | "type") => {
    const at = Date.now();
    if (startedAt.current === 0) startedAt.current = at;
    setUndone(false);
    setRestored(false);
    setMode(nextMode);
    setStep("capture");
    setNow(at);
    setClock((current) => clockStart(current, at));
  };

  const startLive = () => {
    // No consent, no microphone.
    if (!consent || !availability?.live) return;
    beginCapture("live");
    void live.start({ reducedMotion });
  };

  const startTyping = () => {
    live.clearIssue();
    beginCapture("type");
  };

  const pause = () => {
    const at = Date.now();
    setNow(at);
    setClock((current) => clockPause(current, at));
    live.pause();
  };

  const resume = () => {
    const at = Date.now();
    setNow(at);
    setClock((current) => clockStart(current, at));
    live.resume();
  };

  const finish = () => {
    live.stop();
    const at = Date.now();
    setNow(at);
    setClock((current) => clockPause(current, at));
    const text = joinTranscript(
      lines.map((line) => line.text),
      typed,
    );
    setTranscript(text);
    if (!titleTouched.current) setTitle(defaultTitle(copy, startedAt.current || at, talkLang));
    setSummary("");
    setRows(rowsFromSuggestions(extractActions(text, talkLang)));
    setRowSource("local");
    setSaveError(false);
    setTitleMissing(false);
    setStep("review");
    const run = ++reviewRun.current;
    if (availability?.proposals && text.trim().length > 0) {
      setProposing(true);
      void propose({
        transcript: text,
        pins: pins.map((pin) => ({ atMs: pin.atMs, ...(pin.note.trim() ? { note: pin.note.trim() } : {}) })),
        lang: talkLang,
      })
        .then((result) => {
          if (run !== reviewRun.current || result.status !== "ready") return;
          // A late reply never overrides choices the person already made.
          if (anyDecided(rowsRef.current)) return;
          setRows(rowsFromProposal(result.tasks));
          setRowSource("model");
          setSummary(result.summary);
          if (!titleTouched.current) setTitle(result.title);
        })
        .catch(() => {})
        .finally(() => {
          if (run === reviewRun.current) setProposing(false);
        });
    } else {
      setProposing(false);
    }
  };

  const save = async () => {
    if (saving) return;
    // ReviewStep checks the title before a Save; a waiting save checks it again when it goes, so a
    // title cleared while offline is flagged on the field instead of saving an untitled page.
    if (title.trim().length === 0) {
      setHeld(false);
      setTitleMissing(true);
      return;
    }
    if (!online || !canSend) {
      setHeld(true);
      return;
    }
    setHeld(false);
    setSaving(true);
    setSaveError(false);
    const tasks = acceptedTasks(rows);
    try {
      const body = buildRecordingPage({
        title: title.trim(),
        startedAt: startedAt.current || Date.now(),
        transcript,
        pins: pins.map((pin) => ({ atMs: pin.atMs, note: pin.note })),
        lang: talkLang,
        summary,
      });
      const result = await saveSession({ title: title.trim(), body, tasks, lang: talkLang });
      reviewRun.current += 1;
      // A new save is the screen's now: the one an earlier Undo took stays gone.
      setBringBack(null);
      setRestored(false);
      setProposing(false);
      setSaved({ ...result, count: tasks.length });
      setToastOpen(true);
      setStep("saved");
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // A waiting save goes ahead by itself once the browser is back online and the same person is
  // signed in again, while review is open.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!held) return;
    if (step !== "review") setHeld(false);
    else if (online && canSend) void saveRef.current();
  }, [online, canSend, held, step]);

  // Offline, Undo and Bring it back send nothing (Convex would hold them and the toast would stay
  // busy): the throw keeps the toast open with its error line, which says so in words. Signed out
  // (or while the session is checked again) they send nothing either, and the line says that.
  const undo = async () => {
    if (!saved) return;
    if (!online) throw new Error("offline");
    if (!canSend) throw new Error("signedOut");
    const result = await undoSave({ noteId: saved.noteId, taskIds: saved.taskIds });
    setSaved(null);
    setUndone(true);
    setRestored(false);
    setStep("review");
    if (result.removedEdits || (result.removedDone ?? 0) > 0) {
      setBringBack({ saved, until: result.redoUntil ?? Date.now() + BRING_BACK_MS });
    }
  };

  const bringItBack = async () => {
    if (!bringBack) return;
    if (!online) throw new Error("offline");
    if (!canSend) throw new Error("signedOut");
    await redoUndo({ noteId: bringBack.saved.noteId });
    reviewRun.current += 1;
    setProposing(false);
    setSaved(bringBack.saved);
    setUndone(false);
    setRestored(true);
    setStep("saved");
    // The save's own Undo runs from when it was made: offer it again while that window is open.
    setToastOpen(Date.now() < bringBack.saved.undoUntil);
    // The toast's button goes with it: the keyboard moves to "Open the page" on the saved step.
    window.setTimeout(
      () => rootRef.current?.querySelector<HTMLElement>('[data-step="saved"] a')?.focus(),
      0,
    );
  };

  const restart = () => {
    reviewRun.current += 1;
    startedAt.current = 0;
    titleTouched.current = false;
    setLines([]);
    setTyped("");
    setPins([]);
    setClock(IDLE_CLOCK);
    setTitle("");
    setSummary("");
    setTranscript("");
    setRows([]);
    setSaved(null);
    setToastOpen(false);
    setUndone(false);
    setBringBack(null);
    setRestored(false);
    setConsent(false);
    live.clearIssue();
    setStep("consent");
  };

  const availabilityReason: OffReason = availability && !availability.live ? availability.reason : null;
  const liveReady = Boolean(availability?.live);

  return (
    <div className="tp-page tp-rec" data-component="RecordSession" ref={rootRef}>
      <RecordHead copy={copy} />
      {online ? null : <RecordOffline copy={copy} />}
      {signedOut ? <RecordSignedOut copy={copy} /> : null}

      {undone ? (
        <output className="tp-notice" data-tone="done" data-component="Notice">
          <span className="tp-notice__icon">
            <TpIcon name="undo" />
          </span>
          <span className="tp-notice__text">{copy("rec.undone")}</span>
        </output>
      ) : null}

      {step === "consent" ? (
        <ConsentStep
          copy={copy}
          talkLang={talkLang}
          onTalkLang={setTalkLang}
          consent={consent}
          onConsent={setConsent}
          liveReady={liveReady}
          offReason={availabilityReason}
          checking={availability === undefined}
          onStart={startLive}
          onType={startTyping}
        />
      ) : null}

      {step === "capture" ? (
        <CaptureStep
          copy={copy}
          mode={mode}
          liveStatus={live.status}
          offReason={live.issue}
          level={live.level}
          reducedMotion={reducedMotion}
          minutesLeft={live.minutesLeft}
          elapsedMs={elapsedMs}
          paused={paused}
          lines={lines}
          interim={interim}
          typed={typed}
          onTyped={setTyped}
          pins={pins}
          onPin={pinNow}
          onPinNote={(id, note) => setPins((current) => setPinNote(current, id, note))}
          onPinRemove={(id) => setPins((current) => removePin(current, id))}
          onPause={pause}
          onResume={resume}
          onStop={finish}
        />
      ) : null}

      {step === "review" ? (
        <ReviewStep
          copy={copy}
          title={title}
          onTitle={(value) => {
            titleTouched.current = true;
            setTitleMissing(false);
            setTitle(value);
          }}
          summary={summary}
          transcript={transcript}
          onTranscript={setTranscript}
          pins={pins}
          rows={rows}
          rowSource={rowSource}
          proposing={proposing}
          onRowStatus={(id, status) => setRows((current) => setRowStatus(current, id, status))}
          onRowEdit={(id, patch) => setRows((current) => editRow(current, id, patch))}
          saving={saving}
          saveError={saveError}
          waiting={held || (saving && !online)}
          waitingFor={signedOut || (online && !canSend) ? "signIn" : "online"}
          titleMissing={titleMissing}
          onSave={() => void save()}
          onBack={() => {
            // Back to the notes: the reviewed transcript becomes the typed notes.
            setLines([]);
            setTyped(transcript);
            beginCapture("type");
            setClock((current) => clockPause(current, Date.now()));
          }}
        />
      ) : null}

      {step === "saved" && saved && restored ? (
        <output className="tp-notice" data-tone="done" data-component="Notice" data-rec-restored="">
          <span className="tp-notice__icon">
            <TpIcon name="check" />
          </span>
          <span className="tp-notice__text">
            {copy(saved.count > 0 ? "rec.restored" : "rec.restored.page")}
          </span>
        </output>
      ) : null}

      {step === "saved" && saved ? <SavedStep noteId={saved.noteId} copy={copy} onAgain={restart} /> : null}

      {toastOpen && saved ? (
        <UndoToast
          title={copy("rec.saved.toast", { n: saved.count })}
          untilMs={saved.undoUntil}
          onUndo={undo}
          onClose={() => setToastOpen(false)}
          labels={
            online && canSend
              ? undefined
              : {
                  action: translate(uiLang, "you.toast.undo"),
                  sub: translate(uiLang, "you.toast.sub"),
                  error: copy(online ? "rec.signedOut.undo" : "rec.offline.undo"),
                }
          }
        />
      ) : null}

      {bringBack ? (
        <UndoToast
          key={bringBack.saved.noteId}
          title={copy(bringBack.saved.count > 0 ? "rec.undoEdited" : "rec.undoEdited.page")}
          untilMs={bringBack.until}
          onUndo={bringItBack}
          onClose={() => setBringBack(null)}
          labels={{
            action: copy("rec.bringBack"),
            sub: copy("rec.bringBackSub"),
            error: copy(!online ? "rec.offline.bringBack" : canSend ? "rec.bringBackError" : "rec.signedOut.bringBack"),
          }}
        />
      ) : null}
    </div>
  );
}

/** The screen's heading, shared with RecordScreen's signed-out, loading and error states. */
export function RecordHead({ copy }: { copy: RecordCopy }) {
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title" id="rec-h1">
          {copy("rec.title")}
        </h1>
        <p className="tp-pagehead__sub">{copy("rec.sub")}</p>
      </div>
    </header>
  );
}

/**
 * Keeps RecordSession mounted once the person was signed in. Before that it draws `before`
 * (RecordScreen's skeletons or sign-in state). After it, a session that reads "loading" again (the
 * profile read resubscribing) keeps the screen, and one that reads signed out (a token refresh that
 * failed) keeps it with a notice: unmounting it would lose the live words, typed notes, chosen rows
 * and any waiting save, and none of that can be recovered (audio is never stored).
 *
 * It remembers whose screen it is (`accountId` at the first "ready"). Saving, a waiting save, Undo
 * and Bring it back go ahead only while that same account reads "ready". When "ready" comes back
 * with a different account (someone else signed in on this browser, in any tab), the screen starts
 * over: the other person's words, notes, rows and waiting save are dropped, never shown or saved.
 */
export function RecordKeeper({
  signedIn,
  accountId,
  online,
  before,
}: {
  signedIn: "loading" | "ready" | "signedOut";
  /** The signed-in account's id (`users.getProfile`'s `_id`); null when there is none yet. */
  accountId?: string | null;
  online: boolean;
  before: (state: "loading" | "signedOut") => ReactNode;
}) {
  const [owner, setOwner] = useState<{ id: string | null | undefined; run: number } | null>(
    signedIn === "ready" ? { id: accountId, run: 0 } : null,
  );
  let current = owner;
  if (signedIn === "ready" && (current === null || current.id !== accountId)) {
    current = { id: accountId, run: current === null ? 0 : current.run + 1 };
    setOwner(current);
  }
  if (current === null) return <>{before(signedIn === "ready" ? "loading" : signedIn)}</>;
  const canSend = signedIn === "ready" && accountId === current.id;
  return (
    <RecordSession
      key={current.run}
      online={online}
      signedOut={signedIn === "signedOut"}
      canSend={canSend}
    />
  );
}

/** Signed out after the screen was ready: the notes stay, and signing in opens in a new tab. */
export function RecordSignedOut({ copy }: { copy: RecordCopy }) {
  return (
    <output className="tp-notice" data-tone="caution" data-component="Notice" data-rec-signedout="">
      <span className="tp-notice__icon">
        <TpIcon name="lock" size="sm" />
      </span>
      <span className="tp-notice__text">
        <span>{copy("rec.signedOut")}</span>
        <a className="tp-btn--link" href="/sign-in" target="_blank" rel="noopener">
          {copy("rec.signedOut.link")}
        </a>
      </span>
    </output>
  );
}

/**
 * The offline notice, in the markup of OfflineNotice (components/goals/shared). It is drawn here
 * rather than imported: goals/shared links convex/react's named hooks, and this component's tests
 * replace only recordApi.ts (see the note there).
 */
export function RecordOffline({ copy }: { copy: RecordCopy }) {
  return (
    <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
      <span className="tp-notice__icon">
        <TpIcon name="wifi-off" size="sm" />
      </span>
      <span className="tp-notice__text">
        <span>{copy("rec.offline")}</span>
      </span>
    </output>
  );
}

/** The saved step: open the new page, record another, or turn the page into something to study. */
export function SavedStep({ noteId, copy, onAgain }: { noteId: string; copy: RecordCopy; onAgain: () => void }) {
  return (
    <section className="tp-surface tp-rec-step" aria-labelledby="rec-saved-h" data-step="saved">
      <h2 className="tp-section__title" id="rec-saved-h">
        {copy("rec.saved.h")}
      </h2>
      <p>{copy("rec.saved.body")}</p>
      <div className="tp-form__actions">
        <a className="tp-btn tp-btn--primary" href={`/notes/${noteId}`}>
          <TpIcon name="page" size="sm" />
          <span>{copy("rec.saved.open")}</span>
        </a>
        <button type="button" className="tp-btn tp-btn--secondary" onClick={onAgain}>
          <TpIcon name="mic" size="sm" />
          <span>{copy("rec.saved.again")}</span>
        </button>
      </div>
      {/* Record → notes → cards → test: the saved page can go straight to a Turn-into preview. */}
      <nav className="tp-form__actions" aria-label={copy("rec.saved.study")} data-rec-study="">
        <Link className="tp-btn tp-btn--ghost" href={studyHref(noteId, "flashcards")}>
          <TpIcon name="card" size="sm" />
          <span>{copy("rec.saved.flashcards")}</span>
        </Link>
        <Link className="tp-btn tp-btn--ghost" href={studyHref(noteId, "quiz")}>
          <TpIcon name="question" size="sm" />
          <span>{copy("rec.saved.quiz")}</span>
        </Link>
        <Link className="tp-btn tp-btn--ghost" href={studyHref(noteId, "test")}>
          <TpIcon name="checklist" size="sm" />
          <span>{copy("rec.saved.test")}</span>
        </Link>
      </nav>
    </section>
  );
}
