"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { kb64t } from "@/lib/i18n-groups/kb-64";
import "@/app/v3/kb-64.css";

export function isUndoActive(undoUntilMs: number, now: number): boolean {
  return now < undoUntilMs;
}

type UndoProps = {
  undoUntilMs: number;
  onUndo: () => Promise<void>;
  onExpire: () => void;
};

export function UndoDeleteToast(props: UndoProps) {
  // A changed absolute deadline starts a new receipt. Callback identities are not receipts.
  // The public API cannot distinguish two receipts with an identical deadline.
  return <UndoReceipt key={props.undoUntilMs} {...props} />;
}

function UndoReceipt({ undoUntilMs, onUndo, onExpire }: UndoProps) {
  const { lang, dir } = useLocale();
  const [phase, setPhase] = useState<"idle" | "busy" | "error" | "expired">("idle");
  const mounted = useRef(false);
  const pending = useRef(false);
  const expired = useRef(false);
  const expireCallback = useRef(onExpire);
  const errorId = useId();
  const isUndoing = phase === "busy";

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    expireCallback.current = onExpire;
  }, [onExpire]);

  const expire = useCallback(() => {
    if (!mounted.current || pending.current || expired.current) return;
    expired.current = true;
    setPhase("expired");
    expireCallback.current();
  }, []);

  useEffect(() => {
    if (isUndoing || expired.current) return;
    let timer: number | undefined;
    const checkDeadline = () => {
      const remaining = undoUntilMs - Date.now();
      if (remaining <= 0) expire();
      else timer = window.setTimeout(checkDeadline, remaining);
    };
    checkDeadline();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [expire, isUndoing, undoUntilMs]);

  const undo = async () => {
    if (!mounted.current || pending.current || expired.current) return;
    if (!isUndoActive(undoUntilMs, Date.now())) {
      expire();
      return;
    }
    pending.current = true;
    setPhase("busy");
    try {
      await onUndo();
      // Fulfillment is not a restore receipt: the caller may have received success:false.
      // Only the parent can remove this notice or navigate after restoration.
      if (mounted.current) setPhase("idle");
    } catch {
      if (mounted.current) setPhase("error");
    } finally {
      pending.current = false;
      if (mounted.current && !isUndoActive(undoUntilMs, Date.now())) expire();
    }
  };

  if (phase === "expired") return null;
  return (
    <output className="kb64-toast tp-glass" dir={dir} aria-live="polite" aria-atomic="true">
      <span className="kb64-toast__copy">
        <span>{kb64t(lang, "removed")}</span>
        {phase === "error" ? (
          <span id={errorId} className="kb64-toast__error">
            {kb64t(lang, "error")}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        className="kb64-toast__action"
        disabled={isUndoing}
        aria-busy={isUndoing}
        aria-describedby={phase === "error" ? errorId : undefined}
        onClick={() => {
          void undo();
        }}
      >
        {kb64t(lang, isUndoing ? "pending" : phase === "error" ? "retry" : "undo")}
      </button>
    </output>
  );
}

/** Fictional, interactive examples of the same notice mounted by NotesScreen. */
export function Kb64Gallery() {
  const { lang, setLang } = useLocale();
  const [deadline, setDeadline] = useState<number | null>(() => Date.now() + 30_000);
  const [attempts, setAttempts] = useState(0);
  return (
    <main className="kb64-gallery">
      <h1>{kb64t(lang, "galleryTitle")}</h1>
      <p>{kb64t(lang, "galleryNote")}</p>
      <div className="kb64-gallery__controls">
        <button type="button" onClick={() => setLang(lang === "en" ? "he" : "en")}>
          {kb64t(lang, "language")}
        </button>
        <button
          type="button"
          disabled={deadline !== null}
          onClick={() => {
            setAttempts(0);
            setDeadline(Date.now() + 30_000);
          }}
        >
          {kb64t(lang, "removeNote")}
        </button>
        <button type="button" disabled={deadline === null} onClick={() => setDeadline(Date.now())}>
          {kb64t(lang, "endWindow")}
        </button>
      </div>
      {deadline !== null ? (
        <UndoDeleteToast
          undoUntilMs={deadline}
          onUndo={async () => {
            if (attempts === 0) {
              setAttempts(1);
              throw new Error("Fictional connection interruption");
            }
            setDeadline(null);
          }}
          onExpire={() => setDeadline(null)}
        />
      ) : null}
    </main>
  );
}
