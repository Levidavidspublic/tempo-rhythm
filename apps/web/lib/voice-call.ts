/**
 * The voice call screen's view (docs/design/v3/screens/web/voice-call.html), read from the
 * inactive voice session reducer (components/coach/voice/voiceSession.ts). Pure: no audio, no
 * provider, no network. The big word in the middle always says what is happening; the level
 * bars are decoration only.
 */
import type { VoiceSessionState } from "@/components/coach/voice/voiceSession";
import type { MessageKey } from "@/lib/i18n";

export type CallState = "connecting" | "listening" | "speaking" | "paused";

export type CallView = {
  /** tempo.css `.tp-call[data-state]`. */
  state: CallState;
  /** The words under the bars. */
  word: MessageKey;
  ended: boolean;
  /** Couldn't connect (or a turn broke): the notice with Try again shows. */
  error: boolean;
  /** Interrupt only works while the coach speaks. */
  canInterrupt: boolean;
  /** The mic toggle and push-to-talk only show while a call is open. */
  showControls: boolean;
};

export type CallInput = {
  session: VoiceSessionState;
  /** A session is being opened (no reply from the adapter yet). */
  connecting: boolean;
  ended: boolean;
  online: boolean;
  micOn: boolean;
};

export function callView({ session, connecting, ended, online, micOn }: CallInput): CallView {
  if (ended) {
    return { state: "paused", word: "vc.ended", ended: true, error: false, canInterrupt: false, showControls: false };
  }
  if (!online || session.phase === "error") {
    return {
      state: "paused",
      word: "vc.notConnected",
      ended: false,
      error: online,
      canInterrupt: false,
      showControls: true,
    };
  }
  if (connecting) {
    return { state: "connecting", word: "vc.connecting", ended: false, error: false, canInterrupt: false, showControls: true };
  }
  if (session.phase === "speaking") {
    return { state: "speaking", word: "vc.speaking", ended: false, error: false, canInterrupt: true, showControls: true };
  }
  if (!micOn || session.phase === "idle") {
    return { state: "paused", word: "vc.paused", ended: false, error: false, canInterrupt: false, showControls: true };
  }
  return { state: "listening", word: "vc.listening", ended: false, error: false, canInterrupt: false, showControls: true };
}

/** The minutes badge reads "running low" at five minutes or fewer. */
export function minutesLow(minutesLeft: number): boolean {
  return minutesLeft <= 5;
}
