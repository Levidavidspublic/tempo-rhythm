import type { SpeechPiece } from "@/convex/lib/studyVoice";
import { VOICE_LIMITS } from "@/convex/lib/voicePolicy";
import type { SpeechHandle } from "./speech";

/**
 * Tempo's voice for the audio recap (Chatterbox on DeepInfra through `studyVoice.speak`). The
 * player reads its sentences one by one; each sentence is one or more pieces (convex/lib/studyVoice.ts
 * builds the same list on the server), and a piece is asked for by its index, never its words.
 *
 * At most `VOICE_LIMITS.sentencesAhead` pieces are requested ahead of the one playing, so a stop
 * wastes little of the day's characters. Audio is kept only as transient bytes for the piece
 * playing and those ahead, played through an <audio> element from an object URL that is revoked
 * as soon as the clip ends, fails or is stopped. Anything that goes wrong reports an error, and the
 * player falls back to the device's own voice (`chooseVoice`).
 */

export type TempoAvailability = { status: "off" | "budget" | "available"; charsLeft: number };

export type TempoPiece =
  | { status: "audio"; audio: ArrayBuffer; mime: string; count: number }
  | { status: "done" }
  | { status: "exhausted" };

/**
 * One clip playing; `cancel` stops it and releases it. `unlock`, where there is one, must be called
 * inside the person's own press (Play, a sentence, the voice choice): iOS Safari lets an <audio>
 * element make sound later, after the clip is fetched, only once it has played during a press.
 */
export type ClipPlayer = ((
  clip: { bytes: ArrayBuffer; mime: string },
  options: { rate: number; onEnd: () => void; onError: () => void },
) => SpeechHandle) & { unlock?: () => void };

/** What the listen screen hands the player when Tempo's voice may be used. */
export type TempoVoiceSource = {
  /** `studyVoice.availability`; undefined while it loads. */
  availability: TempoAvailability | undefined;
  online: boolean;
  /** `studyVoice.speak` for piece `index` of this page's reading. */
  fetchPiece: (index: number) => Promise<TempoPiece>;
  /** Another clip player than the browser's <audio> (tests, the gallery). */
  play?: ClipPlayer;
};

export type VoicePick = "tempo" | "device";
/** Why Tempo's voice stopped for this visit: a failure, or today's characters ran out. */
export type TempoDown = "error" | "budget" | null;
export type VoiceNote = "error" | "budget" | "offline" | null;

/**
 * Which voice reads, whether the choice between the two is offered, and the status line. Tempo's
 * voice only when the deployment has it, there are characters left, the browser is online, it
 * hasn't failed on this visit, and the person didn't pick the device's voice.
 */
export function chooseVoice({
  source,
  pick,
  down,
}: {
  source: Pick<TempoVoiceSource, "availability" | "online"> | undefined;
  pick: VoicePick;
  down: TempoDown;
}): { voice: VoicePick; offered: boolean; note: VoiceNote } {
  if (!source) return { voice: "device", offered: false, note: null };
  const status = source.availability?.status;
  const offered = status === "available" && source.online && down === null;
  const note: VoiceNote = down ?? (status === "budget" ? "budget" : status === "available" && !source.online ? "offline" : null);
  return { voice: offered && pick === "tempo" ? "tempo" : "device", offered, note };
}

/** The pieces of reading sentence `at`, by index into `pieces`. */
export function piecesAt(pieces: readonly SpeechPiece[], at: number): number[] {
  const out: number[] = [];
  pieces.forEach((piece, index) => {
    if (piece.at === at) out.push(index);
  });
  return out;
}

/** The piece playing and the ones requested ahead of it: `piece` to `piece + ahead`, within the reading. */
export function windowFrom(piece: number, total: number, ahead: number = VOICE_LIMITS.sentencesAhead): number[] {
  const out: number[] = [];
  for (let index = piece; index <= piece + ahead && index < total; index += 1) out.push(index);
  return out;
}

export type TempoReader = {
  /** Reads sentence `at`: its pieces in order, then `onEnd`. `onError` once on any failure. */
  speak(
    at: number,
    options: { rate: number; onEnd: () => void; onError: (reason: "error" | "exhausted") => void },
  ): SpeechHandle;
  /** Drops every clip held, for unmount or a new page. */
  dispose(): void;
};

export function createTempoReader({
  pieces,
  fetchPiece,
  play,
  ahead = VOICE_LIMITS.sentencesAhead,
}: {
  pieces: readonly SpeechPiece[];
  fetchPiece: (index: number) => Promise<TempoPiece>;
  play: ClipPlayer;
  ahead?: number;
}): TempoReader {
  const held = new Map<number, Promise<TempoPiece>>();
  const get = (index: number) => {
    let pending = held.get(index);
    if (!pending) {
      pending = fetchPiece(index);
      // Read by whoever plays it; a piece dropped from the window never warns.
      pending.catch(() => {});
      held.set(index, pending);
    }
    return pending;
  };
  /** Keep only `piece` and the ones ahead of it, asking for any not yet asked for. */
  const hold = (piece: number) => {
    const wanted = windowFrom(piece, pieces.length, ahead);
    for (const index of held.keys()) if (!wanted.includes(index)) held.delete(index);
    for (const index of wanted) get(index);
  };

  return {
    speak(at, { rate, onEnd, onError }) {
      const list = piecesAt(pieces, at);
      let stopped = false;
      let clip: SpeechHandle | null = null;
      const fail = (reason: "error" | "exhausted") => {
        if (stopped) return;
        stopped = true;
        onError(reason);
      };
      const step = async (k: number) => {
        if (stopped) return;
        const index = list[k];
        if (index === undefined) {
          stopped = true;
          onEnd();
          return;
        }
        hold(index);
        let result: TempoPiece;
        try {
          result = await get(index);
        } catch {
          fail("error");
          return;
        }
        if (stopped) return;
        if (result.status === "exhausted") return fail("exhausted");
        // The page got shorter than the player's copy: nothing left to read here.
        if (result.status === "done") {
          stopped = true;
          onEnd();
          return;
        }
        clip = play(
          { bytes: result.audio, mime: result.mime },
          { rate, onEnd: () => void step(k + 1), onError: () => fail("error") },
        );
      };
      void step(0);
      return {
        cancel() {
          stopped = true;
          clip?.cancel();
          clip = null;
        },
      };
    },
    dispose() {
      held.clear();
    },
  };
}

/** The parts of HTMLAudioElement a clip uses. */
export type AudioLike = {
  src: string;
  playbackRate: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
  play(): Promise<void> | void;
  pause(): void;
  removeAttribute(name: string): void;
};

/** A few samples of silence (8 kHz, 8-bit WAV), played once inside a press to unlock the element. */
export const SILENT_CLIP = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";

/**
 * A clip player over one reused <audio> element and object URLs (one element, so the press that
 * unlocked it covers every clip after). Exported for tests; the app uses `browserClipPlayer`.
 */
export function createClipPlayer(env: {
  makeAudio: () => AudioLike;
  createUrl: (blob: Blob) => string;
  revokeUrl: (url: string) => void;
}): ClipPlayer {
  let element: AudioLike | null = null;
  let unlocked = false;
  /** The clip that owns the element now; a new clip or `unlock` releases it first. */
  let current: (() => boolean) | null = null;
  const audioElement = () => {
    element ??= env.makeAudio();
    return element;
  };
  const player: ClipPlayer = (clip, { rate, onEnd, onError }) => {
    current?.();
    const url = env.createUrl(new Blob([clip.bytes], { type: clip.mime }));
    const audio = audioElement();
    let released = false;
    const release = () => {
      if (released) return false;
      released = true;
      if (current === release) current = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      env.revokeUrl(url);
      return true;
    };
    audio.onended = () => {
      if (release()) onEnd();
    };
    audio.onerror = () => {
      if (release()) onError();
    };
    current = release;
    audio.src = url;
    audio.playbackRate = rate;
    try {
      Promise.resolve(audio.play()).catch(() => {
        if (release()) onError();
      });
    } catch {
      if (release()) onError();
    }
    return { cancel: () => void release() };
  };
  player.unlock = () => {
    if (unlocked || current) return;
    unlocked = true;
    const audio = audioElement();
    audio.src = SILENT_CLIP;
    try {
      Promise.resolve(audio.play())
        .then(() => {
          if (current) return;
          audio.pause();
          audio.removeAttribute("src");
        })
        .catch(() => {
          // Not unlocked after all (no sound device, or refused): the next press tries again.
          unlocked = false;
        });
    } catch {
      unlocked = false;
    }
  };
  return player;
}

/** The browser's <audio> clip player, or null where there is none (the server, old browsers). */
export function browserClipPlayer(): ClipPlayer | null {
  const scope = globalThis as unknown as { Audio?: new () => AudioLike; URL?: typeof URL };
  const AudioElement = scope.Audio;
  const Url = scope.URL;
  if (!AudioElement || !Url?.createObjectURL) return null;
  return createClipPlayer({
    makeAudio: () => new AudioElement(),
    createUrl: (blob) => Url.createObjectURL(blob),
    revokeUrl: (url) => Url.revokeObjectURL(url),
  });
}
