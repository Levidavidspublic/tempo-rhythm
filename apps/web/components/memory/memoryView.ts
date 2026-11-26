export type Sector = "semantic" | "episodic" | "procedural" | "emotional" | "general";

export type MemoryRow = {
  _id: string;
  content: string;
  sector: Sector;
  salience: number;
  updatedAt: number;
};

export const MEMORY_MAX = 500;

export const SECTOR_LABELS: Record<Sector, string> = {
  semantic: "Facts",
  episodic: "Events",
  procedural: "How I do things",
  emotional: "Feelings",
  general: "General",
};

export const SECTORS = Object.keys(SECTOR_LABELS) as Sector[];

export type MemoryValidation = { ok: true; text: string } | { ok: false; error: string };

export function validateMemory(text: string): MemoryValidation {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: false, error: "Write something to remember first." };
  if (trimmed.length > MEMORY_MAX) {
    return { ok: false, error: `Keep a memory to ${MEMORY_MAX} characters or fewer.` };
  }
  return { ok: true, text: trimmed };
}

export function sortForDisplay<T extends Pick<MemoryRow, "salience" | "updatedAt">>(
  memories: readonly T[]
): T[] {
  return [...memories].sort((a, b) => b.salience - a.salience || b.updatedAt - a.updatedAt);
}
