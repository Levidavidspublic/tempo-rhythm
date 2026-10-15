"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { type KeyboardEvent, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { Lang } from "@/lib/i18n";
import { callView, minutesLow } from "@/lib/voice-call";
import type { VoiceSessionState } from "./voiceSession";

export type CallLine = { id: string; who: "you" | "coach"; text: string; live?: boolean; notSent?: boolean };

type Props = {
  open: boolean;
  /** The inactive session reducer's state (voiceSession.ts); nothing here opens audio. */
  session: VoiceSessionState;
  connecting: boolean;
  ended: boolean;
  online: boolean;
  micOn: boolean;
  lines: readonly CallLine[];
  /** The call's language (the page language stays as it is). */
  callLang: Lang;
  minutesLeft?: number;
  /** Something the coach did in the call, with a 5-minute Undo. */
  action?: { text: string; onUndo: () => void };
  onMicToggle: () => void;
  onInterrupt: () => void;
  onEnd: () => void;
  onClose: () => void;
  onRetry: () => void;
  onCallLang?: (lang: Lang) => void;
  onReadAloud?: (line: CallLine) => void;
  onPushStart?: () => void;
  onPushEnd?: () => void;
};

/**
 * VoiceCall (docs/design/v3/screens/web/voice-call.html): the full-screen glass call over
 * Today. Layout only: every state comes in as props from the voice session reducer, and every
 * control calls back; this component opens no audio, provider or network connection. Esc
 * pauses the mic instead of closing (the design's rule); End call, then Back to Today, closes.
 * shadcn target: dialog (full screen). Not mounted yet: the session reducer has no adapter.
 */
export function VoiceCall(props: Props) {
  const { t } = useLocale();
  const { session, connecting, ended, online, micOn, lines, callLang, minutesLeft } = props;
  const view = callView({ session, connecting, ended, online, micOn });
  const [holding, setHolding] = useState(false);
  const [reading, setReading] = useState<string | null>(null);

  const startPush = () => {
    if (holding) return;
    setHolding(true);
    props.onPushStart?.();
  };
  const endPush = () => {
    if (!holding) return;
    setHolding(false);
    props.onPushEnd?.();
  };
  const pushKey = (event: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (down) startPush();
    else endPush();
  };

  const nextLang: Lang = callLang === "en" ? "he" : "en";
  const low = minutesLeft !== undefined && minutesLow(minutesLeft);

  return (
    <Dialog.Root open={props.open}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="vc-dialog"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            if (micOn && view.showControls) props.onMicToggle();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <section
            className="tp-call tp-glass"
            data-component="VoiceCall"
            data-state={view.state}
            data-ended={view.ended || undefined}
          >
            <div className="tp-call__top">
              <Dialog.Title className="tp-call__title">{t("vc.title")}</Dialog.Title>
              <div className="vc-top-end">
                {minutesLeft !== undefined ? (
                  <span className="tp-call__minutes" data-low={low || undefined} data-component="CallMinutes">
                    <TpIcon name="clock" size="sm" />
                    <span className="tp-num">{minutesLeft}</span> <span>{low ? t("vc.minutesLow") : t("vc.minutes")}</span>
                  </span>
                ) : null}
                {props.onCallLang ? (
                  <button
                    className="tp-lang-chip"
                    type="button"
                    aria-label={t("vc.lang")}
                    data-component="LanguageChip"
                    onClick={() => props.onCallLang?.(nextLang)}
                  >
                    <TpIcon name="globe" size="sm" />
                    <span lang={callLang}>{callLang === "en" ? "English" : "עברית"}</span>
                    <span className="tp-lang-chip__other" lang={nextLang}>
                      {nextLang === "en" ? "English" : "עברית"}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="tp-call__stage">
              <div className="vc-status">
                <div className="tp-level" aria-hidden="true" data-component="AudioLevel">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span className="tp-level__bar" key={i} />
                  ))}
                </div>
                <p className="tp-call__state" aria-live="polite">
                  {t(view.word)}
                </p>
                {view.showControls && !view.error ? <p className="tp-call__hint">{t("vc.hint")}</p> : null}
              </div>

              {view.error ? (
                <div className="tp-notice vc-notice" data-tone="caution" role="alert" data-component="Notice">
                  <span className="tp-notice__icon">
                    <TpIcon name="alert" size="sm" />
                  </span>
                  <span className="tp-notice__text">
                    <span className="tp-notice__title">{t("vc.err.title")}</span>
                    <span>{t("vc.err.body")}</span>
                  </span>
                  <span className="tp-notice__action">
                    <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" onClick={props.onRetry}>
                      <TpIcon name="refresh" size="sm" />
                      <span>{t("vc.retry")}</span>
                    </button>
                  </span>
                </div>
              ) : null}

              {online ? null : (
                <output className="tp-notice tp-offline vc-notice" data-tone="caution" data-component="StateOffline">
                  <span className="tp-notice__icon">
                    <TpIcon name="wifi-off" size="sm" />
                  </span>
                  <span className="tp-notice__text">
                    <span className="tp-notice__title">{t("vc.off.title")}</span>
                    <span>{t("vc.off.body")}</span>
                  </span>
                </output>
              )}

              {lines.length === 0 && view.state === "listening" ? <p className="tp-call__hint">{t("vc.empty")}</p> : null}

              {lines.length > 0 ? (
                <ol className="tp-call__transcript" aria-live="polite" aria-label={t("vc.transcript")} data-component="LiveTranscript">
                  {lines.map((line) => (
                    <li className="tp-call-line" data-who={line.who} data-live={line.live || undefined} key={line.id}>
                      <span className="tp-call-line__who">{line.who === "you" ? t("vc.you") : t("vc.coach")}</span>
                      <span className="tp-call-line__text" dir="auto">
                        {line.text}
                      </span>
                      {line.notSent ? (
                        <span className="tp-muted tp-small" data-component="CallLineNotSent">
                          {t("vc.notSent")}
                        </span>
                      ) : null}
                      {line.who === "coach" && props.onReadAloud ? (
                        <button
                          className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon tp-readaloud"
                          type="button"
                          aria-pressed={reading === line.id}
                          aria-label={reading === line.id ? t("vc.readStop") : t("vc.read")}
                          data-component="ReadAloudButton"
                          onClick={() => {
                            setReading((current) => (current === line.id ? null : line.id));
                            props.onReadAloud?.(line);
                          }}
                        >
                          <TpIcon name="volume" size="sm" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}

              {props.action ? (
                <output className="tp-call-action" data-component="CallActionConfirm">
                  <span className="tp-call-action__icon">
                    <TpIcon name="check" size="sm" />
                  </span>
                  <span className="tp-call-action__text" dir="auto">
                    {props.action.text}
                  </span>
                  <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" onClick={props.action.onUndo}>
                    <TpIcon name="undo" size="sm" />
                    <span>{t("tx.undo")}</span>
                  </button>
                </output>
              ) : null}
            </div>

            <div className="tp-call__dock">
              {view.showControls ? (
                <>
                  <button
                    className="tp-btn tp-btn--secondary"
                    type="button"
                    data-action="call-interrupt"
                    data-component="Interrupt"
                    disabled={!view.canInterrupt}
                    onClick={props.onInterrupt}
                  >
                    <TpIcon name="hand" size="sm" />
                    <span>{t("vc.interrupt")}</span>
                  </button>
                  <div className="tp-call__micwrap" data-component="MicToggle">
                    <button
                      className="tp-call__mic"
                      type="button"
                      aria-pressed={micOn}
                      aria-label={micOn ? t("vc.mute") : t("vc.unmute")}
                      onClick={props.onMicToggle}
                    >
                      <TpIcon name={micOn ? "mic" : "mic-off"} />
                    </button>
                    <span className="tp-call__mic-label" aria-hidden="true">
                      {micOn ? t("vc.micOn") : t("vc.micOff")}
                    </span>
                  </div>
                  {props.onPushStart ? (
                    <>
                      <button
                        className="tp-ptt"
                        type="button"
                        data-pressed={holding}
                        aria-pressed={holding}
                        aria-describedby="vc-ptt-help"
                        data-component="PushToTalk"
                        onPointerDown={startPush}
                        onPointerUp={endPush}
                        onPointerLeave={endPush}
                        onKeyDown={(event) => pushKey(event, true)}
                        onKeyUp={(event) => pushKey(event, false)}
                      >
                        <TpIcon name="mic" size="sm" />
                        <span>{holding ? t("vc.pttRelease") : t("vc.ptt")}</span>
                      </button>
                      <span className="tp-sr-only" id="vc-ptt-help">
                        {t("vc.pttHelp")}
                      </span>
                    </>
                  ) : null}
                </>
              ) : null}
              {view.ended ? (
                <button className="tp-btn tp-btn--secondary" type="button" data-action="call-close" onClick={props.onClose}>
                  <TpIcon name="chevron" size="sm" className="tp-icon--back" />
                  <span>{t("vc.back")}</span>
                </button>
              ) : (
                <button className="tp-btn tp-btn--danger" type="button" data-action="call-end" data-component="EndCall" onClick={props.onEnd}>
                  <TpIcon name="phone-off" size="sm" />
                  <span>{t("vc.end")}</span>
                </button>
              )}
            </div>
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
