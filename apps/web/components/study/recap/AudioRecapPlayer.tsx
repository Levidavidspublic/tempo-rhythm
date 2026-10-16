"use client";

import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import {
  answerFromPage,
  buildRecap,
  estimateTimeline,
  fullReading,
  type PageMatch,
  pageLang,
} from "../../../../../packages/core/recap";
import { AudioRecapPlayerView } from "./AudioRecapPlayerView";
import { elapsedSeconds, initialPlayer, type ListenMode, playerReducer } from "./player";
import type { SpeechEngine } from "./speech";
import { speechStatus, useSpeech, useStopWhenHidden } from "./useReadAloud";

/**
 * S16 AudioRecapPlayer (kitchen T4): builds the recap (or the full reading) of a page on the
 * device and reads it one sentence at a time through the SpeechEngine seam. Speech stops when
 * the player unmounts (leaving the route) and when the tab is hidden. No network, no provider.
 */

export type AudioRecapPlayerProps = {
  noteId: string;
  title: string;
  /** The page's markdown. */
  body: string;
  mode: ListenMode;
  /** Another engine than the browser's (tests; Chatterbox once VOICE.md decision 2 is made). */
  engine?: SpeechEngine;
};

const TICK_MS = 250;

export function AudioRecapPlayer({ noteId, title, body, mode, engine: override }: AudioRecapPlayerProps) {
  const idBase = useId();
  // The page's language from its readable words, so a link or a json tempo block on a Hebrew page
  // doesn't pick an English voice (and the list joiners follow the page).
  const lang = useMemo(() => pageLang(body), [body]);
  const sentences = useMemo(
    () => (mode === "full" ? fullReading(body, { lang }) : buildRecap(body, { lang })),
    [body, lang, mode]
  );
  const [state, dispatch] = useReducer(playerReducer, initialPlayer);
  const timeline = useMemo(() => estimateTimeline(sentences, { rate: state.rate }), [sentences, state.rate]);
  const speech = useSpeech(override);
  const status = speechStatus(speech, lang);
  const { engine } = speech;

  const startedAt = useRef(0);
  const [within, setWithin] = useState(0);

  useEffect(() => {
    if (!state.playing || status !== "ready" || !engine) return;
    const sentence = sentences[state.index];
    if (!sentence) return;
    startedAt.current = Date.now();
    setWithin(0);
    const handle = engine.speak(sentence.text, {
      lang,
      rate: state.rate,
      onEnd: () => dispatch({ type: "sentenceEnd", count: sentences.length }),
      onInterrupt: () => dispatch({ type: "pause" }),
    });
    const tick = window.setInterval(() => setWithin((Date.now() - startedAt.current) / 1000), TICK_MS);
    return () => {
      window.clearInterval(tick);
      handle.cancel();
    };
  }, [state.playing, state.index, state.rate, status, engine, sentences, lang]);

  useStopWhenHidden(() => dispatch({ type: "pause" }));

  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<PageMatch[] | null>(null);

  return (
    <AudioRecapPlayerView
      noteId={noteId}
      title={title}
      mode={mode}
      lang={lang}
      sentences={sentences}
      timeline={timeline}
      state={state}
      status={status}
      elapsed={elapsedSeconds(timeline, state.index, state.playing ? within : 0)}
      onAction={dispatch}
      question={question}
      onQuestion={setQuestion}
      answers={answers}
      onAsk={() => setAnswers(question.trim() ? answerFromPage(body, question, { lang }) : null)}
      idBase={idBase}
    />
  );
}
