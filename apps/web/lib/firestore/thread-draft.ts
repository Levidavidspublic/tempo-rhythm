import {
  checkConversationDoc,
  type ConversationDoc,
} from "../firestore-docs/conversation-doc";
import { stampCreate } from "./write-stamps";

export const THREAD_TITLE_MAX = 60;

type DraftThreadResult =
  | { ok: true; doc: ConversationDoc }
  | { ok: false; reason: "empty" | "invalid-now" | "invalid-doc" };

function shortenTitle(title: string): string {
  if (title.length <= THREAD_TITLE_MAX) return title;

  let end = THREAD_TITLE_MAX - 1;
  const lastCodeUnit = title.charCodeAt(end - 1);
  if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end -= 1;
  return `${title.slice(0, end)}…`;
}

export function draftThread(firstMessage: unknown, now: number): DraftThreadResult {
  if (typeof firstMessage !== "string") return { ok: false, reason: "empty" };

  const firstLine = firstMessage
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find((line) => line.length > 0);
  if (!firstLine) return { ok: false, reason: "empty" };
  if (!Number.isFinite(now) || now <= 0) return { ok: false, reason: "invalid-now" };

  const checked = checkConversationDoc(stampCreate({ title: shortenTitle(firstLine) }, now));
  return checked.ok ? checked : { ok: false, reason: "invalid-doc" };
}

export function sortThreads<T extends { id: string; updatedAt: number; deletedAt?: number }>(
  threads: readonly T[],
): T[] {
  return threads
    .filter((thread) => thread.deletedAt === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
