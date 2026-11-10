export type MemoryStats = {
  total: number;
  sectors: ReadonlyArray<{ sector: string; count: number }>;
};

const UNSAFE_FILENAME_CHARACTERS = /[^a-z0-9._-]+/g;
const EDGE_SEPARATORS = /^[-_.]+|[-_.]+$/g;
const FALLBACK_FILENAME = "tempo-memories.md";

export function safeFilename(name: string): string {
  const safe = name
    .toLowerCase()
    .replace(UNSAFE_FILENAME_CHARACTERS, "-")
    .replace(EDGE_SEPARATORS, "");

  return safe || FALLBACK_FILENAME;
}

export function summaryLine(stats: MemoryStats): string {
  if (stats.total === 0) return "Nothing to export yet.";

  const sections = stats.sectors.filter(({ count }) => count > 0).length;
  const memoryLabel = stats.total === 1 ? "memory" : "memories";
  const sectionLabel = sections === 1 ? "section" : "sections";
  return `${stats.total} ${memoryLabel} across ${sections} ${sectionLabel}`;
}

export function toBlobParts(markdown: string): {
  parts: string[];
  type: "text/markdown;charset=utf-8";
} {
  return {
    parts: [markdown],
    type: "text/markdown;charset=utf-8",
  };
}
