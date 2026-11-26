"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { formatCountdown } from "@/lib/habits-view";

/** The shared 5-minute Undo window (HARD_RULES §1). */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;

/**
 * UndoToast (tempo.js TP.toast): title, "You can undo for 4:59", Undo and Dismiss. Only the
 * title is announced; the countdown ticks quietly. It closes itself when the window ends.
 */
export function UndoToast({
  title,
  undoUntilMs,
  onUndo,
  onClose,
}: {
  title: string;
  undoUntilMs: number;
  onUndo: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const left = undoUntilMs - now;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left <= 0) closeRef.current();
  }, [left]);

  const undo = () => {
    if (busyRef.current || Date.now() >= undoUntilMs) return;
    busyRef.current = true;
    setBusy(true);
    void onUndo().finally(() => {
      busyRef.current = false;
      setBusy(false);
    });
  };

  // The caller wraps toasts in one `.tp-toast-region`, so several stack instead of overlapping.
  return (
    <div className="tp-toast tp-glass" data-component="UndoToast">
      <span className="tp-toast__icon">
        <TpIcon name="check" />
      </span>
      <span className="tp-toast__text">
        <output className="tp-toast__title">{title}</output>
        <span className="tp-toast__sub">
          {t("hr.toast.sub")} <span className="tp-num tp-mono">{formatCountdown(left)}</span>
        </span>
      </span>
      <button
        className="tp-btn tp-btn--secondary tp-btn--sm"
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={undo}
      >
        <TpIcon name="undo" size="sm" />
        <span>{t("hr.toast.undo")}</span>
      </button>
      <button
        className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon"
        type="button"
        aria-label={t("hr.toast.dismiss")}
        onClick={onClose}
      >
        <TpIcon name="x" size="sm" />
      </button>
    </div>
  );
}
