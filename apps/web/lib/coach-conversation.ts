/**
 * The conversation the coach opens on: the newest legacy one (the list comes newest first). A
 * conversation moved to Agent chat refuses legacy sends (#895), so it is never picked; with no
 * legacy conversation the coach makes a new one.
 */
export function pickCoachConversation<T extends { chatMode: "legacy" | "agent" }>(conversations: readonly T[]): T | null {
  return conversations.find((conversation) => conversation.chatMode !== "agent") ?? null;
}

/** How long a coach reply holds its turn: convex/coach.ts `TURN_CLAIM_MS` (a test keeps them equal). */
export const COACH_TURN_CLAIM_MS = 10 * 60_000;
/** A reply still running after this long is presumed dead, so the chat offers Try again. */
export const COACH_REPLY_WAIT_MS = 2 * 60_000;

/**
 * Until when a reply is on its way for the newest message, from whichever surface asked for it
 * (Today's chat, the panel, /coach, another tab), or null. A reply claims the user message it
 * answers on that message's `toolCalls` (convex/coach.ts `claimTurn`), and every surface reads the
 * same messages, so all of them wait instead of sending a newer message that would make the
 * running reply's answer be dropped.
 */
export function replyInFlightUntil(newest: { role: string; toolCalls?: unknown } | undefined, now: number): number | null {
  if (!newest || newest.role !== "user" || !newest.toolCalls || typeof newest.toolCalls !== "object") return null;
  const until = (newest.toolCalls as { coachClaimUntil?: unknown }).coachClaimUntil;
  if (typeof until !== "number") return null;
  const waitUntil = Math.min(until, until - COACH_TURN_CLAIM_MS + COACH_REPLY_WAIT_MS);
  return waitUntil > now ? waitUntil : null;
}
