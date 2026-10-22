"use client";

import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  acceptsSpokenTurn,
  isTurnReply,
  newClientKey,
  recorderMime,
  sendSpokenTurn,
  speechEvent,
  VOICE_CLIENT_LIMITS,
} from "@/lib/voice-runtime";
import type { CallLine } from "./VoiceCall";
import type { VoiceSessionState } from "./voiceSession";
import { createVoiceSessionState } from "./voiceSession";

type Phase = VoiceSessionState["phase"];

/** What sending a spoken turn did: the reply message to read aloud, a crisis, or nothing. */
export type VoiceSendResult = { kind: "reply" } | { kind: "crisis" } | { kind: "none" };

/** A coach reply the call may read aloud (the newest assistant message in the thread). */
export type VoiceReply = { id: Id<"messages">; content: string } | null;

export type AgentTurn = {
  sessionId: Id<"voiceSessions">;
  functionId: string;
  receipt: string;
  text: string;
  signal: AbortSignal;
};
export type AgentTurnResult = { kind: "reply" | "done" | "crisis" | "none" };
/** Page save and scope fences are shared by the mounted callback and deterministic tests. */
export async function runAgentCoachTurn(
  turn: AgentTurn,
  ports: {
    live: () => boolean;
    flush: () => Promise<void>;
    begin: () => Promise<
      | { status: "ready"; requestId: string; replyTo: Id<"messages"> }
      | { status: "busy" | "cancelled" | "done" | "crisis" }
    >;
    reply: (key: { requestId: string; replyTo: Id<"messages"> }) => Promise<{ status: string }>;
    complete: (key: { requestId: string; replyTo: Id<"messages"> }) => Promise<{ status: string }>;
    cancel: () => Promise<unknown>;
  }
): Promise<AgentTurnResult> {
  const live = () => !turn.signal.aborted && ports.live();
  let complete = false;
  const abort = () => {
    void ports.cancel().catch(() => {});
  };
  turn.signal.addEventListener("abort", abort, { once: true });
  try {
    if (!live()) return { kind: "none" };
    await ports.flush();
    if (!live()) return { kind: "none" };
    const admitted = await ports.begin();
    if (!live()) return { kind: "none" };
    if (admitted.status === "crisis") return { kind: "crisis" };
    if (admitted.status === "done") {
      complete = true;
      return { kind: "done" };
    }
    if (admitted.status !== "ready") return { kind: "none" };
    const key = { requestId: admitted.requestId, replyTo: admitted.replyTo };
    const reply = await ports.reply(key);
    if (!live() || reply.status !== "replied") return { kind: "none" };
    const result = await ports.complete(key);
    if (!live() || result.status !== "ready") return { kind: "none" };
    complete = true;
    return { kind: "reply" };
  } finally {
    turn.signal.removeEventListener("abort", abort);
    if (!complete) await ports.cancel().catch(() => {});
  }
}

type AgentConfig = { enabled: false } | { enabled: true; model: string; endpoint: string };
const AGENT_SOCKET = "wss://agent.deepgram.com/v1/agent/converse";
const FUNCTION_NAME = "tempo_coach_reply";
const FUNCTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function agentObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** No configurable external callback origin: credentials stay on this deployment's HTTPS site. */
export function voiceSiteUrl(deployment: string | undefined): string | null {
  try {
    const url = new URL(deployment ?? "");
    if (
      url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.convex\.cloud$/.test(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return `https://${url.hostname.replace(/\.convex\.cloud$/, ".convex.site")}`;
  } catch {
    return null;
  }
}
export function agentSettings(
  config: Extract<AgentConfig, { enabled: true }>,
  sampleRate: number,
  sessionId: string,
  capability: string
) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 96_000)
    throw new Error("unsupported_audio");
  return {
    type: "Settings",
    flags: { history: false },
    audio: {
      input: { encoding: "linear16", sample_rate: sampleRate },
      output: { encoding: "linear16", sample_rate: 24_000, container: "none" },
    },
    agent: {
      language: "en",
      listen: {
        provider: { type: "deepgram", version: "v2", model: "flux-general-en" },
      },
      speak: {
        provider: { type: "deepgram", version: "v2", model: "flux-kit-en" },
      },
      think: {
        provider: { type: "open_ai", model: config.model },
        endpoint: {
          url: config.endpoint,
          headers: {
            Authorization: `Bearer ${capability}`,
            "X-Tempo-Voice-Session": sessionId,
          },
        },
        context_length: "max",
        functions: [
          {
            name: FUNCTION_NAME,
            description: "Ask the Tempo coach after the person finishes speaking.",
            defer_until_eot: true,
            parameters: {
              type: "object",
              properties: {
                text: { type: "string" },
                receipt: { type: "string" },
              },
              required: ["text", "receipt"],
              additionalProperties: false,
            },
          },
        ],
      },
    },
  };
}
/** Raw signed little-endian PCM, never MediaRecorder/WebM bytes. */
export function decodeAgentPcm(bytes: ArrayBuffer): Float32Array {
  if (bytes.byteLength === 0 || bytes.byteLength % 2 !== 0 || bytes.byteLength > 192_000)
    throw new Error("invalid_audio");
  const view = new DataView(bytes);
  const samples = new Float32Array(bytes.byteLength / 2);
  for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}
/** Testable protocol state machine. Backend receipts remain the durable authority. */
export function createAgentProtocol(deps: {
  sessionId: Id<"voiceSessions">;
  settings: ReturnType<typeof agentSettings>;
  send: (value: string) => void;
  run: (turn: AgentTurn) => Promise<AgentTurnResult>;
  cancel: (functionId: string) => Promise<unknown>;
  clearAudio: () => void;
  play: (pcm: Float32Array) => void;
  ready: () => void;
  phase: (phase: Phase) => void;
  activity: () => void;
  line: (who: "you" | "coach", text: string, id: string) => void;
  fail: () => void;
  crisis: () => void;
  ended: () => void;
}) {
  let state: "welcome" | "settings" | "active" | "closed" = "welcome";
  let audioAllowed = false;
  const calls = new Map<
    string,
    {
      timeout?: ReturnType<typeof setTimeout>;
      controller: AbortController;
      state: "running" | "done" | "cancelled";
      signature?: string;
    }
  >();
  const cancel = (id: string) => {
    const call = calls.get(id);
    if (call?.state === "cancelled") return;
    if (call?.timeout) clearTimeout(call.timeout);
    call?.controller.abort();
    if (call) call.state = "cancelled";
    else if (calls.size < 128)
      calls.set(id, { controller: new AbortController(), state: "cancelled" });
    void deps.cancel(id).catch(() => {
      if (state !== "closed") deps.fail();
    });
  };
  const clear = () => {
    audioAllowed = false;
    deps.clearAudio();
  };
  const stop = () => {
    state = "closed";
    clear();
    for (const call of calls.values()) {
      if (call.timeout) clearTimeout(call.timeout);
      call.controller.abort();
    }
    calls.clear();
  };
  const interrupted = () => {
    clear();
    let cancelled = false;
    for (const [id, call] of calls)
      if (call.state === "running") {
        cancelled = true;
        cancel(id);
      }
    // A cancelled receipt is terminal and has no completed-parent anchor. A new explicit
    // Start is required; do not leave a listening UI on a lease that cannot admit a turn.
    if (cancelled) {
      stop();
      deps.ended();
      return;
    }
    if (state === "active") deps.phase("listening");
  };
  const response = (id: string, signature?: string) =>
    deps.send(
      JSON.stringify({
        type: "FunctionCallResponse",
        id,
        name: FUNCTION_NAME,
        content: JSON.stringify({ receipt: id }),
        ...(signature ? { thought_signature: signature } : {}),
      })
    );
  const receive = (data: unknown) => {
    if (state === "closed") return;
    try {
      if (data instanceof ArrayBuffer) {
        if (state !== "active") throw new Error("early_audio");
        if (audioAllowed) {
          deps.play(decodeAgentPcm(data));
          deps.activity();
        }
        return;
      }
      if (typeof data !== "string" || data.length > 65_536) throw new Error("invalid_event");
      const event: unknown = JSON.parse(data);
      if (!agentObject(event) || typeof event.type !== "string") throw new Error("invalid_event");
      if (event.type === "Welcome") {
        if (state !== "welcome") throw new Error("duplicate_welcome");
        state = "settings";
        deps.send(JSON.stringify(deps.settings));
        return;
      }
      if (event.type === "SettingsApplied") {
        if (state !== "settings") throw new Error("unexpected_settings");
        state = "active";
        deps.ready();
        return;
      }
      if (state !== "active") throw new Error("unconfigured_event");
      if (event.type === "LatencyReport") {
        // Documented passive telemetry uses decimal strings. Never log it or treat it as
        // conversation activity/context; an automatic report must not extend the idle timer.
        const fields = [
          "stt_latency",
          "ttt_token_latency",
          "ttt_text_latency",
          "ttt_tool_latency",
          "ttt_thinking_latency",
          "tts_latency",
          "total_latency",
        ];
        for (const [key, value] of Object.entries(event)) {
          if (key === "type") continue;
          if (
            !fields.includes(key) ||
            typeof value !== "string" ||
            value.length > 32 ||
            !/^\d+(\.\d+)?$/.test(value) ||
            !Number.isFinite(Number(value))
          )
            throw new Error("invalid_latency");
        }
        return;
      }
      deps.activity();
      if (event.type === "UserStartedSpeaking") {
        interrupted();
        return;
      }
      if (event.type === "FunctionCallCancelled") {
        if (
          !Array.isArray(event.functions) ||
          event.functions.length === 0 ||
          event.functions.length > 128
        )
          throw new Error("invalid_cancel");
        clear();
        for (const value of event.functions) {
          if (
            !agentObject(value) ||
            value.name !== FUNCTION_NAME ||
            typeof value.id !== "string" ||
            !FUNCTION_ID.test(value.id)
          )
            throw new Error("invalid_cancel");
          cancel(value.id);
        }
        stop();
        deps.ended();
        return;
      }
      if (event.type === "FunctionCallRequest") {
        if (!Array.isArray(event.functions) || event.functions.length !== 1)
          throw new Error("invalid_function");
        const value: unknown = event.functions[0];
        if (
          !agentObject(value) ||
          value.name !== FUNCTION_NAME ||
          value.client_side !== true ||
          typeof value.id !== "string" ||
          !FUNCTION_ID.test(value.id) ||
          typeof value.arguments !== "string" ||
          value.arguments.length > 24_000 ||
          (value.thought_signature !== undefined &&
            (typeof value.thought_signature !== "string" || value.thought_signature.length > 2_048))
        )
          throw new Error("invalid_function");
        const args: unknown = JSON.parse(value.arguments);
        if (
          !agentObject(args) ||
          Object.keys(args).sort().join(",") !== "receipt,text" ||
          typeof args.text !== "string" ||
          !args.text.trim() ||
          args.text.length > 4_000 ||
          typeof args.receipt !== "string" ||
          !/^[0-9a-f]{64}$/i.test(args.receipt)
        )
          throw new Error("invalid_arguments");
        const existing = calls.get(value.id);
        // A duplicate event cannot run the coach again; conflicting payloads are checked by
        // the durable admission on first delivery. Completed frames replay only the opaque ID.
        if (existing) {
          if (existing.state === "done") response(value.id, existing.signature);
          return;
        }
        if (calls.size >= 128 || [...calls.values()].some((call) => call.state === "running"))
          throw new Error("concurrent_function");
        clear();
        const id = value.id;
        const call = {
          timeout: undefined as ReturnType<typeof setTimeout> | undefined,
          controller: new AbortController(),
          state: "running" as "running" | "done" | "cancelled",
          ...(typeof value.thought_signature === "string"
            ? { signature: value.thought_signature }
            : {}),
        };
        calls.set(id, call);
        call.timeout = setTimeout(() => {
          if (state !== "closed" && call.state === "running") {
            cancel(id);
            stop();
            deps.ended();
          }
        }, 10 * 60_000);
        deps.line("you", args.text, id);
        deps.phase("awaitingReply");
        void deps
          .run({
            sessionId: deps.sessionId,
            functionId: id,
            receipt: args.receipt,
            text: args.text,
            signal: call.controller.signal,
          })
          .then((result) => {
            if (call.timeout) clearTimeout(call.timeout);
            if (state === "closed" || call.controller.signal.aborted || call.state !== "running")
              return;
            if (result.kind === "crisis") {
              stop();
              deps.crisis();
              return;
            }
            if (result.kind !== "reply" && result.kind !== "done") {
              stop();
              deps.fail();
              return;
            }
            call.state = "done";
            audioAllowed = true;
            response(id, call.signature);
          })
          .catch(() => {
            if (state !== "closed" && !call.controller.signal.aborted) {
              stop();
              deps.fail();
            }
          });
        return;
      }
      if (event.type === "ConversationText") {
        // Transcript display is not a source of coach context or result identity.
        if (
          (event.role !== "user" && event.role !== "assistant") ||
          typeof event.content !== "string" ||
          event.content.length > 20_000
        )
          throw new Error("invalid_transcript");
        if (event.role === "assistant" && audioAllowed)
          deps.line("coach", event.content, `spoken-${calls.size}`);
        return;
      }
      if (event.type === "AgentStartedSpeaking") {
        if (audioAllowed) deps.phase("speaking");
        return;
      }
      if (event.type === "AgentAudioDone") return; // Scheduled PCM drains before listening resumes.
      if (event.type === "AgentThinking") return;
      // Warnings/errors and protocol extensions require explicit review, never silent fallbacks.
      throw new Error("unsupported_event");
    } catch {
      stop();
      deps.fail();
    }
  };
  return {
    receive,
    stop,
    interrupt: interrupted,
    active: () => state === "active",
  };
}

// AudioWorklet executes off the main thread; only PCM buffers cross the port. Muting the source
// track supplies silence. No audio is stored, uploaded over HTTP or placed in a transcript.
const PCM_WORKLET = `class TempoPcm extends AudioWorkletProcessor {
  constructor() { super(); this.bytes = new ArrayBuffer(Math.round(sampleRate / 50) * 2); this.offset = 0; }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (samples) for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      new DataView(this.bytes).setInt16(this.offset, Math.round(sample < 0 ? sample * 32768 : sample * 32767), true);
      this.offset += 2;
      if (this.offset === this.bytes.byteLength) {
        this.port.postMessage(this.bytes, [this.bytes]);
        this.bytes = new ArrayBuffer(Math.round(sampleRate / 50) * 2); this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("tempo-pcm", TempoPcm);`;

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
  replyInFlight = false,
  sendAgent,
  scopeKey,
}: {
  conversationId: Id<"conversations"> | null;
  send: (text: string) => Promise<VoiceSendResult>;
  sendAgent?: (turn: AgentTurn) => Promise<AgentTurnResult>;
  scopeKey?: string;
  latestReply: VoiceReply;
  /** A reply is running for this conversation, asked for here or on another surface or tab. */
  replyInFlight?: boolean;
}) {
  const startLease = useMutation(api.voice.start);
  const renewLease = useMutation(api.voice.renew);
  const stopLease = useMutation(api.voice.stop);
  const grant = useAction(api.voice.grant);
  const speak = useAction(api.voice.speak);
  const agentCapability = useMutation(api.voice.agentCapability);
  const cancelAgentTurn = useMutation(api.voice.cancelAgentTurn);

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
  const agentProtocol = useRef<ReturnType<typeof createAgentProtocol> | null>(null);
  const pcmContext = useRef<AudioContext | null>(null);
  const pcmCapture = useRef<AudioWorkletNode | null>(null);
  const pcmInput = useRef<MediaStreamAudioSourceNode | null>(null);
  const pcmSources = useRef(new Set<AudioBufferSourceNode>());
  const pcmUntil = useRef(0);
  const configAbort = useRef<AbortController | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrls = useRef<string[]>([]);
  const timers = useRef<number[]>([]);
  const lastActivity = useRef(0);
  const awaitingReply = useRef(false);
  // Set once `send` says this turn's reply was written: only then is a new coach message its answer.
  const replyReady = useRef(false);
  const inFlight = useRef(replyInFlight);
  inFlight.current = replyInFlight;
  // The newest committed `send`: the socket's handler outlives renders, and a spoken turn must use
  // the page open now, not the one open when the call started (Codex on #948). Set after commit, so
  // a render React throws away never points the call at a page that isn't on screen.
  const sendRef = useRef(send);
  const sendAgentRef = useRef(sendAgent);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  useEffect(() => {
    sendAgentRef.current = sendAgent;
  }, [sendAgent]);
  // The newest coach reply when the pending turn was sent: the answer is the next one after it,
  // matched by id, never by comparing the server's clock with this device's.
  const replyBefore = useRef<Id<"messages"> | null>(null);
  const latest = useRef<VoiceReply>(latestReply);
  latest.current = latestReply;
  const spoken = useRef(new Set<string>());
  const phaseRef = useRef<Phase>("idle");
  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const stopPlayback = useCallback(() => {
    speechGeneration.current += 1;
    for (const source of pcmSources.current) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    pcmSources.current.clear();
    pcmUntil.current = 0;
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
    agentProtocol.current?.stop();
    agentProtocol.current = null;
    configAbort.current?.abort();
    configAbort.current = null;
    stopPlayback();
    pcmCapture.current?.disconnect();
    if (pcmCapture.current) {
      pcmCapture.current.port.onmessage = null;
      pcmCapture.current.port.close();
      pcmCapture.current.onprocessorerror = null;
    }
    pcmCapture.current = null;
    pcmInput.current?.disconnect();
    pcmInput.current = null;
    if (pcmContext.current) void pcmContext.current.close().catch(() => {});
    pcmContext.current = null;
    awaitingReply.current = false;
    replyReady.current = false;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    recorder.current = null;
    for (const track of stream.current?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
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
          for (let ahead = 1; ahead <= VOICE_CLIENT_LIMITS.sentencesAhead; ahead += 1)
            void fetchAt(index + ahead).catch(() => {});
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
    [setPhaseBoth, speak, stopPlayback]
  );

  // The answer to a spoken turn: the newest coach reply once `send` says this turn's reply was
  // written, and never the one that was newest when the turn was sent. Waiting for `send` keeps
  // another client's reply, landing while this turn's model call runs, from being read as its own.
  const pickReply = useCallback(() => {
    const reply = latest.current;
    const turn = {
      awaiting: awaitingReply.current,
      ready: replyReady.current,
      before: replyBefore.current,
      spoken: spoken.current,
    };
    if (!reply || !isTurnReply(reply.id, turn)) return;
    spoken.current.add(reply.id);
    awaitingReply.current = false;
    replyReady.current = false;
    setLines((current) => [...current, { id: reply.id, who: "coach", text: reply.content }]);
    void readAloud(reply.id);
  }, [readAloud]);

  // The written reply can reach this client before or after `send` returns: try again when it does.
  useEffect(() => {
    if (open && latestReply && !agentProtocol.current) pickReply();
  }, [latestReply, open, pickReply]);

  const onFinal = useCallback(
    async (text: string) => {
      const gen = generation.current;
      setInterim("");
      // One turn at a time: words while the coach is still answering, here or for another surface,
      // aren't sent (a newer message would make the running reply's answer be dropped, and start a
      // second model call). Talking over the reply once it plays still interrupts it.
      if (
        !acceptsSpokenTurn({
          awaiting: awaitingReply.current,
          replyInFlight: inFlight.current,
        })
      )
        return;
      const lease = session.current;
      if (!lease) return;
      const lineId = `you-${Date.now()}`;
      setLines((current) => [...current, { id: lineId, who: "you", text }]);
      setPhaseBoth("awaitingReply");
      replyBefore.current = latest.current?.id ?? null;
      awaitingReply.current = true;
      replyReady.current = false;
      try {
        const turn = await sendSpokenTurn(text, {
          renew: () => renewLease({ sessionId: lease }),
          // Ended or replaced while the lease was being checked: the words are not sent.
          send: (words) =>
            gen === generation.current
              ? sendRef.current(words)
              : Promise.reject(new Error("call_ended")),
        });
        if (gen !== generation.current) return;
        if (turn.kind === "leaseEnded") {
          // Replaced by a call in another tab or surface, or the lease ran out: this call ends.
          end();
          return;
        }
        if (turn.kind === "notSent") {
          // The words didn't go out: the call says so on their line and keeps listening.
          setLines((current) =>
            current.map((line) => (line.id === lineId ? { ...line, notSent: true } : line))
          );
          awaitingReply.current = false;
          setPhaseBoth("listening");
          return;
        }
        setMinutesLeft(turn.minutesLeft);
        const result = turn.result;
        if (result.kind === "reply") {
          replyReady.current = true;
          pickReply();
          return;
        }
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
    [end, pickReply, renewLease, setPhaseBoth]
  );

  /** Configure raw PCM only after Welcome/SettingsApplied; no speculative audio or greeting. */
  const startAgent = useCallback(
    async (
      config: Extract<AgentConfig, { enabled: true }>,
      media: MediaStream,
      leaseId: Id<"voiceSessions">,
      token: string,
      gen: number
    ) => {
      const context = pcmContext.current;
      if (!context?.audioWorklet || !sendAgentRef.current) throw new Error("unsupported_agent");
      const live = () => gen === generation.current;
      const { capability } = await agentCapability({ sessionId: leaseId });
      if (!live()) return;
      const moduleUrl = URL.createObjectURL(new Blob([PCM_WORKLET], { type: "text/javascript" }));
      try {
        await context.audioWorklet.addModule(moduleUrl);
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }
      if (!live()) return;
      const input = context.createMediaStreamSource(media);
      const capture = new AudioWorkletNode(context, "tempo-pcm", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      pcmInput.current = input;
      pcmCapture.current = capture;
      const ws = new WebSocket(AGENT_SOCKET, ["bearer", token]);
      ws.binaryType = "arraybuffer";
      socket.current = ws;
      let handshake: number;
      const protocol = createAgentProtocol({
        sessionId: leaseId,
        settings: agentSettings(config, context.sampleRate, leaseId, capability),
        send: (value) => {
          if (!live() || ws.readyState !== WebSocket.OPEN) throw new Error("socket_closed");
          ws.send(value);
        },
        run: (turn) =>
          sendAgentRef.current ? sendAgentRef.current(turn) : Promise.resolve({ kind: "none" }),
        cancel: (functionId) => cancelAgentTurn({ sessionId: leaseId, functionId }),
        clearAudio: stopPlayback,
        play: (samples) => {
          if (!live() || context.state !== "running") throw new Error("audio_unavailable");
          const now = context.currentTime;
          // Bound scheduled audio, so a provider flood cannot accumulate minutes of playback.
          if (
            Math.max(now, pcmUntil.current) - now + samples.length / 24_000 > 8 ||
            pcmSources.current.size >= 128
          )
            throw new Error("audio_backpressure");
          const buffer = context.createBuffer(1, samples.length, 24_000);
          buffer.getChannelData(0).set(samples);
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          pcmSources.current.add(source);
          const startAt = Math.max(now, pcmUntil.current);
          pcmUntil.current = startAt + buffer.duration;
          source.onended = () => {
            pcmSources.current.delete(source);
            source.disconnect();
            if (live() && pcmSources.current.size === 0 && phaseRef.current === "speaking")
              setPhaseBoth("listening");
          };
          source.start(startAt);
          setPhaseBoth("speaking");
        },
        ready: () => {
          window.clearTimeout(handshake);
          if (!live()) return;
          input.connect(capture);
          setConnecting(false);
        },
        phase: setPhaseBoth,
        activity: () => {
          lastActivity.current = Date.now();
        },
        line: (who, text, id) =>
          setLines((current) =>
            [...current.filter((line) => line.id !== id), { id, who, text }].slice(-128)
          ),
        fail,
        crisis: () => {
          end();
          setOpen(false);
        },
        ended: end,
      });
      agentProtocol.current = protocol;
      capture.port.onmessage = (event: MessageEvent<unknown>) => {
        if (!live() || !protocol.active() || ws.readyState !== WebSocket.OPEN) return;
        if (
          !(event.data instanceof ArrayBuffer) ||
          event.data.byteLength > 16_384 ||
          ws.bufferedAmount > 256_000
        ) {
          fail();
          return;
        }
        ws.send(event.data);
      };
      capture.onprocessorerror = () => {
        if (live()) fail();
      };
      ws.onmessage = (event) => {
        if (live()) protocol.receive(event.data);
      };
      ws.onerror = () => {
        if (live()) fail();
      };
      ws.onclose = () => {
        if (live()) fail();
      };
      handshake = window.setTimeout(() => {
        if (live() && !protocol.active()) fail();
      }, 15_000);
      timers.current.push(handshake);
    },
    [agentCapability, cancelAgentTurn, end, fail, setPhaseBoth, stopPlayback]
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
    lastActivity.current = Date.now();
    try {
      // Resume during the deliberate Start gesture, before any network await. It is closed
      // immediately for the legacy path; AudioContext is optional there.
      if (typeof AudioContext !== "undefined") {
        const context = new AudioContext();
        pcmContext.current = context;
        await context.resume();
        if (gen !== generation.current) {
          await context.close().catch(() => {});
          return;
        }
      }
      let agentConfig: AgentConfig = { enabled: false };
      const site = voiceSiteUrl(process.env.NEXT_PUBLIC_CONVEX_URL);
      if (site && sendAgentRef.current) {
        const controller = new AbortController();
        configAbort.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), 5_000);
        try {
          const response = await fetch(site + "/voice/agent/config", {
            signal: controller.signal,
            credentials: "omit",
            cache: "no-store",
          });
          if (!response.ok) throw new Error("agent_config_unavailable");
          const config: unknown = await response.json();
          if (!agentObject(config) || typeof config.enabled !== "boolean")
            throw new Error("invalid_config");
          if (config.enabled) {
            if (
              typeof config.model !== "string" ||
              config.model.length === 0 ||
              config.model.length > 200 ||
              config.endpoint !== site + "/voice/agent/think"
            )
              throw new Error("invalid_config");
            agentConfig = {
              enabled: true,
              model: config.model,
              endpoint: config.endpoint,
            };
          }
        } finally {
          window.clearTimeout(timeout);
          if (configAbort.current === controller) configAbort.current = null;
        }
        if (gen !== generation.current) return;
      }
      if (!agentConfig.enabled && pcmContext.current) {
        await pcmContext.current.close();
        pcmContext.current = null;
      }
      const mime = recorderMime(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
      );
      if (
        (agentConfig.enabled && !pcmContext.current?.audioWorklet) ||
        (!agentConfig.enabled && !mime) ||
        !navigator.mediaDevices?.getUserMedia
      )
        throw new Error("unsupported_transport");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (gen !== generation.current) {
        for (const track of media.getTracks()) track.stop();
        return;
      }
      stream.current = media;
      for (const track of media.getAudioTracks())
        track.onended = () => {
          if (gen === generation.current) fail();
        };
      const lease = await startLease({
        conversationId,
        clientKey: newClientKey(),
      });
      if (gen !== generation.current) {
        // Ended while the lease was being made: stop it, or it lingers and counts against today.
        void stopLease({ sessionId: lease.sessionId }).catch(() => {});
        return;
      }
      session.current = lease.sessionId;
      setMinutesLeft(lease.minutesLeft);
      if (agentConfig.enabled && lease.language !== "en") throw new Error("unsupported_language");
      const { token, url } = await grant({ sessionId: lease.sessionId });
      if (gen !== generation.current) return;
      if (agentConfig.enabled) {
        await startAgent(agentConfig, media, lease.sessionId, token, gen);
        if (gen !== generation.current) return;
      } else {
        if (!mime) throw new Error("unsupported_transport");
        const ws = new WebSocket(url, ["bearer", token]);
        socket.current = ws;
        ws.onopen = () => {
          if (gen !== generation.current) return;
          const rec = new MediaRecorder(media, { mimeType: mime });
          recorder.current = rec;
          rec.ondataavailable = (event) => {
            if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(event.data);
          };
          // A recorder that errors or stops on its own (the microphone removed, access withdrawn)
          // sends no more audio: end the call rather than listen to nothing until the idle bound.
          rec.onerror = () => {
            if (gen === generation.current) fail();
          };
          rec.onstop = () => {
            if (gen === generation.current && recorder.current === rec) fail();
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
      }
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
        }, lease.renewEveryMs)
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
          if (
            (quiet && now - lastActivity.current > VOICE_CLIENT_LIMITS.idleMs) ||
            (hiddenSince && now - hiddenSince > VOICE_CLIENT_LIMITS.hiddenMs)
          ) {
            end();
          }
        }, 1_000)
      );
    } catch {
      if (gen === generation.current) fail();
    }
  }, [
    conversationId,
    end,
    fail,
    grant,
    onFinal,
    renewLease,
    setPhaseBoth,
    startAgent,
    startLease,
    stopLease,
    stopPlayback,
  ]);

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
    if (agentProtocol.current) {
      agentProtocol.current.interrupt();
      return;
    }
    if (phaseRef.current !== "speaking") return;
    stopPlayback();
    setPhaseBoth("listening");
  }, [setPhaseBoth, stopPlayback]);

  const close = useCallback(() => {
    end();
    setOpen(false);
  }, [end]);

  // Unmount, sign-out or a conversation switch ends the session (L-13, L-14).
  // biome-ignore lint/correctness/useExhaustiveDependencies: only an account/page/conversation scope change ends the call; `end` is read at cleanup
  useEffect(() => () => end(), [conversationId, scopeKey]);

  const sessionState: VoiceSessionState = {
    ...createVoiceSessionState(),
    phase,
  };
  const shownLines: CallLine[] = interim
    ? [...lines, { id: "you-live", who: "you", text: interim, live: true }]
    : lines;
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
