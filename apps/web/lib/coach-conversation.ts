/**
 * The conversation the coach opens on: the newest legacy one (the list comes newest first). A
 * conversation moved to Agent chat refuses legacy sends (#895), so it is never picked; with no
 * legacy conversation the coach makes a new one.
 */
export function pickCoachConversation<T extends { chatMode: "legacy" | "agent" }>(conversations: readonly T[]): T | null {
  return conversations.find((conversation) => conversation.chatMode !== "agent") ?? null;
}
