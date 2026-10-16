"use client";

import { ReadAloudButton, type ReadAloudLabels } from "@tempo/ui";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { detectLang, type RecapLang } from "../../../../../packages/core/recap";
import { browserSpeechEngine, type SpeechEngine, type SpeechHandle, silentEngine } from "./speech";

/**
 * Read-aloud for the study screens (kitchen T4): one reader per screen, so only one thing speaks
 * at a time. The engine is looked up after mount, so the server render and the first client
 * render match (no read-aloud controls until the device says it can speak).
 */

/** How long to wait for late-loading voices before saying a language has none. */
export const VOICE_WAIT_MS = 1500;

export type SpeechState = {
  /** null until mounted. */
  engine: SpeechEngine | null;
  /** Bumps when the device's voices change, so availability is read again. */
  version: number;
  /** True once the voices have loaded or the wait is over. */
  settled: boolean;
};

export type SpeechStatus = "checking" | "ready" | "noVoice" | "none";

/** Whether `lang` can be read aloud right now. Pure, for the views and their tests. */
export function speechStatus(speech: Pick<SpeechState, "engine" | "settled">, lang: RecapLang): SpeechStatus {
  if (!speech.engine) return "checking";
  if (speech.engine === silentEngine) return "none";
  if (speech.engine.available(lang)) return "ready";
  return speech.settled ? "noVoice" : "checking";
}

/** The device's speech engine, after mount. Pass `override` to use another engine (tests, Chatterbox later). */
export function useSpeech(override?: SpeechEngine): SpeechState {
  const [engine, setEngine] = useState<SpeechEngine | null>(null);
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const found = override ?? browserSpeechEngine();
    setEngine(found);
    const bump = () => {
      setVersion((n) => n + 1);
      setSettled(true);
    };
    const unsubscribe = found.subscribe?.(bump);
    const timer = window.setTimeout(() => setSettled(true), VOICE_WAIT_MS);
    return () => {
      unsubscribe?.();
      window.clearTimeout(timer);
    };
  }, [override]);
  return { engine, version, settled };
}

/** Calls `stop` when the tab is hidden or the page is left (route changes unmount the screen). */
export function useStopWhenHidden(stop: () => void) {
  const latest = useRef(stop);
  latest.current = stop;
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") latest.current();
    };
    const onHide = () => latest.current();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      latest.current();
    };
  }, []);
}

export type ReadAloudController = {
  speech: SpeechState;
  /** The text being read, or null. */
  speaking: string | null;
  status: (lang: RecapLang) => SpeechStatus;
  /** Reads `text`, or stops if it is the text being read. */
  toggle: (text: string) => void;
  stop: () => void;
};

export function useReadAloud({ engine: override, rate = 1 }: { engine?: SpeechEngine; rate?: number } = {}): ReadAloudController {
  const speech = useSpeech(override);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const handle = useRef<SpeechHandle | null>(null);

  const stop = useCallback(() => {
    handle.current?.cancel();
    handle.current = null;
    setSpeaking(null);
  }, []);
  useStopWhenHidden(stop);

  const { engine } = speech;
  const toggle = useCallback(
    (text: string) => {
      if (!engine) return;
      if (speaking === text) {
        stop();
        return;
      }
      handle.current?.cancel();
      const done = () => {
        handle.current = null;
        setSpeaking((current) => (current === text ? null : current));
      };
      handle.current = engine.speak(text, {
        lang: detectLang(text),
        rate,
        onEnd: done,
        onInterrupt: done,
        onError: done,
      });
      setSpeaking(text);
    },
    [engine, rate, speaking, stop]
  );

  // A new function each render, so availability is read again after the voices change.
  const status = (lang: RecapLang) => speechStatus({ engine, settled: speech.settled }, lang);

  return { speech, speaking, status, toggle, stop };
}

/** Counts the slot's buttons on screen per text; `remove` reports a text that has none left. */
type DrawnTexts = { add: (text: string) => void; remove: (text: string) => void };

/**
 * One read-aloud button in the slot. While it is drawn its text counts as on screen; when it goes
 * or shows another text (the card turned, the next question came), that text is off screen.
 */
function SlotButton({
  text,
  pressed,
  onToggle,
  labels,
  drawn,
}: {
  text: string;
  pressed: boolean;
  onToggle: (text: string) => void;
  labels: ReadAloudLabels;
  drawn: DrawnTexts;
}) {
  useEffect(() => {
    drawn.add(text);
    return () => drawn.remove(text);
  }, [drawn, text]);
  return <ReadAloudButton text={text} pressed={pressed} onToggle={onToggle} labels={labels} />;
}

/**
 * The `readAloud` slot for the @tempo/ui study components: a ReadAloudButton beside each text the
 * device can read, a plain note for Hebrew text when there is no Hebrew voice, and nothing while
 * checking or where the browser can't speak at all. Reading stops once the text being read is no
 * longer drawn (its card or question changed, even inside a component that keeps its own place),
 * so a voice never runs on with no pressed button left to stop it. Pass `resetKey` to also stop
 * when it changes.
 */
export function useReadAloudSlot(resetKey?: unknown, options: { engine?: SpeechEngine } = {}): (text: string) => ReactNode {
  const { t } = useLocale();
  const reader = useReadAloud({ engine: options.engine });
  const labels = useMemo(() => ({ read: t("st.ra.read"), stop: t("st.ra.stop") }), [t]);
  const { speaking, status, toggle, stop } = reader;
  const speakingNow = useRef(speaking);
  speakingNow.current = speaking;
  const drawn = useMemo<DrawnTexts>(() => {
    const counts = new Map<string, number>();
    return {
      add: (text) => counts.set(text, (counts.get(text) ?? 0) + 1),
      remove: (text) => {
        const left = (counts.get(text) ?? 1) - 1;
        if (left > 0) {
          counts.set(text, left);
          return;
        }
        counts.delete(text);
        if (speakingNow.current === text) stop();
      },
    };
  }, [stop]);
  // When `resetKey` changes (a review moves to the next card), stop reading the old one.
  const lastKey = useRef(resetKey);
  useEffect(() => {
    if (Object.is(lastKey.current, resetKey)) return;
    lastKey.current = resetKey;
    stop();
  });
  return useCallback(
    (text: string) => {
      const lang = detectLang(text);
      const state = status(lang);
      if (state === "noVoice" && lang === "he") {
        return <p className="tp-readaloud-note">{t("st.ra.noHebrew")}</p>;
      }
      if (state !== "ready") return null;
      return <SlotButton text={text} pressed={speaking === text} onToggle={toggle} labels={labels} drawn={drawn} />;
    },
    [drawn, labels, speaking, status, t, toggle]
  );
}
