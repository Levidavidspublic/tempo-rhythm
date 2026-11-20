/**
 * What Tempo remembers + memory import (docs/design/v3/screens/web/memory.html,
 * memory-import.html).
 */
import {
  type MemoryImportSource,
  parseMemoryExport,
  utf8ByteLength,
} from "../../../../convex/lib/memoryImport";

export type MemoryFilter = "all" | "you" | "imported";

export const MEMORY_FILTERS: readonly MemoryFilter[] = ["all", "you", "imported"];

export type MemoryLike = { createdAt: number; importedFrom?: MemoryImportSource };

/** Newest first, filtered to everything, the person's own, or imported. */
export function shownMemories<T extends MemoryLike>(rows: readonly T[], filter: MemoryFilter): T[] {
  return rows
    .filter((row) =>
      filter === "all"
        ? true
        : filter === "imported"
          ? row.importedFrom !== undefined
          : row.importedFrom === undefined
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export const MEMORY_TEXT_MAX = 500;

export type MemoryProblem = "empty" | "long";

export function checkMemory(
  text: string
): { ok: true; text: string } | { ok: false; problem: MemoryProblem } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problem: "empty" };
  if (trimmed.length > MEMORY_TEXT_MAX) return { ok: false, problem: "long" };
  return { ok: true, text: trimmed };
}

/** Same limit as the server (convex/memoryImport.ts). */
export const MAX_IMPORT_BYTES = 1024 * 1024;

export type ImportChoice = "keep" | "edit" | "drop";

export type ImportItem = {
  id: string;
  text: string;
  choice: ImportChoice;
  /** Tempo already remembers this (same words); saving it won't make a second copy. */
  duplicate: boolean;
};

export type ImportRead =
  | { ok: true; items: ImportItem[] }
  | { ok: false; reason: "empty" | "too-large" };

/**
 * RAM-ONLY: splits pasted (or file) text into short items in the browser. The text itself is
 * never sent anywhere; only the items the person keeps are saved (HARD_RULES §6.4).
 */
export function readImport(
  text: string,
  source: MemoryImportSource,
  existing: readonly string[]
): ImportRead {
  if (!text.trim()) return { ok: false, reason: "empty" };
  if (utf8ByteLength(text) > MAX_IMPORT_BYTES) return { ok: false, reason: "too-large" };
  const known = new Set(existing.map((content) => content.trim().toLocaleLowerCase()));
  const items = parseMemoryExport(text, source).map((item, index) => ({
    id: `item-${index}`,
    text: item,
    choice: "keep" as const,
    duplicate: known.has(item.toLocaleLowerCase()),
  }));
  return { ok: true, items };
}

/** Items that will be saved: kept or edited, never dropped or left blank. */
export function itemsToSave(items: readonly ImportItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (item.choice === "drop") continue;
    const text = item.text.replace(/\s+/g, " ").trim();
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}
