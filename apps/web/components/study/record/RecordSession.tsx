"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { studyHref } from "@/components/ingest";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { UndoToast } from "@/components/you/UndoToast";
import type { Id } from "@/convex/_generated/dataModel";
import { buildRecordingPage, extractActions, type RecordLang } from "../../../../../packages/core/record";
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
 * Audio is never stored; the transcript lives only in this screen until the person saves.
 */
export function RecordSession() {
  const { lang: uiLang } = useLocale();
  const copy = recordCopy(uiLang);
  const [talkLang, setTalkLang] = useState<RecordLang>(uiLang);
  const availability = useRecordingAvailability(talkLang);
  const { propose, saveSession, undoSave } = useRecordingSave();

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
  const [saved, setSaved] = useState<Saved | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [undone, setUndone] = useState(false);
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
      const result = await saveSession({ title: title.trim(), body, tasks });
      reviewRun.current += 1;
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

  const undo = async () => {
    if (!saved) return;
    await undoSave({ noteId: saved.noteId, taskIds: saved.taskIds });
    setSaved(null);
    setUndone(true);
    setStep("review");
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
    setConsent(false);
    live.clearIssue();
    setStep("consent");
  };

  const availabilityReason: OffReason = availability && !availability.live ? availability.reason : null;
  const liveReady = Boolean(availability?.live);

  return (
    <div className="tp-page tp-rec" data-component="RecordSession">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title" id="rec-h1">
            {copy("rec.title")}
          </h1>
          <p className="tp-pagehead__sub">{copy("rec.sub")}</p>
        </div>
      </header>

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

      {step === "saved" && saved ? <SavedStep noteId={saved.noteId} copy={copy} onAgain={restart} /> : null}

      {toastOpen && saved ? (
        <UndoToast
          title={copy("rec.saved.toast", { n: saved.count })}
          untilMs={saved.undoUntil}
          onUndo={undo}
          onClose={() => setToastOpen(false)}
        />
      ) : null}
    </div>
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
