import type { AiMessage } from "./ai_router";

const MEMORY_TEXT_LIMIT = 3000;

const SYSTEM_PROMPT = `You are Tempo, a warm and calm executive-function coach.
- Keep replies short: 1–4 sentences.
- Be ADHD-friendly, concrete, and easy to scan.
- Offer one small next step when that would be useful.
- Never shame, scold, diagnose, or present medical or legal advice.
- Reply in the language the user writes in.`;

export type ChatHistoryItem = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatMemory = { content: string };

/** Memory fields the top-N pick needs; a `memories` row satisfies this. */
type MemoryRow = { content: string; salience: number; updatedAt: number; deletedAt?: number };

/**
 * The `limit` most useful live memories: highest salience first, newest update as the tiebreak.
 * Pure. The caller bounds how many rows it reads before this runs, so this never sees an unbounded set.
 */
export function pickTopMemories(rows: readonly MemoryRow[], limit: number): ChatMemory[] {
  return rows
    .filter((memory) => memory.deletedAt === undefined)
    .sort((a, b) => b.salience - a.salience || b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(({ content }) => ({ content }));
}

/**
 * `history` read in the same transaction as the turn's user message ends with that message.
 * `buildChatMessages` appends the user text itself, so drop that trailing copy first.
 */
export function historyBeforeTurn(history: ChatHistoryItem[], userText: string): ChatHistoryItem[] {
  const last = history[history.length - 1];
  return last && last.role === "user" && last.content.trim() === userText.trim()
    ? history.slice(0, -1)
    : history;
}

function memoryBlock(memories: ChatMemory[]): string | undefined {
  let remaining = MEMORY_TEXT_LIMIT;
  const lines: string[] = [];

  for (const memory of memories) {
    const content = memory.content.trim().replace(/\s+/g, " ");
    if (!content || remaining <= 0) continue;

    const prefix = "- ";
    const available = Math.max(0, remaining - prefix.length);
    if (available === 0) break;
    const included = content.slice(0, available);
    lines.push(`${prefix}${included}`);
    remaining -= prefix.length + included.length;
  }

  return lines.length > 0 ? `What you know about this person:\n${lines.join("\n")}` : undefined;
}

export function buildChatMessages(args: {
  history: ChatHistoryItem[];
  memories: ChatMemory[];
  userText: string;
  now: number;
}): AiMessage[] {
  const messages: AiMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\nCurrent time: ${new Date(args.now).toISOString()}`,
    },
  ];
  const memories = memoryBlock(args.memories);
  if (memories) messages.push({ role: "system", content: memories });
  messages.push(...args.history.map(({ role, content }) => ({ role, content })));
  messages.push({ role: "user", content: args.userText });
  return messages;
}

const TRUNCATION_MARKER = "…";

/**
 * Bound text to `max` UTF-16 units for storage. Text that fits is returned untouched. Longer text is cut
 * and ends with a visible "…", and the cut never splits a surrogate pair. Deterministic, so a retry of the
 * same long text produces the same stored content.
 */
export function truncateForStorage(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = Math.max(0, max - TRUNCATION_MARKER.length);
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return text.slice(0, end) + TRUNCATION_MARKER;
}

/**
 * Walk `rows` (already in the order to keep, e.g. a salience index read descending) and collect live rows.
 * Stops after `liveLimit` live rows or `scanLimit` rows read, whichever comes first, so soft-deleted rows
 * cannot crowd out live ones yet the read stays bounded. Pulls rows one at a time and never collects.
 */
export async function takeLiveMemories<T extends { deletedAt?: number }>(
  rows: AsyncIterable<T>,
  liveLimit: number,
  scanLimit: number,
): Promise<T[]> {
  const live: T[] = [];
  if (liveLimit <= 0 || scanLimit <= 0) return live;
  let scanned = 0;
  for await (const row of rows) {
    scanned += 1;
    if (row.deletedAt === undefined) live.push(row);
    if (live.length >= liveLimit || scanned >= scanLimit) break;
  }
  return live;
}
