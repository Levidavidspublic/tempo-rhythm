import { skip, type TimelineEntry } from "../../../../../packages/core/recap";

/**
 * S16 AudioRecapPlayer state (kitchen T4), pure so the tests can drive it. The player reads one
 * sentence at a time; Back / Forward and a transcript click move by sentence, using the estimated
 * timeline. Resuming starts the current sentence again (browsers can't resume mid-sentence
 * reliably).
 */

export const RATES = [0.75, 1, 1.25, 1.5, 2] as const;
export type Rate = (typeof RATES)[number];
export const BACK_SECONDS = 15;
export const FORWARD_SECONDS = 30;

export type ListenMode = "recap" | "full";

export type PlayerState = { index: number; playing: boolean; ended: boolean; rate: Rate };

export type PlayerAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "jump"; index: number }
  | { type: "skip"; seconds: number; timeline: readonly TimelineEntry[] }
  /** The current sentence was read to the end. */
  | { type: "sentenceEnd"; count: number }
  | { type: "rate"; rate: Rate };

export const initialPlayer: PlayerState = { index: 0, playing: false, ended: false, rate: 1 };

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "play":
      return state.ended ? { ...state, index: 0, playing: true, ended: false } : { ...state, playing: true };
    case "pause":
      return state.playing ? { ...state, playing: false } : state;
    case "jump":
      return { ...state, index: Math.max(0, Math.floor(action.index)), ended: false };
    case "skip": {
      const next = skip(action.timeline, state.index, action.seconds);
      return next < 0 ? state : { ...state, index: next, ended: false };
    }
    case "sentenceEnd":
      return state.index + 1 < action.count
        ? { ...state, index: state.index + 1 }
        : { ...state, playing: false, ended: true };
    case "rate":
      return { ...state, rate: action.rate };
  }
}

/** Seconds into the reading: the sentence's start plus the time spent in it (never past its end). */
export function elapsedSeconds(timeline: readonly TimelineEntry[], index: number, within: number): number {
  const entry = timeline[index];
  if (!entry) return 0;
  return entry.start + Math.min(Math.max(0, within), entry.end - entry.start);
}

/** The listening screen's address for a page. */
export function listenHref(noteId: string, mode: ListenMode = "recap"): string {
  return `/study/listen?from=${encodeURIComponent(noteId)}&mode=${mode}`;
}

/** `?mode=` as a mode: "full" or the recap. */
export function parseMode(value: unknown): ListenMode {
  return value === "full" ? "full" : "recap";
}
