"use client";

import { fillNodes, fillText } from "@tempo/ui";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, memo, type ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { PageMatch, RecapLang, RecapSentence, TimelineEntry } from "../../../../../packages/core/recap";
import { formatClock } from "../../../../../packages/core/record";
import type { StudyT } from "../labels";
import {
  BACK_SECONDS,
  FORWARD_SECONDS,
  jumpTo,
  type ListenMode,
  listenHref,
  type PlayerAction,
  type PlayerState,
  RATES,
  type Rate,
} from "./player";
import type { SpeechStatus } from "./useReadAloud";

/**
 * S16 AudioRecapPlayer, drawn from props (kitchen T4). AudioRecapPlayer.tsx owns the state and
 * the speech engine; tests draw this directly. Play is the screen's one primary, a toggle named
 * "Play" whether pressed or not (aria-pressed says it is reading). The transcript
 * is a list of buttons: the current sentence has aria-current and a "Now" word (never colour
 * alone), and choosing one plays from there. Works with no voice at all: the transcript and
 * "Ask a question" stay, and the player says plainly why it can't play.
 */

export type AudioRecapPlayerViewProps = {
  noteId: string;
  title: string;
  mode: ListenMode;
  lang: RecapLang;
  sentences: readonly RecapSentence[];
  timeline: readonly TimelineEntry[];
  state: PlayerState;
  status: SpeechStatus;
  /** Seconds into the reading, by the estimate. */
  elapsed: number;
  onAction: (action: PlayerAction) => void;
  question: string;
  onQuestion: (value: string) => void;
  /** null before a question is asked. */
  answers: readonly PageMatch[] | null;
  onAsk: () => void;
  /** Base for element ids; unique per player on the page. */
  idBase: string;
};

/** Arrow keys move through the speed options; Right goes forward in LTR and back in RTL. */
export function rateForKey(key: string, current: Rate, rtl: boolean): Rate | null {
  const forward = key === "ArrowDown" || key === (rtl ? "ArrowLeft" : "ArrowRight");
  const back = key === "ArrowUp" || key === (rtl ? "ArrowRight" : "ArrowLeft");
  if (!forward && !back) return null;
  const at = RATES.indexOf(current);
  return RATES[(at + (forward ? 1 : -1) + RATES.length) % RATES.length] as Rate;
}

/** "{elapsed} of {total}" with each time in .tp-num, kept left to right inside RTL text. */
function clockLine(template: string, elapsed: number, total: number): ReactNode {
  const parts = template.split(/(\{elapsed\}|\{total\})/);
  return parts.map((part, index) => {
    if (part === "{elapsed}" || part === "{total}") {
      const seconds = part === "{elapsed}" ? elapsed : total;
      return (
        <span className="tp-num" dir="ltr" key={index}>
          {formatClock(seconds * 1000)}
        </span>
      );
    }
    return part;
  });
}

function noVoiceText(t: StudyT, status: SpeechStatus, lang: RecapLang): string {
  if (status === "none") return t("st.ls.noSpeech");
  return lang === "he" ? t("st.ls.noVoice.he") : t("st.ls.noVoice.en");
}

export function AudioRecapPlayerView(props: AudioRecapPlayerViewProps) {
  const { t, dir } = useLocale();
  const { noteId, title, mode, lang, sentences, timeline, state, status, elapsed, onAction, idBase } = props;
  const total = timeline.at(-1)?.end ?? 0;
  const canPlay = status === "ready";
  const showControls = status === "ready" || status === "checking";
  const speedId = `${idBase}-speed`;

  const onRateKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = rateForKey(event.key, state.rate, dir === "rtl");
    if (!next) return;
    event.preventDefault();
    onAction({ type: "rate", rate: next });
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() =>
      group?.querySelector<HTMLButtonElement>(`[data-rate="${next}"]`)?.focus()
    );
  };

  return (
    <div
      className="tp-page tp-page--narrow tp-study-stack tp-recap"
      data-component="PageLayout"
      data-screen="StudyListen"
      data-mode={mode}
    >
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <p className="tp-study-kind">
            <TpIcon name="volume" size="sm" />
            <span>{mode === "full" ? t("st.ls.kind.full") : t("st.ls.kind.recap")}</span>
          </p>
          <h1 className="tp-pagehead__title" dir="auto">
            {title}
          </h1>
        </div>
        <div className="tp-pagehead__actions">
          <Link className="tp-btn tp-btn--ghost" href={listenHref(noteId, mode === "full" ? "recap" : "full")}>
            <TpIcon name={mode === "full" ? "list" : "page"} size="sm" />
            <span>{mode === "full" ? t("st.ls.hearRecap") : t("st.ls.hearFull")}</span>
          </Link>
          <Link className="tp-btn tp-btn--ghost" href={`/notes/${encodeURIComponent(noteId)}`}>
            <TpIcon name="page" size="sm" />
            <span>{t("st.set.openPage")}</span>
          </Link>
        </div>
      </header>

      <section className="tp-artifact tp-recap__player" data-component="AudioRecapPlayer" aria-label={t("st.ls.controls")}>
        <div className="tp-artifact__body">
          {showControls ? (
            <>
              <div className="tp-recap__controls">
                <button
                  type="button"
                  className="tp-btn tp-btn--ghost"
                  data-action="recap-back"
                  aria-label={fillText(t("st.ls.backLabel"), { seconds: BACK_SECONDS })}
                  disabled={!canPlay || state.index === 0}
                  onClick={() => onAction({ type: "skip", seconds: -BACK_SECONDS, timeline })}
                >
                  <TpIcon name="undo" size="sm" flip />
                  <span>{fillNodes(t("st.ls.back"), { seconds: BACK_SECONDS })}</span>
                </button>
                {/* A toggle keeps one name: "Play", pressed while it reads; the icon shows pause. */}
                <button
                  type="button"
                  className="tp-btn tp-btn--primary tp-recap__play"
                  data-action="recap-play"
                  aria-pressed={state.playing}
                  disabled={!canPlay}
                  onClick={() => onAction({ type: state.playing ? "pause" : "play" })}
                >
                  <TpIcon name={state.playing ? "pause" : "play"} size="sm" />
                  <span>{t("st.ls.play")}</span>
                </button>
                <button
                  type="button"
                  className="tp-btn tp-btn--ghost"
                  data-action="recap-forward"
                  aria-label={fillText(t("st.ls.forwardLabel"), { seconds: FORWARD_SECONDS })}
                  disabled={!canPlay || state.index >= sentences.length - 1}
                  onClick={() => onAction({ type: "skip", seconds: FORWARD_SECONDS, timeline })}
                >
                  <span>{fillNodes(t("st.ls.forward"), { seconds: FORWARD_SECONDS })}</span>
                  <TpIcon name="arrow" size="sm" flip />
                </button>
              </div>
              <p className="tp-recap__time">
                {clockLine(t("st.ls.time"), elapsed, total)}{" "}
                <span className="tp-recap__estimate">{t("st.ls.estimate")}</span>
              </p>
              <div className="tp-recap__speed">
                <span className="tp-label" id={speedId}>
                  {t("st.ls.speed")}
                </span>
                <div className="tp-segmented" role="radiogroup" aria-labelledby={speedId} data-component="Segmented">
                  {RATES.map((rate) => (
                    // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
                    <button
                      key={rate}
                      type="button"
                      role="radio"
                      className="tp-seg__opt"
                      data-rate={rate}
                      aria-checked={state.rate === rate}
                      tabIndex={state.rate === rate ? 0 : -1}
                      onClick={() => onAction({ type: "rate", rate })}
                      onKeyDown={onRateKey}
                    >
                      {fillNodes(t("st.ls.rate"), { rate })}
                    </button>
                  ))}
                </div>
              </div>
              <p className="tp-small tp-muted" aria-live="polite">
                {status === "checking"
                  ? t("st.ls.checking")
                  : state.speechError
                    ? t("st.ls.speechError")
                    : state.ended
                      ? t("st.ls.ended")
                      : ""}
              </p>
            </>
          ) : (
            <p className="tp-notice" data-tone="info" data-component="Notice">
              <span className="tp-notice__icon">
                <TpIcon name="info" size="sm" />
              </span>
              <span className="tp-notice__text">{noVoiceText(t, status, lang)}</span>
            </p>
          )}
        </div>
      </section>

      <Transcript sentences={sentences} index={state.index} canPlay={canPlay} onAction={onAction} idBase={idBase} />

      <AskPanel {...props} t={t} />
    </div>
  );
}

type TranscriptProps = {
  sentences: readonly RecapSentence[];
  index: number;
  canPlay: boolean;
  onAction: (action: PlayerAction) => void;
  idBase: string;
};

/**
 * The transcript, memoized on its own props: the player's clock ticks every 250 ms while it reads,
 * and that should redraw the time, not every sentence button (thousands on a full reading).
 */
const Transcript = memo(function Transcript({ sentences, index: at, canPlay, onAction, idBase }: TranscriptProps) {
  const { t } = useLocale();
  return (
    <section className="tp-recap__transcript" aria-labelledby={`${idBase}-transcript`}>
      <h2 className="tp-recap__heading" id={`${idBase}-transcript`}>
        {t("st.ls.transcript")}
      </h2>
      <p className="tp-small tp-muted">{t("st.ls.transcriptHint")}</p>
      <ol className="tp-recap__lines">
        {sentences.map((sentence, index) => {
          const current = index === at;
          return (
            <li key={index} className="tp-recap__item" data-kind={sentence.kind}>
              <button
                type="button"
                className="tp-recap__line"
                data-action="recap-jump"
                aria-current={current ? "true" : undefined}
                onClick={() => onAction(jumpTo(index, canPlay))}
              >
                {current ? <span className="tp-recap__now">{t("st.ls.now")}</span> : null}
                <span dir="auto">{sentence.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
});

function AskPanel({
  question,
  onQuestion,
  answers,
  onAsk,
  idBase,
  t,
}: AudioRecapPlayerViewProps & { t: StudyT }) {
  const inputId = `${idBase}-ask`;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onAsk();
  };
  return (
    <section className="tp-recap__ask" data-component="RecapAsk" aria-labelledby={`${inputId}-title`}>
      <form className="tp-recap__askform" onSubmit={submit}>
        <div className="tp-field">
          <label className="tp-recap__heading" id={`${inputId}-title`} htmlFor={inputId}>
            {t("st.ls.ask")}
          </label>
          <input
            id={inputId}
            className="tp-input"
            dir="auto"
            value={question}
            aria-describedby={`${inputId}-help`}
            onChange={(event) => onQuestion(event.currentTarget.value)}
          />
          <p className="tp-help" id={`${inputId}-help`}>
            {t("st.ls.askHint")}
          </p>
        </div>
        <button type="submit" className="tp-btn tp-btn--secondary" data-action="recap-ask" disabled={!question.trim()}>
          <TpIcon name="search" size="sm" />
          <span>{t("st.ls.askButton")}</span>
        </button>
      </form>
      <div aria-live="polite">
        {answers === null ? null : answers.length > 0 ? (
          <div className="tp-recap__answers">
            <p className="tp-recap__from">{t("st.ls.fromPage")}</p>
            <ul className="tp-recap__quotes">
              {answers.map((match) => (
                <li key={match.index} dir="auto">
                  {match.text}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="tp-small">{t("st.ls.notFound")}</p>
        )}
        {answers === null ? null : (
          <Link className="tp-btn tp-btn--ghost" href="/coach" data-action="recap-coach">
            <TpIcon name="coach" size="sm" />
            <span>{t("st.ls.askCoach")}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
