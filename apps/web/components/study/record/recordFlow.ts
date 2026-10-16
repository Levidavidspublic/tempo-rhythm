/**
 * Pure pieces of RecordSession (kitchen T8, S7): copy lookup, the elapsed clock, pins and the
 * review rows. No audio, no network, nothing stored.
 */
import { en as enCopy, he as heCopy, type RecordKey } from "@/lib/i18n-groups/record";
import type { ActionSuggestion, RecordLang, RecordingPin } from "../../../../../packages/core/record";

export type { RecordKey };

/** The screen's copy in one language, with `{name}` placeholders filled. */
export function recordCopy(lang: RecordLang) {
  const table: Record<RecordKey, string> = lang === "he" ? heCopy : enCopy;
  return (key: RecordKey, vars?: Record<string, string | number>): string => {
    let text = table[key] ?? enCopy[key];
    if (vars) {
      for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
    }
    return text;
  };
}

export type RecordCopy = ReturnType<typeof recordCopy>;

// ---------------------------------------------------------------------------------------------
// Clock: elapsed time that stops while paused
// ---------------------------------------------------------------------------------------------

export type Clock = { accumulatedMs: number; runningSince: number | null };

export const IDLE_CLOCK: Clock = { accumulatedMs: 0, runningSince: null };

export function clockStart(clock: Clock, now: number): Clock {
  return clock.runningSince === null ? { ...clock, runningSince: now } : clock;
}

export function clockPause(clock: Clock, now: number): Clock {
  if (clock.runningSince === null) return clock;
  return { accumulatedMs: clock.accumulatedMs + Math.max(0, now - clock.runningSince), runningSince: null };
}

export function clockElapsed(clock: Clock, now: number): number {
  return clock.accumulatedMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince));
}

// ---------------------------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------------------------

export type Pin = RecordingPin & { id: string; note: string };

export const MAX_PINS = 200;

export function addPin(pins: readonly Pin[], atMs: number, id: string): Pin[] {
  if (pins.length >= MAX_PINS) return [...pins];
  return [...pins, { id, atMs: Math.max(0, Math.floor(atMs)), note: "" }];
}

export function setPinNote(pins: readonly Pin[], id: string, note: string): Pin[] {
  return pins.map((pin) => (pin.id === id ? { ...pin, note: note.slice(0, 300) } : pin));
}

export function removePin(pins: readonly Pin[], id: string): Pin[] {
  return pins.filter((pin) => pin.id !== id);
}

/** True when a key press should pin: the P key, no modifiers, and not while typing in a field. */
export function isPinKey(event: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; target?: unknown }): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key !== "p" && event.key !== "P") return false;
  const target = event.target as { tagName?: string; isContentEditable?: boolean } | null | undefined;
  const tag = typeof target?.tagName === "string" ? target.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Review rows
// ---------------------------------------------------------------------------------------------

export type RowStatus = "pending" | "accepted" | "rejected";
export type ReviewRow = { id: string; title: string; minutes?: number; source?: string; status: RowStatus };
export type RowSource = "model" | "local";

export function rowsFromSuggestions(suggestions: readonly ActionSuggestion[]): ReviewRow[] {
  return suggestions.map((s, i) => ({ id: `l${i}`, title: s.title, source: s.source, status: "pending" as const }));
}

export function rowsFromProposal(tasks: readonly { title: string; minutes?: number }[]): ReviewRow[] {
  return tasks.map((task, i) => ({
    id: `m${i}`,
    title: task.title,
    ...(task.minutes !== undefined ? { minutes: task.minutes } : {}),
    status: "pending" as const,
  }));
}

export function setRowStatus(rows: readonly ReviewRow[], id: string, status: RowStatus): ReviewRow[] {
  return rows.map((row) => (row.id === id ? { ...row, status } : row));
}

export function editRow(rows: readonly ReviewRow[], id: string, patch: { title?: string; minutes?: number | null }): ReviewRow[] {
  return rows.map((row) => {
    if (row.id !== id) return row;
    const next: ReviewRow = { ...row };
    if (patch.title !== undefined) next.title = patch.title.slice(0, 300);
    if (patch.minutes === null) delete next.minutes;
    else if (patch.minutes !== undefined) next.minutes = patch.minutes;
    return next;
  });
}

/** True once the person has decided on any row; a late model reply then leaves the rows alone. */
export function anyDecided(rows: readonly ReviewRow[]): boolean {
  return rows.some((row) => row.status !== "pending");
}

/** The tasks Save sends: accepted rows with a title, minutes only when whole and in range. */
export function acceptedTasks(rows: readonly ReviewRow[]): { title: string; minutes?: number }[] {
  return rows
    .filter((row) => row.status === "accepted" && row.title.trim().length > 0)
    .slice(0, 20)
    .map((row) => {
      const title = row.title.trim();
      const minutes = row.minutes;
      return minutes !== undefined && Number.isInteger(minutes) && minutes >= 1 && minutes <= 600 ? { title, minutes } : { title };
    });
}

/** Minutes typed in a field: a whole number from 1 to 600, or null when empty or not a number. */
export function parseMinutes(raw: string): number | null {
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value < 1) return null;
  return Math.min(600, value);
}

/** The transcript for review: live lines then typed notes, each part trimmed. */
export function joinTranscript(lines: readonly string[], typed: string): string {
  return [lines.join("\n").trim(), typed.trim()].filter(Boolean).join("\n\n");
}

/** A short default page title. */
export function defaultTitle(copy: RecordCopy, startedAt: number, lang: RecordLang): string {
  const date = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { dateStyle: "medium" }).format(new Date(startedAt));
  return copy("rec.rev.titleDefault", { date });
}
