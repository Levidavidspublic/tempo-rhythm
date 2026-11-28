import { checkMemoryDoc, type MemoryDoc } from "../firestore-docs/memory-doc";

export const MEMORY_IMPORT_MAX_ITEMS = 200;
export const MEMORY_IMPORT_MAX_LENGTH = 500;

export const MEMORY_IMPORT_SALIENCE = 0.8;
export const MEMORY_IMPORT_DECAY_RATE = 0.05;

export type MemoryReviewItem = {
  index: number;
  content: string;
};

export function readMemoryPaste(text: string): {
  items: MemoryReviewItem[];
  dropped: number;
} {
  if (typeof text !== "string") {
    return { items: [], dropped: 0 };
  }

  const items: MemoryReviewItem[] = [];
  const seen = new Set<string>();
  let dropped = 0;

  for (const line of text.split(/\r?\n/)) {
    const content = line
      .trim()
      .replace(/^(?:[-*•]|\d+[.)])\s+/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MEMORY_IMPORT_MAX_LENGTH);

    if (content.length === 0) {
      continue;
    }

    const normalizedContent = content.toLowerCase();
    if (seen.has(normalizedContent)) {
      dropped += 1;
      continue;
    }
    seen.add(normalizedContent);

    if (items.length >= MEMORY_IMPORT_MAX_ITEMS) {
      dropped += 1;
      continue;
    }

    items.push({ index: items.length, content });
  }

  return { items, dropped };
}

export function draftKeptMemories(
  items: readonly MemoryReviewItem[],
  keptIndexes: readonly number[],
  now: number
): { ok: true; docs: MemoryDoc[] } | { ok: false; reason: string } {
  if (!Number.isFinite(now) || now < 0) {
    return { ok: false, reason: "now must be a nonnegative finite number" };
  }

  const kept = new Set(keptIndexes);
  const docs: MemoryDoc[] = [];

  for (const item of items) {
    if (!kept.has(item.index)) {
      continue;
    }

    const candidate = {
      content: item.content,
      sector: "general" as const,
      salience: MEMORY_IMPORT_SALIENCE,
      decayRate: MEMORY_IMPORT_DECAY_RATE,
      lastAccessed: now,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const checked = checkMemoryDoc(candidate);
    if (!checked.ok) {
      return { ok: false, reason: checked.reason };
    }
    docs.push(checked.doc);
  }

  return { ok: true, docs };
}
