/**
 * The speech seam for read-aloud and the audio recap (kitchen T4, S16). Everything that speaks
 * goes through a `SpeechEngine`, so the voice can change without touching the screens.
 *
 * Today the only engine is the browser's own (window.speechSynthesis): free, on the device, no
 * network and no provider. docs/contracts/VOICE.md is proposed, not adopted, so no paid TTS is
 * called from here.
 *
 * Chatterbox (Hebrew-capable) plugs in here as another `SpeechEngine` once the owner decides
 * docs/contracts/VOICE.md decision 2 (TTS eligibility). Until then, a language with no voice on
 * the device reports `available(lang) === false` and the screens say so plainly.
 */

export type SpeakOptions = {
  /** "en" or "he" (or a full tag like "he-IL"). */
  lang: string;
  /** 0.5 to 2; 1 is normal speed. */
  rate: number;
  /** Called once when the text has been read to the end. Not on cancel, and not when the engine couldn't read it. */
  onEnd: () => void;
  /** Called as the engine reaches each word, with its character offset, where supported. */
  onBoundary?: (charIndex: number) => void;
  /** Called when another reading took over before this one finished (here, or a cancel from elsewhere). */
  onInterrupt?: () => void;
  /**
   * Called once when the engine couldn't read the text (a voice that is listed but not installed,
   * the audio busy, and so on), with the engine's reason. Without it, `onInterrupt` is called, and
   * without that, `onEnd`, so a caller is never left waiting.
   */
  onError?: (reason: string) => void;
};

export type SpeechHandle = { cancel(): void };

export type SpeechEngine = {
  available(lang: string): boolean;
  speak(text: string, options: SpeakOptions): SpeechHandle;
  /** Calls `listener` when the engine's voices change (they load late in some browsers). */
  subscribe?(listener: () => void): () => void;
};

/** The parts of SpeechSynthesisVoice this file reads. */
export type VoiceLike = { lang: string; name: string; localService?: boolean; default?: boolean };

/** The parts of window.speechSynthesis this file uses. */
export type SynthLike = {
  getVoices(): VoiceLike[];
  speak(utterance: unknown): void;
  cancel(): void;
  addEventListener?(type: "voiceschanged", listener: () => void): void;
  removeEventListener?(type: "voiceschanged", listener: () => void): void;
};

type UtteranceLike = {
  lang: string;
  rate: number;
  voice: unknown;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onboundary: ((event: { charIndex: number }) => void) | null;
};

type UtteranceFactory = (text: string) => UtteranceLike;

/** Language base ("he" from "he-IL"); the old "iw" code counts as Hebrew. */
export function langBase(lang: string): string {
  const base = lang.toLowerCase().split(/[-_]/)[0] ?? "";
  return base === "iw" ? "he" : base;
}

/**
 * The voice to use for `lang`: one whose language starts with it, preferring a voice on the
 * device, then the browser's default. Null when there is none.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string): V | null {
  const want = langBase(lang);
  const matching = voices.filter((voice) => langBase(voice.lang) === want);
  if (matching.length === 0) return null;
  return (
    matching.find((voice) => voice.localService && voice.default) ??
    matching.find((voice) => voice.localService) ??
    matching.find((voice) => voice.default) ??
    matching[0] ??
    null
  );
}

/** An engine that never speaks: for the server render and for browsers without speech. */
export const silentEngine: SpeechEngine = {
  available: () => false,
  speak: () => ({ cancel() {} }),
};

/** A speech engine over a SpeechSynthesis-like object. Exported for tests; the app uses `browserSpeechEngine`. */
export function createSynthEngine(synth: SynthLike, makeUtterance: UtteranceFactory): SpeechEngine {
  let active: { interrupt: () => void } | null = null;
  return {
    available: (lang) => pickVoice(synth.getVoices(), lang) !== null,
    speak(text, { lang, rate, onEnd, onBoundary, onInterrupt, onError }) {
      const voice = pickVoice(synth.getVoices(), lang);
      const utterance = makeUtterance(text);
      let done = false;
      const detach = () => {
        done = true;
        utterance.onend = null;
        utterance.onerror = null;
        utterance.onboundary = null;
      };
      const self = {
        interrupt: () => {
          if (done) return;
          detach();
          onInterrupt?.();
        },
      };
      const finish = () => {
        if (done) return;
        detach();
        if (active === self) active = null;
        onEnd();
      };
      // An error is never "read to the end". Our own cancels detach first, so they never get here;
      // "interrupted" or "canceled" means something else cleared the device's speech queue.
      const fail = (event?: { error?: string }) => {
        if (done) return;
        const reason = event?.error ?? "unknown";
        if (active === self) active = null;
        if (reason === "interrupted" || reason === "canceled") {
          self.interrupt();
          return;
        }
        detach();
        if (onError) onError(reason);
        else if (onInterrupt) onInterrupt();
        else onEnd();
      };
      // One voice at a time: a new reading replaces whatever was being read, and says so.
      const before = active;
      active = self;
      before?.interrupt();
      synth.cancel();
      utterance.lang = voice?.lang ?? lang;
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.onend = finish;
      utterance.onerror = fail;
      utterance.onboundary = onBoundary ? (event) => onBoundary(event.charIndex) : null;
      synth.speak(utterance);
      return {
        cancel() {
          if (done) return;
          detach();
          if (active === self) active = null;
          synth.cancel();
        },
      };
    },
    subscribe(listener) {
      synth.addEventListener?.("voiceschanged", listener);
      return () => synth.removeEventListener?.("voiceschanged", listener);
    },
  };
}

let cached: SpeechEngine | null = null;

/**
 * The browser's own speech engine, or `silentEngine` where there is none (the server, old
 * browsers). Call it in an effect or an event, not during render, so the server and the first
 * client render agree.
 */
export function browserSpeechEngine(): SpeechEngine {
  if (cached) return cached;
  const scope = globalThis as unknown as {
    speechSynthesis?: SynthLike;
    SpeechSynthesisUtterance?: new (text: string) => UtteranceLike;
  };
  const synth = scope.speechSynthesis;
  const Utterance = scope.SpeechSynthesisUtterance;
  if (!synth || !Utterance) return silentEngine;
  cached = createSynthEngine(synth, (text) => new Utterance(text));
  return cached;
}
