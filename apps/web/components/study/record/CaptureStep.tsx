"use client";

import { TpIcon } from "@/components/tempo/TpIcon";
import { formatClock } from "../../../../../packages/core/record";
import type { OffReason } from "./ConsentStep";
import type { Pin, RecordCopy } from "./recordFlow";
import type { LiveStatus } from "./useLiveWords";

export type TranscriptLine = { id: string; text: string };

/**
 * Step 2: recording (or typing). Elapsed time, the microphone level, the live transcript
 * (aria-live polite), pins with optional notes, Pause / Resume and Stop. When live words are off
 * the reason is said in words and the notes box is the way in; that path works on its own.
 */
export function CaptureStep({
  copy,
  mode,
  liveStatus,
  offReason,
  level,
  reducedMotion,
  minutesLeft,
  elapsedMs,
  paused,
  lines,
  interim,
  typed,
  onTyped,
  pins,
  onPin,
  onPinNote,
  onPinRemove,
  onPause,
  onResume,
  onStop,
}: {
  copy: RecordCopy;
  mode: "live" | "type";
  liveStatus: LiveStatus;
  offReason: OffReason;
  level: number;
  reducedMotion: boolean;
  minutesLeft?: number;
  elapsedMs: number;
  paused: boolean;
  lines: readonly TranscriptLine[];
  interim: string;
  typed: string;
  onTyped: (text: string) => void;
  pins: readonly Pin[];
  onPin: () => void;
  onPinNote: (id: string, note: string) => void;
  onPinRemove: (id: string) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const live = mode === "live" && liveStatus !== "off";
  const stateWord = paused
    ? copy("rec.state.paused")
    : live
      ? liveStatus === "connecting"
        ? copy("rec.state.connecting")
        : copy("rec.state.live")
      : copy("rec.state.typing");
  const bars = [0.5, 0.75, 1, 0.75, 0.5];
  return (
    <section className="tp-surface tp-rec-step" aria-label={stateWord} data-step="capture" data-state={paused ? "paused" : live ? liveStatus : "typing"}>
      <div className="tp-rec-status">
        <p className="tp-rec-status__state" aria-live="polite">
          <TpIcon name={paused ? "pause" : live ? "mic" : "edit"} size="sm" />
          <span>{stateWord}</span>
        </p>
        <p className="tp-rec-status__time">
          <span className="tp-sr-only">{copy("rec.elapsed")} </span>
          <span className="tp-num tp-mono" dir="ltr">
            {formatClock(elapsedMs)}
          </span>
        </p>
        {live ? (
          <div className="tp-level tp-rec-level" aria-hidden="true" data-component="AudioLevel" data-static={reducedMotion || undefined}>
            {bars.map((weight, i) => (
              <span
                key={i}
                className="tp-level__bar"
                style={{ ["--level" as string]: reducedMotion || paused ? 0.15 : Math.max(0.15, Math.min(1, level * weight)) }}
              />
            ))}
          </div>
        ) : null}
        {live ? (
          <p className="tp-help">
            <span>{paused ? copy("rec.mic.off") : copy("rec.mic.on")}</span>
            {minutesLeft !== undefined ? (
              <>
                {" · "}
                <span>{copy("rec.minutesLeft", { n: minutesLeft })}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {offReason ? (
        <output className="tp-notice" data-tone="info" data-component="Notice">
          <span className="tp-notice__icon">
            <TpIcon name="info" />
          </span>
          <span className="tp-notice__text">
            <span>{copy(`rec.off.${offReason}`)}</span>
          </span>
        </output>
      ) : null}

      {mode === "live" || lines.length > 0 ? (
        <div className="tp-field">
          <h2 className="tp-label" id="rec-transcript-h">
            {copy("rec.transcript")}
          </h2>
          <ol className="tp-call__transcript tp-rec-transcript" aria-live="polite" aria-labelledby="rec-transcript-h" data-component="LiveTranscript">
            {lines.length === 0 && !interim ? <li className="tp-help">{copy("rec.transcript.empty")}</li> : null}
            {lines.map((line) => (
              <li className="tp-call-line" key={line.id}>
                <span className="tp-call-line__text" dir="auto">
                  {line.text}
                </span>
              </li>
            ))}
            {interim ? (
              <li className="tp-call-line" data-live="true" aria-hidden="true">
                <span className="tp-call-line__text" dir="auto">
                  {interim}
                </span>
              </li>
            ) : null}
          </ol>
        </div>
      ) : null}

      {mode === "type" ? (
        <div className="tp-field">
          <label className="tp-label" htmlFor="rec-typed">
            {copy("rec.type.label")}
          </label>
          <textarea
            id="rec-typed"
            className="tp-textarea tp-rec-notes"
            dir="auto"
            rows={10}
            value={typed}
            placeholder={copy("rec.type.ph")}
            aria-describedby="rec-typed-help"
            onChange={(event) => onTyped(event.target.value)}
          />
          <p className="tp-help" id="rec-typed-help">
            {copy("rec.type.help")}
          </p>
        </div>
      ) : null}

      <div className="tp-rec-pins">
        <div className="tp-section__head">
          <h2 className="tp-label" id="rec-pins-h">
            {copy("rec.pins")}
          </h2>
          <span className="tp-section__count tp-num">{pins.length}</span>
        </div>
        <div className="tp-form__actions">
          <button type="button" className="tp-btn tp-btn--secondary" onClick={onPin} aria-keyshortcuts="P">
            <TpIcon name="pin" size="sm" />
            <span>{copy("rec.pin")}</span>
          </button>
          <span className="tp-help">
            {copy("rec.pin.key")} <kbd className="tp-kbd">P</kbd>
          </span>
        </div>
        {pins.length === 0 ? (
          <p className="tp-help">{copy("rec.pins.empty")}</p>
        ) : (
          <ol className="tp-rec-pinlist" aria-labelledby="rec-pins-h">
            {pins.map((pin) => {
              const time = formatClock(pin.atMs);
              return (
                <li className="tp-rec-pin" key={pin.id} data-pin={pin.id}>
                  <span className="tp-num tp-mono tp-rec-pin__time" dir="ltr">
                    {time}
                  </span>
                  <label className="tp-sr-only" htmlFor={`rec-pin-${pin.id}`}>
                    {copy("rec.pin.note", { n: time })}
                  </label>
                  <input
                    id={`rec-pin-${pin.id}`}
                    className="tp-input"
                    dir="auto"
                    value={pin.note}
                    placeholder={copy("rec.pin.notePh")}
                    onChange={(event) => onPinNote(pin.id, event.target.value)}
                  />
                  <button
                    type="button"
                    className="tp-btn tp-btn--ghost tp-btn--icon"
                    aria-label={copy("rec.pin.remove", { n: time })}
                    onClick={() => onPinRemove(pin.id)}
                  >
                    <TpIcon name="x" size="sm" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="tp-form__actions tp-rec-dock">
        {paused ? (
          <button type="button" className="tp-btn tp-btn--secondary" onClick={onResume}>
            <TpIcon name="play" size="sm" />
            <span>{copy("rec.resume")}</span>
          </button>
        ) : (
          <button type="button" className="tp-btn tp-btn--secondary" onClick={onPause}>
            <TpIcon name="pause" size="sm" />
            <span>{copy("rec.pause")}</span>
          </button>
        )}
        <button type="button" className="tp-btn tp-btn--primary" onClick={onStop}>
          <TpIcon name="check" size="sm" />
          <span>{copy("rec.stop")}</span>
        </button>
      </div>
    </section>
  );
}
