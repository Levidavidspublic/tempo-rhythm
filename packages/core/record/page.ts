/**
 * The page a recording becomes (kitchen T8, S7 RecordSession): Markdown with a short header, the
 * optional summary, the pinned moments with their times, and the transcript under its own heading.
 * Pure: the caller passes every input, including the time zone for the date line.
 */

import type { RecordLang } from "./extract";

export type RecordingPin = {
  /** Milliseconds from the start of the recording. */
  atMs: number;
  /** The person's optional note for this moment. */
  note?: string;
};

export type RecordingPageInput = {
  title: string;
  /** Unix ms when the recording started. */
  startedAt: number;
  transcript: string;
  pins: readonly RecordingPin[];
  lang: RecordLang;
  /** A short summary the person accepted (from the runtime model), if any. */
  summary?: string;
  /** IANA time zone for the date line; the runtime's own when omitted. */
  timeZone?: string;
};

const COPY = {
  en: {
    recorded: "Recorded",
    summary: "Summary",
    pins: "Pinned moments",
    pin: "Pinned",
    transcript: "Transcript",
    empty: "No words were captured.",
    note: "Audio was not stored. Only these notes were saved.",
  },
  he: {
    recorded: "הוקלט",
    summary: "תקציר",
    pins: "רגעים מסומנים",
    pin: "סומן",
    transcript: "תמלול",
    empty: "לא נקלטו מילים.",
    note: "האודיו לא נשמר. נשמרו רק הרשימות האלה.",
  },
} as const;

/** Left-to-right isolate, so a time reads the same inside Hebrew text (`.tp-num` in the page). */
const LRI = "⁦";
const PDI = "⁩";

/** mm:ss from milliseconds (h:mm:ss from an hour). Negative or non-finite counts as 0. */
export function formatClock(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${String(minutes).padStart(2, "0")}:${ss}`;
}

/** A time wrapped as a left-to-right isolate, safe inside right-to-left text. */
export function safeClock(ms: number): string {
  return `${LRI}${formatClock(ms)}${PDI}`;
}

function dateLine(startedAt: number, lang: RecordLang, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(new Date(startedAt));
  } catch {
    return new Date(startedAt).toISOString().slice(0, 16).replace("T", " ");
  }
}

/** One line of Markdown text: no line breaks, and no leading marks that would start a block. */
function inline(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/^([#>]|[-*+]\s|\d+[.)]\s)/, "\\$1");
}

/** The page body for a recording, as Markdown. */
export function buildRecordingPage(input: RecordingPageInput): string {
  const copy = COPY[input.lang];
  const parts: string[] = [];
  parts.push(`${copy.recorded} ${LRI}${dateLine(input.startedAt, input.lang, input.timeZone)}${PDI}. ${copy.note}`);
  const summary = input.summary?.trim();
  if (summary) parts.push(`## ${copy.summary}\n\n${summary}`);
  const pins = [...input.pins].filter((pin) => Number.isFinite(pin.atMs)).sort((a, b) => a.atMs - b.atMs);
  if (pins.length > 0) {
    const items = pins.map((pin) => {
      const note = pin.note ? inline(pin.note) : "";
      return `- ${safeClock(pin.atMs)} ${note || copy.pin}`;
    });
    parts.push(`## ${copy.pins}\n\n${items.join("\n")}`);
  }
  const transcript = input.transcript.trim();
  parts.push(`## ${copy.transcript}\n\n${transcript || copy.empty}`);
  return `${parts.join("\n\n")}\n`;
}
