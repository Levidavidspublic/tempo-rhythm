/**
 * /coach chat polish (Kitchen, owner-approved): the pure parts of the chats column and the thread.
 * No React, no Convex, no clock reads: callers pass `now` and, in tests, a time zone. Without a
 * time zone every date is in the viewer's own (the runtime default).
 *
 * - Chats column: which conversations are listed (live, legacy, newest first), their shown title,
 *   their short date, and which chat opens after one is deleted.
 * - Search: when a query is worth sending, and the hits of `messages.searchMine` grouped per chat.
 * - Thread: day dividers ("Today", "Yesterday", a date), the starter cards, and which reply gets
 *   the suggested follow-ups.
 */
import type { MessageKey } from "./i18n";

/** The title `conversations.create` stores when none is given (convex/conversations.ts). */
export const SERVER_DEFAULT_TITLE = "New Conversation";

/** Search waits this long after the last keystroke. */
export const SEARCH_DEBOUNCE_MS = 250;
/** Shortest query sent to `messages.searchMine`. */
export const SEARCH_MIN_CHARS = 2;
/** `messages.searchMine` reads at most this many characters of the query. */
export const SEARCH_MAX_CHARS = 200;

/** The four starter cards of an empty chat. Picking one sends its label as the person's message. */
export const COACH_STARTERS: readonly { label: MessageKey; hint: MessageKey }[] = [
  { label: "cc.starter.plan", hint: "cc.starter.planHint" },
  { label: "cc.starter.dump", hint: "cc.starter.dumpHint" },
  { label: "cc.starter.stuck", hint: "cc.starter.stuckHint" },
  { label: "cc.starter.vent", hint: "cc.starter.ventHint" },
];

/** The three fixed follow-ups under the newest reply. Picking one sends its text. */
export const COACH_FOLLOW_UPS: readonly MessageKey[] = ["cc.follow.smaller", "cc.follow.first", "cc.follow.tomorrow"];

/**
 * Replies that get no follow-ups: the fixed crisis resources card (coaching stops there) and an
 * Executor lookup answer, which lists apps instead of advice.
 */
const NO_FOLLOW_UP_MODELS: ReadonlySet<string> = new Set(["crisis-card", "executor-lookup"]);

type ThreadRow = {
  _id: string;
  createdAt: number;
  updatedAt: number;
  chatMode: "legacy" | "agent";
  deletedAt?: number;
};

/**
 * The chats /coach lists: live ones the coach can still write to (a chat moved to Agent chat
 * refuses legacy sends, like `pickCoachConversation`), newest activity first.
 */
export function coachThreads<T extends ThreadRow>(conversations: readonly T[] | undefined): T[] {
  return (conversations ?? [])
    .filter((conversation) => conversation.deletedAt === undefined && conversation.chatMode !== "agent")
    .map((conversation, index) => ({ conversation, index }))
    .sort((a, b) => b.conversation.updatedAt - a.conversation.updatedAt || a.index - b.index)
    .map(({ conversation }) => conversation);
}

/** The title to show: the stored one, or the fallback while it is still the server's default. */
export function threadTitle(title: string | undefined, fallback: string): string {
  const shown = (title ?? "").replace(/\s+/g, " ").trim();
  return shown === "" || shown === SERVER_DEFAULT_TITLE ? fallback : shown;
}

/**
 * True while a chat holds no message: every message write moves the conversation's `updatedAt`
 * past its `createdAt` (convex/coach.ts `sendMessage`), and nothing else touches a coach chat.
 */
export function isEmptyThread(conversation: { createdAt: number; updatedAt: number }): boolean {
  return conversation.updatedAt <= conversation.createdAt;
}

/**
 * The chat to show after `deletedId` is deleted: the open one stays open; when the open one is
 * the deleted one, the newest of the rest, or null when none is left.
 */
export function nextAfterDelete<Id extends string>(threads: readonly { _id: Id }[], deletedId: Id, selectedId: Id | null): Id | null {
  if (selectedId !== null && selectedId !== deletedId) return selectedId;
  return threads.find((thread) => thread._id !== deletedId)?._id ?? null;
}

/** The query to send, or null while it is too short. Runs of spaces count as one. */
export function searchQueryOf(raw: string): string | null {
  const query = raw.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_CHARS);
  return query.length >= SEARCH_MIN_CHARS ? query : null;
}

export type SearchHit = { conversationId: string; messageId: string; content: string; createdAt: number };
export type SearchResult<Id extends string> = { conversationId: Id; content: string; latestAt: number };

/**
 * One result per chat, in the chats column's order (newest first). Hits from a chat that is not
 * listed (deleted since, or moved to Agent chat) are left out. `content` is the newest match.
 * No match count: `messages.searchMine` stops at a chat's first match, so a count would always be 1.
 */
export function groupSearchHits<Id extends string>(
  hits: readonly (SearchHit & { conversationId: Id })[] | null | undefined,
  threads: readonly { _id: Id }[],
): SearchResult<Id>[] {
  const byThread = new Map<Id, SearchResult<Id>>();
  for (const hit of hits ?? []) {
    const current = byThread.get(hit.conversationId);
    if (!current) {
      byThread.set(hit.conversationId, { conversationId: hit.conversationId, content: hit.content, latestAt: hit.createdAt });
      continue;
    }
    if (hit.createdAt > current.latestAt) {
      current.content = hit.content;
      current.latestAt = hit.createdAt;
    }
  }
  const results: SearchResult<Id>[] = [];
  for (const thread of threads) {
    const result = byThread.get(thread._id);
    if (result) results.push(result);
  }
  return results;
}

/**
 * A one-line excerpt of `content` around the first case-insensitive match of `query`, with "…"
 * where text was cut. No match: the start of the text.
 */
export function matchSnippet(content: string, query: string, radius = 48): string {
  const text = content.replace(/\s+/g, " ").trim();
  const needle = query.replace(/\s+/g, " ").trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return text.length > radius * 2 ? `${text.slice(0, radius * 2).trimEnd()}…` : text;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + needle.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export type DayKind = "today" | "yesterday" | "date";
export type ThreadItem<T> = { type: "day"; key: string; kind: DayKind; at: number } | { type: "message"; message: T };

function dayFormatter(timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
}

function keyFrom(formatter: Intl.DateTimeFormat, ms: number): string {
  const parts = formatter.formatToParts(new Date(ms));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

/** The calendar day of `ms` as `YYYY-MM-DD`, in `timeZone` (default: the viewer's). */
export function dayKeyOf(ms: number, timeZone?: string): string {
  return keyFrom(dayFormatter(timeZone), ms);
}

/** The calendar day before `key` (`YYYY-MM-DD`). Calendar arithmetic, so a DST change never skips a day. */
export function previousDayKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

export function dayKindOf(key: string, todayKey: string): DayKind {
  if (key === todayKey) return "today";
  if (key === previousDayKey(todayKey)) return "yesterday";
  return "date";
}

/** The thread with a day divider before the first message of each calendar day. */
export function withDayDividers<T extends { createdAt: number }>(messages: readonly T[], now: number, timeZone?: string): ThreadItem<T>[] {
  const formatter = dayFormatter(timeZone);
  const todayKey = keyFrom(formatter, now);
  const items: ThreadItem<T>[] = [];
  let last: string | null = null;
  for (const message of messages) {
    const key = keyFrom(formatter, message.createdAt);
    if (key !== last) {
      items.push({ type: "day", key, kind: dayKindOf(key, todayKey), at: message.createdAt });
      last = key;
    }
    items.push({ type: "message", message });
  }
  return items;
}

/** A divider's words: "Today", "Yesterday", else a long date in `locale` (the year only when it differs). */
export function dayDividerLabel(
  divider: { kind: DayKind; at: number },
  locale: string,
  labels: { today: string; yesterday: string },
  now: number,
  timeZone?: string,
): string {
  if (divider.kind === "today") return labels.today;
  if (divider.kind === "yesterday") return labels.yesterday;
  const sameYear = dayKeyOf(divider.at, timeZone).slice(0, 4) === dayKeyOf(now, timeZone).slice(0, 4);
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(divider.at));
}

/**
 * A chat's short date in the chats column: the time for today, "Yesterday", the weekday within the
 * past week, else the date (with the year when it differs).
 */
export function threadDateLabel(ms: number, now: number, locale: string, labels: { yesterday: string }, timeZone?: string): string {
  const key = dayKeyOf(ms, timeZone);
  const todayKey = dayKeyOf(now, timeZone);
  const kind = dayKindOf(key, todayKey);
  if (kind === "today") return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  if (kind === "yesterday") return labels.yesterday;
  let weekAgo = todayKey;
  for (let i = 0; i < 6; i += 1) weekAgo = previousDayKey(weekAgo);
  if (key >= weekAgo && key < todayKey) return new Intl.DateTimeFormat(locale, { timeZone, weekday: "long" }).format(new Date(ms));
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  return new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }).format(new Date(ms));
}

type ThreadMessage = { _id: string; role: "user" | "assistant" | "system"; modelUsed?: string };

/**
 * The reply that gets the suggested follow-ups, or null: the newest message when it is a coach
 * reply, never a crisis card or a lookup answer, and nothing while a reply is on its way or the
 * crisis resources are on screen.
 */
export function followUpTarget<T extends ThreadMessage>(
  messages: readonly T[] | undefined,
  state: { busy: boolean; crisisHold: boolean },
): T["_id"] | null {
  if (state.busy || state.crisisHold || !messages || messages.length === 0) return null;
  const newest = messages[messages.length - 1];
  if (newest.role !== "assistant") return null;
  if (newest.modelUsed !== undefined && NO_FOLLOW_UP_MODELS.has(newest.modelUsed)) return null;
  return newest._id;
}
