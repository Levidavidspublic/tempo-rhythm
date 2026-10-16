"use client";

/**
 * The form and the live preview of "Plan back from a deadline" (S3). Presentational: the screen
 * (PlanPathScreen) owns the state and the save. Copy: lib/i18n-groups/plan.ts.
 */
import type { ReactNode, RefObject } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { LocalDate, Weekday } from "../../../../../packages/core/plan/calendar-math";
import {
  formatClock,
  longDate,
  type PlanLang,
  pt,
  ptNodes,
  shortDate,
  weekdayName,
  weekStartFor,
} from "../planCopy";
import {
  groupByWeek,
  hoursAndMinutes,
  type PlanFormValues,
  type PreviewState,
  type TimedSession,
  type WaysOut,
} from "./planForm";

export type PlanFormProps = {
  values: PlanFormValues;
  onChange: (patch: Partial<PlanFormValues>) => void;
  lang: PlanLang;
  titleError?: boolean;
  topicsRef?: RefObject<HTMLTextAreaElement | null>;
  idPrefix?: string;
};

export function PlanForm({
  values,
  onChange,
  lang,
  titleError = false,
  topicsRef,
  idPrefix = "pp",
}: PlanFormProps) {
  const first = weekStartFor(lang);
  const days = Array.from({ length: 7 }, (_, i) => ((first + i) % 7) as Weekday);
  const toggleDay = (day: Weekday) =>
    onChange({
      daysOff: values.daysOff.includes(day)
        ? values.daysOff.filter((d) => d !== day)
        : [...values.daysOff, day].sort((a, b) => a - b),
    });
  const number = (raw: string) => (raw.trim() === "" ? Number.NaN : Number(raw));

  return (
    <form
      className="tp-surface tp-plan__form"
      data-component="Form"
      onSubmit={(event) => event.preventDefault()}
      aria-labelledby={`${idPrefix}-form-h`}
    >
      <h2 className="tp-sr-only" id={`${idPrefix}-form-h`}>
        {pt(lang, "pp.title")}
      </h2>
      <div className="tp-plan__row">
        <label className="tp-field">
          <span className="tp-label">{pt(lang, "pp.f.what")}</span>
          <input
            className="tp-input"
            dir="auto"
            name="title"
            placeholder={pt(lang, "pp.f.whatPh")}
            value={values.title}
            aria-invalid={titleError || undefined}
            aria-describedby={titleError ? `${idPrefix}-title-err` : undefined}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          {titleError ? (
            <span className="tp-error-text" id={`${idPrefix}-title-err`}>
              {pt(lang, "pp.err.title")}
            </span>
          ) : null}
        </label>
        <label className="tp-field">
          <span className="tp-label">{pt(lang, "pp.f.date")}</span>
          <input
            className="tp-input tp-num"
            name="deadline"
            type="date"
            value={values.deadline}
            onChange={(event) => onChange({ deadline: event.target.value })}
          />
        </label>
      </div>
      <label className="tp-field">
        <span className="tp-label">{pt(lang, "pp.f.topics")}</span>
        <textarea
          className="tp-textarea"
          dir="auto"
          name="topics"
          ref={topicsRef}
          rows={5}
          placeholder={pt(lang, "pp.f.topicsPh")}
          value={values.topicsText}
          aria-describedby={`${idPrefix}-topics-hint`}
          onChange={(event) => onChange({ topicsText: event.target.value })}
        />
        <span className="tp-help" id={`${idPrefix}-topics-hint`}>
          {pt(lang, "pp.f.topicsHint")}
        </span>
      </label>
      <div className="tp-plan__row">
        <label className="tp-field">
          <span className="tp-label">{pt(lang, "pp.f.perDay")}</span>
          <input
            className="tp-input tp-num"
            name="minutesPerDay"
            type="number"
            inputMode="numeric"
            min={5}
            step={5}
            value={Number.isNaN(values.minutesPerDay) ? "" : values.minutesPerDay}
            onChange={(event) => onChange({ minutesPerDay: number(event.target.value) })}
          />
        </label>
        <label className="tp-field">
          <span className="tp-label">{pt(lang, "pp.f.session")}</span>
          <input
            className="tp-input tp-num"
            name="sessionMinutes"
            type="number"
            inputMode="numeric"
            min={5}
            step={5}
            value={Number.isNaN(values.sessionMinutes) ? "" : values.sessionMinutes}
            onChange={(event) => onChange({ sessionMinutes: number(event.target.value) })}
          />
        </label>
        <label className="tp-field">
          <span className="tp-label">{pt(lang, "pp.f.start")}</span>
          <input
            className="tp-input tp-num tp-mono"
            name="startTime"
            type="time"
            dir="ltr"
            value={values.startTime}
            onChange={(event) => onChange({ startTime: event.target.value })}
          />
        </label>
      </div>
      <fieldset className="tp-plan__days">
        <legend className="tp-label">{pt(lang, "pp.f.daysOff")}</legend>
        {days.map((day) => (
          <label className="tp-choice" key={day}>
            <input
              className="tp-checkbox"
              type="checkbox"
              name="daysOff"
              value={day}
              checked={values.daysOff.includes(day)}
              onChange={() => toggleDay(day)}
            />
            <span className="tp-choice__text">{weekdayName(lang, day, "long")}</span>
          </label>
        ))}
      </fieldset>
    </form>
  );
}

export type PlanPreviewProps = {
  state: PreviewState;
  lang: PlanLang;
  /** Only needed when the plan is short. */
  ways?: WaysOut | null;
  onUseMinutes?: (minutes: number) => void;
  onUseDate?: (date: LocalDate) => void;
  onEditTopics?: () => void;
  idPrefix?: string;
  /**
   * Draws the sessions in place of the week list (S9: the GuidedPlanCard, which carries its own
   * summary). The "doesn't fit" notice with its three ways out stays above it either way.
   */
  renderSessions?: (sessions: TimedSession[]) => ReactNode;
};

export function PlanPreview({
  state,
  lang,
  ways = null,
  onUseMinutes,
  onUseDate,
  onEditTopics,
  idPrefix = "pp",
  renderSessions,
}: PlanPreviewProps) {
  const headingId = `${idPrefix}-preview-h`;
  return (
    <section
      className="tp-section tp-plan__preview"
      aria-labelledby={headingId}
      data-component="PlanPreview"
    >
      <h2 className="tp-section__title" id={headingId}>
        {pt(lang, "pp.preview.h")}
      </h2>
      {state.status === "empty" ? (
        <p className="tp-muted">{pt(lang, "pp.preview.empty")}</p>
      ) : state.status === "error" ? (
        <p className="tp-error-text" role="alert">
          <TpIcon name="info" size="sm" />
          <span>{pt(lang, state.message)}</span>
        </p>
      ) : (
        <>
          {renderSessions ? null : (
            <p data-testid="plan-totals" aria-live="polite">
              {ptNodes(lang, "pp.totals", {
                sessions: state.sessions.length,
                days: state.result.daysUsed,
                ...hoursAndMinutes(state.result.totalMinutes),
              })}
            </p>
          )}
          {state.result.shortBy > 0 ? (
            <div
              className="tp-notice"
              data-tone="caution"
              data-component="Notice"
              data-testid="plan-short"
            >
              <span className="tp-notice__icon">
                <TpIcon name="info" size="sm" />
              </span>
              <div className="tp-notice__text">
                <p className="tp-notice__title">
                  {ptNodes(lang, "pp.short.h", { n: state.result.shortBy })}
                </p>
                <p>{pt(lang, "pp.short.b")}</p>
                <ul className="tp-plan__ways">
                  <li className="tp-plan__way" data-way="topics">
                    <strong>{pt(lang, "pp.short.topics")}</strong>
                    <span>{pt(lang, "pp.short.topicsB")}</span>
                    {onEditTopics ? (
                      <button
                        className="tp-btn tp-btn--secondary tp-btn--sm"
                        type="button"
                        onClick={onEditTopics}
                      >
                        {pt(lang, "pp.short.topicsBtn")}
                      </button>
                    ) : null}
                  </li>
                  <li className="tp-plan__way" data-way="longer">
                    <strong>{pt(lang, "pp.short.longer")}</strong>
                    {ways?.longerMinutes ? (
                      <>
                        <span>{ptNodes(lang, "pp.short.longerB", { n: ways.longerMinutes })}</span>
                        {onUseMinutes ? (
                          <button
                            className="tp-btn tp-btn--secondary tp-btn--sm"
                            type="button"
                            onClick={() => onUseMinutes(ways.longerMinutes as number)}
                          >
                            {ptNodes(lang, "pp.short.longerBtn", { n: ways.longerMinutes })}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span>{pt(lang, "pp.short.longerNone")}</span>
                    )}
                  </li>
                  <li className="tp-plan__way" data-way="later">
                    <strong>{pt(lang, "pp.short.later")}</strong>
                    {ways?.laterDate ? (
                      <>
                        <span>
                          {pt(lang, "pp.short.laterB", { date: longDate(lang, ways.laterDate) })}
                        </span>
                        {onUseDate ? (
                          <button
                            className="tp-btn tp-btn--secondary tp-btn--sm"
                            type="button"
                            onClick={() => onUseDate(ways.laterDate as LocalDate)}
                          >
                            {pt(lang, "pp.short.laterBtn", {
                              date: shortDate(lang, ways.laterDate),
                            })}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span>{pt(lang, "pp.short.laterNone")}</span>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
          {renderSessions ? renderSessions(state.sessions) : null}
          {renderSessions ? null : groupByWeek(state.sessions, weekStartFor(lang)).map((week) => (
            <section className="tp-plan__week" key={week.weekStart} data-week={week.weekStart}>
              <h3 className="tp-plan__week-title">
                {pt(lang, "pp.week", { date: shortDate(lang, week.weekStart) })}
              </h3>
              {week.days.map((day) => (
                <div className="tp-plan__day" key={day.date}>
                  <h4 className="tp-plan__day-title">{longDate(lang, day.date)}</h4>
                  <ul className="tp-plan__sessions">
                    {day.sessions.map((session, index) => (
                      <li
                        className="tp-plan__session"
                        key={`${session.date}-${index}`}
                        data-kind={session.kind}
                      >
                        <span className="tp-num tp-mono tp-ltr">
                          {formatClock(session.startMinute)}
                        </span>
                        <span dir="auto">{session.label}</span>
                        <span className="tp-chip tp-chip--flex">
                          {ptNodes(lang, "pp.min", { n: session.minutes })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
