"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";

type TodayQuickAddProps = {
  /** Any timestamp inside the current local calendar day; used so the task shows in Today immediately. */
  dueAt: number;
};

/**
 * Quick add for today (Field + Button, DESIGN.md §9): one line, Enter adds, Escape clears. An empty
 * press or a failed save says so under the field, linked to it for screen readers.
 */
export function TodayQuickAdd({ dueAt }: TodayQuickAddProps) {
  const { t } = useLocale();
  const createQuick = useMutation(api.tasks.createQuick);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hint, setHint] = useState<"" | "empty" | "error">("");
  const inputId = "today-quick-add";

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setHint("empty");
      return;
    }
    setIsSubmitting(true);
    setHint("");
    try {
      await createQuick({ title: trimmed, dueAt });
      setTitle("");
    } catch {
      setHint("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className="tp-surface tqa"
      data-component="TodayQuickAdd"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="tp-field" data-component="Field">
        <label htmlFor={inputId} className="tp-label">
          {t("tqa.label")}
        </label>
        <div className="tqa__row">
          <input
            id={inputId}
            className="tp-input"
            type="text"
            dir="auto"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (hint) setHint("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setTitle("");
                setHint("");
              }
            }}
            disabled={isSubmitting}
            placeholder={t("tqa.ph")}
            aria-invalid={hint === "empty" ? true : undefined}
            aria-describedby={`${inputId}-help`}
          />
          <button type="submit" className="tp-btn tp-btn--secondary" disabled={isSubmitting}>
            <TpIcon name="plus" size="sm" />
            <span>{isSubmitting ? t("tqa.adding") : t("tqa.add")}</span>
          </button>
        </div>
        {hint ? (
          <p className="tp-error-text" id={`${inputId}-help`} role="alert">
            <TpIcon name="alert" size="sm" />
            <span>{hint === "empty" ? t("tqa.empty") : t("tqa.error")}</span>
          </p>
        ) : (
          <p className="tp-help" id={`${inputId}-help`}>
            {t("tqa.help")}
          </p>
        )}
      </div>
    </form>
  );
}
