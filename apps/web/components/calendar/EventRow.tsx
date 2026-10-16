"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import {
  fromDateInputValue,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/calendar/date-math";
import type { MessageKey } from "@/lib/i18n";
import { intlLocale } from "@/lib/you/screenState";

export type EventRowEvent = {
  id: string;
  title: string;
  startsAtMs: number;
};

export type EventRowActions = {
  onUpdate: (event: EventRowEvent, patch: { title: string; startsAtMs: number }) => Promise<void>;
  onDelete: (event: EventRowEvent) => Promise<void>;
};

const dateFormat: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
};

/**
 * Copy for a failed save. A raw error is server or parser text in English, so the row names the
 * likely cause from what the form holds, in the app language.
 */
export function saveErrorKey(title: string, dateValue: string): MessageKey {
  if (!parseDateInputValue(dateValue)) return "cal.err.date";
  if (!title.trim()) return "cal.err.needTitle";
  return "cal.row.err";
}

export function EventRow({
  event,
  actions,
  initialEditing = false,
}: {
  event: EventRowEvent;
  actions?: EventRowActions;
  /** Opens the row in its edit form; the tests render that state without clicking Edit. */
  initialEditing?: boolean;
}) {
  const { lang, t } = useLocale();
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [title, setTitle] = useState(event.title);
  const [dateValue, setDateValue] = useState(() => toDateInputValue(new Date(event.startsAtMs)));
  // A key, not text, so a message already on screen follows a language switch.
  const [error, setError] = useState<MessageKey | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function run(action: () => Promise<void>, failKey: MessageKey, onDone?: () => void) {
    setIsBusy(true);
    try {
      await action();
      setError(null);
      onDone?.();
    } catch {
      setError(failKey);
    } finally {
      setIsBusy(false);
    }
  }

  function handleSave(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault();
    if (!actions) return;
    const { onUpdate } = actions;
    void run(
      async () => {
        const startsAtMs = fromDateInputValue(dateValue).getTime();
        await onUpdate(event, { title, startsAtMs });
      },
      saveErrorKey(title, dateValue),
      () => setIsEditing(false)
    );
  }

  return (
    <li className="tp-list-row cal-event" data-component="EventRow" data-editing={isEditing}>
      {isEditing ? (
        <form className="cal-event__edit" onSubmit={handleSave}>
          <label className="tp-field cal-event__title-field">
            <span className="tp-label">{t("cal.row.title")}</span>
            <input
              className="tp-input"
              dir="auto"
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </label>
          <label className="tp-field">
            <span className="tp-label">{t("cal.row.date")}</span>
            <input
              className="tp-input tp-num"
              onChange={(e) => setDateValue(e.target.value)}
              type="date"
              value={dateValue}
            />
          </label>
          <button className="tp-btn tp-btn--primary tp-btn--sm" disabled={isBusy} type="submit">
            {t("cal.row.save")}
          </button>
          <button
            className="tp-btn tp-btn--ghost tp-btn--sm"
            onClick={() => {
              setIsEditing(false);
              setTitle(event.title);
              setError(null);
            }}
            type="button"
          >
            {t("cal.row.cancel")}
          </button>
        </form>
      ) : (
        <>
          <span className="tp-list-row__icon">
            <TpIcon name="calendar-grid" size="sm" />
          </span>
          <span className="tp-list-row__body">
            <span className="tp-list-row__title" dir="auto">
              {event.title}
            </span>
            <span className="tp-list-row__meta tp-num">
              {new Date(event.startsAtMs).toLocaleDateString(intlLocale(lang), dateFormat)}
            </span>
          </span>
          {actions ? (
            <span className="tp-list-row__end">
              <button
                aria-label={t("cal.row.editName").replace("{title}", event.title)}
                className="tp-btn tp-btn--ghost tp-btn--sm"
                onClick={() => {
                  setTitle(event.title);
                  setDateValue(toDateInputValue(new Date(event.startsAtMs)));
                  setIsEditing(true);
                }}
                type="button"
              >
                {t("cal.row.edit")}
              </button>
              <button
                aria-label={t("cal.row.deleteName").replace("{title}", event.title)}
                className="tp-btn tp-btn--danger-ghost tp-btn--sm"
                disabled={isBusy}
                onClick={() => void run(() => actions.onDelete(event), "cal.row.err")}
                type="button"
              >
                {t("cal.row.delete")}
              </button>
            </span>
          ) : null}
        </>
      )}
      {error ? (
        <p className="tp-error-text cal-event__error" role="alert">
          {t(error)}
        </p>
      ) : null}
    </li>
  );
}

export type UndoToastState = { eventId: string; title: string; undoUntilMs: number };

/** "Event removed. Undo" toast; disappears once `undoUntilMs` passes. */
export function UndoToast({
  toast,
  onUndo,
  onExpire,
}: {
  toast: UndoToastState;
  onUndo: () => Promise<void>;
  onExpire: () => void;
}) {
  const { t } = useLocale();
  const [error, setError] = useState<MessageKey | null>(null);
  // Ignore further clicks while a restore is in flight: a second restore would hit the already
  // restored row and report a false "can no longer be restored".
  const [isUndoing, setIsUndoing] = useState(false);
  const undoingRef = useRef(false);
  const { undoUntilMs } = toast;

  useEffect(() => {
    const remaining = undoUntilMs - Date.now();
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const timer = setTimeout(onExpire, remaining);
    return () => clearTimeout(timer);
  }, [undoUntilMs, onExpire]);

  return (
    // The region positions the toast; the toast itself only animates.
    <div className="tp-toast-region">
      <output className="tp-toast tp-glass">
        <span className="tp-toast__text">
          <span className="tp-toast__title">{t("cal.row.removed")}</span>
        </span>
        <button
          className="tp-btn tp-btn--secondary tp-btn--sm"
          disabled={isUndoing}
          aria-busy={isUndoing}
          onClick={() => {
            if (undoingRef.current) return;
            undoingRef.current = true;
            setIsUndoing(true);
            setError(null);
            onUndo()
              .catch((err: unknown) =>
                // CalendarViews throws its own "can no longer be restored" copy; any other error
                // is raw server text in English.
                setError(
                  err instanceof Error && err.message === t("cal.err.undoGone")
                    ? "cal.err.undoGone"
                    : "cal.row.undoErr"
                )
              )
              .finally(() => {
                undoingRef.current = false;
                setIsUndoing(false);
              });
          }}
          type="button"
        >
          {t("cal.row.undo")}
        </button>
        {error ? (
          <span className="tp-error-text" role="alert">
            {t(error)}
          </span>
        ) : null}
      </output>
    </div>
  );
}
