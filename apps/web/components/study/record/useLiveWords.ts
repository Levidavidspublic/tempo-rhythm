"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { recorderMime, speechEvent, VOICE_CLIENT_LIMITS } from "@/lib/voice-runtime";
import { useRecordingLease } from "./recordApi";

/** Where live words stand. `off` = not started or stopped. */
export type LiveStatus = "off" | "connecting" | "live" | "paused";

/** Why live words stopped or never started; the screen says so in words and offers typing. */
export type LiveIssue =
  | null
  | "no_key"
  | "language"
  | "budget"
  | "resting"
  | "mic"
  | "connect"
  | "ended"
  | "hidden";

/** A tab hidden this long stops the recording and releases the microphone. */
export const HIDDEN_STOP_MS = 10 * 60_000;

/**
 * Live words for RecordSession: the microphone streams straight to Deepgram over a socket opened
 * with a short-lived token from `recordings.grant` (the Flux lane URL comes from the server), and
 * each final turn of words is handed to `onFinal`. Audio frames go browser → Deepgram only;
 * nothing is stored, not even here.
 *
 * Stop, leaving the page (unmount) and a tab hidden for over 10 minutes all end the session: the
 * recorder stops, the microphone track is released, the socket and timers close and the lease
 * ends. Only ever started by the person's click, after consent.
 */
export function useLiveWords({
  lang,
  onFinal,
  onInterim,
}: {
  lang: "en" | "he";
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
}) {
  const { startLease, renewLease, stopLease, grant } = useRecordingLease();

  const [status, setStatus] = useState<LiveStatus>("off");
  const [issue, setIssue] = useState<LiveIssue>(null);
  const [level, setLevel] = useState(0);
  const [minutesLeft, setMinutesLeft] = useState<number | undefined>(undefined);

  // The fence: every async step checks it, so nothing applies after a teardown.
  const generation = useRef(0);
  const session = useRef<Id<"recordingSessions"> | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const pausedRef = useRef(false);
  const finalRef = useRef(onFinal);
  const interimRef = useRef(onInterim);
  useEffect(() => {
    finalRef.current = onFinal;
    interimRef.current = onInterim;
  }, [onFinal, onInterim]);

  /** Teardown, in order: fence, recorder, microphone, meter, socket, timers, lease. */
  const teardown = useCallback(
    (reason: LiveIssue) => {
      generation.current += 1;
      if (recorder.current && recorder.current.state !== "inactive") {
        try {
          recorder.current.stop();
        } catch {
          // Already stopped.
        }
      }
      recorder.current = null;
      for (const track of stream.current?.getTracks() ?? []) track.stop();
      stream.current = null;
      if (frame.current !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame.current);
      frame.current = null;
      void audioContext.current?.close().catch(() => {});
      audioContext.current = null;
      const ws = socket.current;
      socket.current = null;
      if (ws && ws.readyState <= 1) {
        try {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "CloseStream" }));
          ws.close(1000);
        } catch {
          // Closing a socket that is already going away.
        }
      }
      for (const id of timers.current) window.clearInterval(id);
      timers.current = [];
      const lease = session.current;
      session.current = null;
      if (lease) void stopLease({ sessionId: lease }).catch(() => {});
      pausedRef.current = false;
      setLevel(0);
      interimRef.current("");
      setStatus("off");
      setIssue(reason);
    },
    [stopLease],
  );

  const stop = useCallback(() => teardown(null), [teardown]);

  /** Starts live words. Call only from the person's click, after consent. */
  const start = useCallback(
    async ({ reducedMotion }: { reducedMotion: boolean }) => {
      teardown(null);
      const gen = generation.current;
      setStatus("connecting");
      const fail = (reason: LiveIssue) => {
        if (gen === generation.current) teardown(reason);
      };
      try {
        const mime = recorderMime((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
        if (!mime || !navigator.mediaDevices?.getUserMedia) {
          fail("mic");
          return;
        }
        let media: MediaStream;
        try {
          media = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch {
          fail("mic");
          return;
        }
        if (gen !== generation.current) {
          for (const track of media.getTracks()) track.stop();
          return;
        }
        stream.current = media;
        const lease = await startLease({ lang });
        if (gen !== generation.current) {
          if (lease.ok) void stopLease({ sessionId: lease.sessionId }).catch(() => {});
          return;
        }
        if (!lease.ok) {
          fail(lease.reason);
          return;
        }
        session.current = lease.sessionId;
        setMinutesLeft(lease.minutesLeft);
        const token = await grant({ sessionId: lease.sessionId });
        if (gen !== generation.current) return;
        if (!token.ok) {
          fail(token.reason === "no_key" ? "no_key" : token.reason === "ended" ? "ended" : "connect");
          return;
        }
        // The token is used once, as the socket's subprotocol, and never kept.
        const ws = new WebSocket(token.url, ["bearer", token.token]);
        socket.current = ws;
        ws.onopen = () => {
          if (gen !== generation.current) return;
          // A recorder that can't be made or started must not leave the mic and socket open.
          try {
            const rec = new MediaRecorder(media, { mimeType: mime });
            recorder.current = rec;
            rec.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(event.data);
            };
            rec.onerror = () => fail("connect");
            rec.onstop = () => {
              if (gen === generation.current && recorder.current === rec) fail("connect");
            };
            rec.start(VOICE_CLIENT_LIMITS.chunkMs);
            setStatus(pausedRef.current ? "paused" : "live");
          } catch {
            fail("connect");
          }
        };
        ws.onmessage = (event) => {
          if (gen !== generation.current || typeof event.data !== "string") return;
          let parsed: unknown = null;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            return;
          }
          const speech = speechEvent(parsed);
          if (!speech || speech.kind === "speechStarted") return;
          if (speech.kind === "interim") interimRef.current(speech.text);
          else {
            interimRef.current("");
            finalRef.current(speech.text);
          }
        };
        ws.onerror = () => fail("connect");
        ws.onclose = () => {
          if (gen === generation.current && session.current) fail("ended");
        };
        // Heartbeat: anything but "ok" stops live words (the notes stay).
        timers.current.push(
          window.setInterval(() => {
            const id = session.current;
            if (!id) return;
            void renewLease({ sessionId: id })
              .then((result) => {
                if (gen !== generation.current) return;
                setMinutesLeft(result.minutesLeft);
                if (result.status !== "ok") fail(result.status === "exhausted" ? "budget" : "ended");
              })
              .catch(() => fail("ended"));
          }, lease.renewEveryMs),
        );
        // A tab hidden for over 10 minutes stops the recording and releases the microphone.
        let hiddenSince = 0;
        timers.current.push(
          window.setInterval(() => {
            if (gen !== generation.current) return;
            const now = Date.now();
            if (document.visibilityState === "hidden") hiddenSince ||= now;
            else hiddenSince = 0;
            if (hiddenSince && now - hiddenSince > HIDDEN_STOP_MS) fail("hidden");
          }, 1_000),
        );
        // The microphone level. Static under reduced motion: the words carry the state.
        if (!reducedMotion && typeof AudioContext !== "undefined") {
          try {
            const context = new AudioContext();
            audioContext.current = context;
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            context.createMediaStreamSource(media).connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            let last = 0;
            const tick = (time: number) => {
              if (gen !== generation.current) return;
              if (time - last > 100) {
                last = time;
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (const sample of data) sum += ((sample - 128) / 128) ** 2;
                setLevel(pausedRef.current ? 0 : Math.min(1, Math.sqrt(sum / data.length) * 4));
              }
              frame.current = requestAnimationFrame(tick);
            };
            frame.current = requestAnimationFrame(tick);
          } catch {
            // No meter; the state word still says "Recording".
          }
        }
      } catch {
        fail("connect");
      }
    },
    [grant, lang, renewLease, startLease, stopLease, teardown],
  );

  /**
   * Pause mutes the microphone track instead of stopping the recorder: the socket keeps getting
   * (silent) audio, so the speech service doesn't close it while paused.
   */
  const pause = useCallback(() => {
    for (const track of stream.current?.getAudioTracks() ?? []) track.enabled = false;
    pausedRef.current = true;
    setLevel(0);
    setStatus((current) => (current === "live" ? "paused" : current));
  }, []);

  const resume = useCallback(() => {
    for (const track of stream.current?.getAudioTracks() ?? []) track.enabled = true;
    pausedRef.current = false;
    setStatus((current) => (current === "paused" ? "live" : current));
  }, []);

  // Leaving the page ends the session and releases the microphone.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only unmount ends the session here
  useEffect(() => () => teardown(null), []);

  return { status, issue, level, minutesLeft, start, stop, pause, resume, clearIssue: () => setIssue(null) };
}
