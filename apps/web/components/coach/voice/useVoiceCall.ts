"use client";

import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { newClientKey, recorderMime, speechEvent, VOICE_CLIENT_LIMITS } from "@/lib/voice-runtime";
import type { CallLine } from "./VoiceCall";
import type { VoiceSessionState } from "./voiceSession";
import { createVoiceSessionState } from "./voiceSession";

type Phase = VoiceSessionState["phase"];

/** What sending a spoken turn did: the reply message to read aloud, a crisis, or nothing. */
export type VoiceSendResult = { kind: "reply" } | { kind: "crisis" } | { kind: "none" };

/** A coach reply the call may read aloud (the newest assistant message in the thread). */
export type VoiceReply = { id: Id<"messages">; content: string; createdAt: number } | null;

/**
 * The voice call runtime (docs/contracts/VOICE.md defaults): the microphone streams straight to
 * Deepgram over a socket opened with a 30-second token, the final words of each turn go through
 * the same `send` as typed text (crisis guard first, then the coach), and each new coach reply is
 * read aloud one sentence at a time. One session per Start; Stop, closing, a crisis, a refused
 * renewal, idle or a hidden page ends it, in the contract's teardown order (L-9).
 *
 * Nothing is stored in the browser: no audio, no interim words, no token.
 */
export function useVoiceCall({
  conversationId,
  send,
  latestReply,
}: {
  conversationId: Id<"conversations"> | null;
  send: (text: string) => Promise<VoiceSendResult>;
  latestReply: VoiceReply;
}) {
  const startLease = useMutation(api.voice.start);
  const renewLease = useMutation(api.voice.renew);
  const stopLease = useMutation(api.voice.stop);
  const grant = useAction(api.voice.grant);
  const speak = useAction(api.voice.speak);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [connecting, setConnecting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [lines, setLines] = useState<CallLine[]>([]);
  const [interim, setInterim] = useState("");
  const [minutesLeft, setMinutesLeft] = useState<number | undefined>(undefined);

  // The fence (L-9): every async step checks it, so nothing applies after a teardown.
  const generation = useRef(0);
  const speechGeneration = useRef(0);
  const session = useRef<Id<"voiceSessions"> | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrls = useRef<string[]>([]);
  const timers = useRef<number[]>([]);
  const lastActivity = useRef(0);
  const startedAt = useRef(0);
  const awaitingReply = useRef(false);
  const spoken = useRef(new Set<string>());
  const phaseRef = useRef<Phase>("idle");
  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const stopPlayback = useCallback(() => {
    speechGeneration.current += 1;
    if (audio.current) {
      audio.current.pause();
      audio.current.src = "";
      audio.current = null;
    }
    for (const url of audioUrls.current) URL.revokeObjectURL(url);
    audioUrls.current = [];
  }, []);

  /** Teardown, in order (L-9): fence, playback, synthesis, capture, socket and timers, lease. */
  const end = useCallback(() => {
    generation.current += 1;
    stopPlayback();
    awaitingReply.current = false;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    recorder.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
    if (socket.current && socket.current.readyState <= WebSocket.OPEN) socket.current.close(1000);
    socket.current = null;
    for (const id of timers.current) window.clearInterval(id);
    timers.current = [];
    const lease = session.current;
    session.current = null;
    if (lease) void stopLease({ sessionId: lease }).catch(() => {});
    setInterim("");
    setConnecting(false);
    setEnded(true);
    setPhaseBoth("idle");
  }, [setPhaseBoth, stopLease, stopPlayback]);

  const fail = useCallback(() => {
    end();
    setEnded(false);
    setPhaseBoth("error");
  }, [end, setPhaseBoth]);

  /** Reads one reply aloud, sentence by sentence, fetching a few ahead (A-10). */
  const readAloud = useCallback(
    async (messageId: Id<"messages">) => {
      const lease = session.current;
      if (!lease) return;
      stopPlayback();
      const mine = speechGeneration.current;
      const gen = generation.current;
      const live = () => mine === speechGeneration.current && gen === generation.current;
      setPhaseBoth("speaking");
      lastActivity.current = Date.now();
      const fetches = new Map<number, ReturnType<typeof speak>>();
      const fetchAt = (index: number) => {
        if (!fetches.has(index)) fetches.set(index, speak({ sessionId: lease, messageId, index }));
        return fetches.get(index) as ReturnType<typeof speak>;
      };
      try {
        for (let index = 0; ; index += 1) {
          for (let ahead = 1; ahead <= VOICE_CLIENT_LIMITS.sentencesAhead; ahead += 1) void fetchAt(index + ahead).catch(() => {});
          const result = await fetchAt(index);
          if (!live()) return;
          if (result.status !== "audio") break;
          const url = URL.createObjectURL(new Blob([result.audio], { type: result.mime }));
          audioUrls.current.push(url);
          const player = new Audio(url);
          audio.current = player;
          await new Promise<void>((resolve, reject) => {
            player.onended = () => resolve();
            player.onerror = () => reject(new Error("playback_failed"));
            player.play().catch(reject);
          });
          lastActivity.current = Date.now();
          if (!live()) return;
          if (index + 1 >= result.count) break;
        }
      } catch {
        // Reading aloud failed: the reply is on screen (read-back, L-17); the call keeps listening.
      }
      if (live()) {
        stopPlayback();
        setPhaseBoth("listening");
      }
    },
    [setPhaseBoth, speak, stopPlayback],
  );

  // A new coach reply after a spoken turn: show it and read it aloud.
  useEffect(() => {
    if (!latestReply || !open || !awaitingReply.current) return;
    if (latestReply.createdAt < startedAt.current || spoken.current.has(latestReply.id)) return;
    spoken.current.add(latestReply.id);
    awaitingReply.current = false;
    setLines((current) => [...current, { id: latestReply.id, who: "coach", text: latestReply.content }]);
    void readAloud(latestReply.id);
  }, [latestReply, open, readAloud]);

  const onFinal = useCallback(
    async (text: string) => {
      const gen = generation.current;
      setInterim("");
      setLines((current) => [...current, { id: `you-${Date.now()}`, who: "you", text }]);
      setPhaseBoth("awaitingReply");
      awaitingReply.current = true;
      try {
        const result = await send(text);
        if (gen !== generation.current) return;
        if (result.kind === "crisis") {
          // The fixed crisis card shows in the thread; nothing is spoken and the call ends (L-12).
          end();
          setOpen(false);
          return;
        }
        if (result.kind === "none") {
          awaitingReply.current = false;
          setPhaseBoth("listening");
        }
      } catch {
        if (gen === generation.current) {
          awaitingReply.current = false;
          setPhaseBoth("listening");
        }
      }
    },
    [end, send, setPhaseBoth],
  );

  /** Start: only ever from the person's click (L-1). */
  const start = useCallback(async () => {
    if (!conversationId) return;
    end();
    const gen = generation.current;
    setOpen(true);
    setEnded(false);
    setConnecting(true);
    setLines([]);
    setMicOn(true);
    setPhaseBoth("listening");
    startedAt.current = Date.now();
    lastActivity.current = Date.now();
    try {
      const mime = recorderMime((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
      if (!mime || !navigator.mediaDevices?.getUserMedia) throw new Error("unsupported_transport");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (gen !== generation.current) {
        for (const track of media.getTracks()) track.stop();
        return;
      }
      stream.current = media;
      const lease = await startLease({ conversationId, clientKey: newClientKey() });
      if (gen !== generation.current) return;
      session.current = lease.sessionId;
      setMinutesLeft(lease.minutesLeft);
      const { token, url } = await grant({ sessionId: lease.sessionId });
      if (gen !== generation.current) return;
      const ws = new WebSocket(url, ["bearer", token]);
      socket.current = ws;
      ws.onopen = () => {
        if (gen !== generation.current) return;
        const rec = new MediaRecorder(media, { mimeType: mime });
        recorder.current = rec;
        rec.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(event.data);
        };
        rec.start(VOICE_CLIENT_LIMITS.chunkMs);
        setConnecting(false);
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
        if (!speech) return;
        lastActivity.current = Date.now();
        if (speech.kind === "speechStarted") {
          // Barge-in (L-6): the person talks over the coach, so the coach stops at once.
          if (phaseRef.current === "speaking") {
            stopPlayback();
            setPhaseBoth("listening");
          }
          return;
        }
        if (speech.kind === "interim") {
          if (phaseRef.current === "speaking") {
            stopPlayback();
            setPhaseBoth("listening");
          }
          setInterim(speech.text);
          return;
        }
        void onFinal(speech.text);
      };
      ws.onerror = () => {
        if (gen === generation.current) fail();
      };
      ws.onclose = () => {
        if (gen === generation.current && session.current) fail();
      };
      // Heartbeat (A-3): anything but "ok" ends the call.
      timers.current.push(
        window.setInterval(() => {
          const id = session.current;
          if (!id) return;
          void renewLease({ sessionId: id })
            .then((result) => {
              if (gen !== generation.current) return;
              setMinutesLeft(result.minutesLeft);
              if (result.status !== "ok") end();
            })
            .catch(() => {
              if (gen === generation.current) end();
            });
        }, lease.renewEveryMs),
      );
      // Idle (no speech, no playback) and hidden-page bounds (L-15).
      let hiddenSince = 0;
      timers.current.push(
        window.setInterval(() => {
          if (gen !== generation.current) return;
          const now = Date.now();
          if (document.visibilityState === "hidden") hiddenSince ||= now;
          else hiddenSince = 0;
          const quiet = phaseRef.current !== "speaking" && phaseRef.current !== "awaitingReply";
          if ((quiet && now - lastActivity.current > VOICE_CLIENT_LIMITS.idleMs) || (hiddenSince && now - hiddenSince > VOICE_CLIENT_LIMITS.hiddenMs)) {
            end();
          }
        }, 1_000),
      );
    } catch {
      if (gen === generation.current) fail();
    }
  }, [conversationId, end, fail, grant, onFinal, renewLease, setPhaseBoth, startLease, stopPlayback]);

  /**
   * Mic off mutes the track instead of pausing the recorder: the socket keeps getting (silent)
   * audio, so the speech provider never closes it for lack of data while the person is muted.
   */
  const toggleMic = useCallback(() => {
    const tracks = stream.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) return;
    const on = !tracks.every((track) => track.enabled);
    for (const track of tracks) track.enabled = on;
    setMicOn(on);
    if (on) lastActivity.current = Date.now();
  }, []);

  const interrupt = useCallback(() => {
    if (phaseRef.current !== "speaking") return;
    stopPlayback();
    setPhaseBoth("listening");
  }, [setPhaseBoth, stopPlayback]);

  const close = useCallback(() => {
    end();
    setOpen(false);
  }, [end]);

  // Unmount, sign-out or a conversation switch ends the session (L-13, L-14).
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a conversation change ends the call; `end` is stable enough to read at that moment
  useEffect(() => () => end(), [conversationId]);

  const sessionState: VoiceSessionState = { ...createVoiceSessionState(), phase };
  const shownLines: CallLine[] = interim ? [...lines, { id: "you-live", who: "you", text: interim, live: true }] : lines;
  return {
    open,
    session: sessionState,
    connecting,
    ended,
    micOn,
    lines: shownLines,
    minutesLeft,
    start,
    end,
    close,
    toggleMic,
    interrupt,
  };
}
