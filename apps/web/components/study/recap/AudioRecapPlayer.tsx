"use client";

import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { speechPieces } from "@/convex/lib/studyVoice";
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
import {
  browserClipPlayer,
  type ClipPlayer,
  chooseVoice,
  createTempoReader,
  type TempoDown,
  type TempoVoiceSource,
  type VoicePick,
} from "./tempoVoice";
import { speechStatus, useSpeech, useStopWhenHidden } from "./useReadAloud";

/**
 * S16 AudioRecapPlayer (kitchen T4): builds the recap (or the full reading) of a page on the
 * device and reads it one sentence at a time. Speech stops when the player unmounts (leaving the
 * route) and when the tab is hidden.
 *
 * Two voices. With `tempo` (the listen screen passes it) and Tempo's voice available and online,
 * it reads in Tempo's voice (tempoVoice.ts: Chatterbox through `studyVoice.speak`, by piece index,
 * never by text). Otherwise, on any failure of it, or when the person picks it, the device's own
 * voice reads through the SpeechEngine seam, with a polite line saying why.
 */

export type AudioRecapPlayerProps = {
  noteId: string;
  title: string;
  /** The page's markdown. */
  body: string;
  mode: ListenMode;
  /** Another engine than the browser's for the device voice (tests, the gallery). */
  engine?: SpeechEngine;
  /** Tempo's voice for this page, when the screen can offer it. */
  tempo?: TempoVoiceSource;
};

const TICK_MS = 250;

export function AudioRecapPlayer({ noteId, title, body, mode, engine: override, tempo }: AudioRecapPlayerProps) {
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
  const deviceStatus = speechStatus(speech, lang);
  const { engine } = speech;

  // Tempo's voice: a reader over this reading's pieces, made after mount (the <audio> element).
  const [browserClips, setBrowserClips] = useState<ClipPlayer | null>(null);
  useEffect(() => setBrowserClips(() => browserClipPlayer()), []);
  const play = tempo?.play ?? browserClips;
  const fetchPiece = tempo?.fetchPiece;
  const pieces = useMemo(() => speechPieces(sentences), [sentences]);
  const reader = useMemo(
    () => (fetchPiece && play ? createTempoReader({ pieces, fetchPiece, play }) : null),
    [pieces, fetchPiece, play]
  );
  useEffect(() => () => reader?.dispose(), [reader]);
  const [pick, setPick] = useState<VoicePick>("tempo");
  const [down, setDown] = useState<TempoDown>(null);
  const choice = chooseVoice({ source: reader ? tempo : undefined, pick, down });
  const useTempo = choice.voice === "tempo" && reader !== null;
  const status = useTempo ? "ready" : deviceStatus;
  const deviceReady = useRef(deviceStatus === "ready");
  deviceReady.current = deviceStatus === "ready";

  const startedAt = useRef(0);
  const [within, setWithin] = useState(0);

  // The page can change while it plays (an edit in another tab). Keep the place in range, and
  // restart only when the sentence being read changed, not on every edit elsewhere in the page.
  const count = sentences.length;
  const latestCount = useRef(count);
  latestCount.current = count;
  useEffect(() => {
    if (state.index >= count) dispatch({ type: "clamp", count });
  }, [state.index, count]);
  const text = sentences[state.index]?.text;

  // state.index is a dependency for both voices, so a move to another sentence with the same words restarts too.
  useEffect(() => {
    if (!state.playing || text === undefined) return;
    if (useTempo && reader) {
      startedAt.current = Date.now();
      setWithin(0);
      const handle = reader.speak(state.index, {
        rate: state.rate,
        onEnd: () => dispatch({ type: "sentenceEnd", count: latestCount.current }),
        // Any failure hands the reading to the device's voice, from this sentence. With no
        // device voice either, stop here (the line under the player says why).
        onError: (reason) => {
          setDown(reason === "exhausted" ? "budget" : "error");
          if (!deviceReady.current) dispatch({ type: "pause" });
        },
      });
      const tick = window.setInterval(() => setWithin((Date.now() - startedAt.current) / 1000), TICK_MS);
      return () => {
        window.clearInterval(tick);
        handle.cancel();
      };
    }
    if (status !== "ready" || !engine) return;
    startedAt.current = Date.now();
    setWithin(0);
    const handle = engine.speak(text, {
      lang,
      rate: state.rate,
      onEnd: () => dispatch({ type: "sentenceEnd", count: latestCount.current }),
      onInterrupt: () => dispatch({ type: "pause" }),
      // An error is not "read": stop here and say so, rather than racing to the end.
      onError: () => dispatch({ type: "speechError" }),
    });
    const tick = window.setInterval(() => setWithin((Date.now() - startedAt.current) / 1000), TICK_MS);
    return () => {
      window.clearInterval(tick);
      handle.cancel();
    };
  }, [state.playing, state.index, state.rate, status, engine, text, lang, useTempo, reader]);

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
      voice={
        tempo
          ? {
              offered: choice.offered && reader !== null,
              pick,
              onPick: setPick,
              note: choice.note,
              deviceReads: !useTempo && deviceStatus === "ready",
            }
          : undefined
      }
    />
  );
}
