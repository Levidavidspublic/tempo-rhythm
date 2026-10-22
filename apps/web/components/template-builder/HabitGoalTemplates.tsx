"use client";

import { useId, useRef, useState } from "react";
import { ReadView } from "@/components/editor/ReadView";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  HABIT_GOAL_OUTLINES,
  type HabitGoalDraft,
  type HabitGoalOutline,
  habitGoalDraft,
  habitGoalText,
} from "@/lib/i18n-groups/habit-goal-templates";

/** Preview is local; BuilderForm checks draft ownership again at the Choose event. */
export function HabitGoalTemplates({
  blocked,
  onChoose,
}: {
  blocked: "locked" | "pending" | null;
  onChoose: (draft: HabitGoalDraft) => boolean;
}) {
  const { lang, t } = useLocale();
  const id = useId();
  const [preview, setPreview] = useState<HabitGoalOutline | null>(null);
  const triggers = useRef<Partial<Record<HabitGoalOutline, HTMLButtonElement | null>>>({});
  const text = (key: Parameters<typeof habitGoalText>[1]) => habitGoalText(lang, key);

  const close = (outline: HabitGoalOutline) => {
    setPreview(null);
    triggers.current[outline]?.focus();
  };

  return (
    <section className="tp-section" aria-labelledby={`${id}-heading`} data-component="HabitGoalTemplates">
      <h2 className="tp-section__title" id={`${id}-heading`}>{text("title")}</h2>
      <p className="tp-muted tp-small">{text("hint")}</p>
      {blocked ? <output className="tp-help" id={`${id}-reason`}>{text(blocked)}</output> : null}
      <div className="tp-cards">
        {HABIT_GOAL_OUTLINES.map((outline) => {
          const draft = habitGoalDraft(lang, outline);
          const open = preview === outline;
          return (
            <article className="tp-card bld-flow" key={outline} aria-labelledby={`${id}-${outline}-name`}>
              <h3 className="tp-card__title" id={`${id}-${outline}-name`}>{draft.name}</h3>
              <p className="tp-small tp-muted">{draft.description}</p>
              <div className="tpl-card__actions">
                <button
                  className="tp-btn tp-btn--ghost"
                  type="button"
                  ref={(node) => { triggers.current[outline] = node; }}
                  aria-label={`${text("preview")}: ${draft.name}`}
                  aria-expanded={open}
                  aria-controls={`${id}-${outline}-preview`}
                  onClick={() => setPreview(open ? null : outline)}
                >
                  {text("preview")}
                </button>
                <button
                  className="tp-btn tp-btn--secondary"
                  type="button"
                  disabled={blocked !== null}
                  aria-label={`${text("choose")}: ${draft.name}`}
                  aria-describedby={blocked ? `${id}-reason` : undefined}
                  onClick={() => { if (onChoose(draft)) setPreview(null); }}
                >
                  {text("choose")}
                </button>
              </div>
              {open ? (
                <section id={`${id}-${outline}-preview`} className="bld-flow" aria-label={`${text("preview")}: ${draft.name}`}>
                  <ReadView
                    body={draft.body}
                    labels={{ minutes: t("editor.minutes"), brokenBlock: t("editor.broken"), template: t("editor.template") }}
                  />
                  <button className="tp-btn tp-btn--ghost" type="button" onClick={() => close(outline)}>
                    {text("cancel")}
                  </button>
                </section>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
