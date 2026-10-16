/**
 * Small rules for the coach thread and composer (CoachChat.tsx), kept here so they can be tested
 * without a browser. Interaction ideas follow common chat conventions (Open WebUI among them):
 * the thread follows new messages only while you are at the bottom, the composer grows with what
 * you type, and a counter appears only near the length limit. No code is taken from Open WebUI.
 */

/** How close to the bottom (px) still counts as "reading the latest". */
export const STICK_THRESHOLD_PX = 48;

/** True when a scroll box is at (or within the threshold of) its bottom edge. */
export function isNearBottom(
  box: { scrollTop: number; scrollHeight: number; clientHeight: number },
  threshold = STICK_THRESHOLD_PX,
): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= threshold;
}

/** Characters left before the limit, shown only once fewer than `warnAt` remain. */
export function charsLeft(length: number, max: number, warnAt = 400): number | null {
  const left = max - length;
  return left < warnAt ? Math.max(0, left) : null;
}

/** The composer's height for its content: never under `min`, never over `max` (then it scrolls). */
export function composerHeight(scrollHeight: number, min = 48, max = 160): number {
  return Math.min(max, Math.max(min, scrollHeight));
}

/** "14:05" in the reader's language; digits stay left to right through `.tp-num`. */
export function messageTime(ms: number, lang: string): string {
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(ms),
  );
}

/** The title a backend-made conversation starts with (convex/conversations.ts `create`). */
export const DEFAULT_THREAD_TITLE = "New Conversation";

/** A thread's title from its first message: the first line, spaces tidied, at most 60 characters. */
export function threadTitle(text: string, max = 60): string {
  const line = (text.split("\n").find((l) => l.trim()) ?? "").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
