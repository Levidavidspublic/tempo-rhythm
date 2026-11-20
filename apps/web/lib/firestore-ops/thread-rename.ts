import { checkConversationDoc, type ConversationDoc } from "../firestore-docs/conversation-doc";

const TITLE_LIMIT = 200;
const CHANGED_FIELDS = ["title", "updatedAt"] as const;

function shortenTitle(title: string): string {
  const shortened = title.slice(0, TITLE_LIMIT);
  const lastCodeUnit = shortened.charCodeAt(shortened.length - 1);

  return lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff ? shortened.slice(0, -1) : shortened;
}

export function planThreadRename(conversation: ConversationDoc, title: string, now: number) {
  if (conversation.deletedAt !== undefined) {
    return { ok: false as const, reason: "deleted" as const };
  }
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };

  const cleanedTitle = title.replace(/\s+/g, " ").trim();
  if (cleanedTitle.length === 0) {
    return { ok: false as const, reason: "empty-title" as const };
  }

  const renamedTitle = shortenTitle(cleanedTitle);
  if (renamedTitle === conversation.title) return { ok: true as const, unchanged: true as const };

  const patch = { title: renamedTitle, updatedAt: now };
  if (!checkConversationDoc({ ...conversation, ...patch }).ok) {
    return { ok: false as const, reason: "invalid-conversation" as const };
  }

  return {
    ok: true as const,
    unchanged: false as const,
    patch,
    changedFields: CHANGED_FIELDS,
  };
}
