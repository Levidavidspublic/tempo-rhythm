import type { TaskDoc } from "../firestore/task-doc";
import { draftQuickTask } from "./quick-task";

const BRAIN_DUMP_MAX_LINES = 50;
const LIST_MARKER = /^(?:(?:[-*•]\s*)?\[(?: |x|X)\]|[-*•]|\d+[.)])(?:\s+|$)/;

export type BrainDumpReviewLine = {
  index: number;
  title: string;
};

export function listBrainDumpLines(text: string): {
  lines: BrainDumpReviewLine[];
  droppedRepeats: number;
  overLimit: boolean;
} {
  if (typeof text !== "string") {
    return { lines: [], droppedRepeats: 0, overLimit: false };
  }

  const lines: BrainDumpReviewLine[] = [];
  const seen = new Set<string>();
  let droppedRepeats = 0;

  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const title = rawLine.trim().replace(LIST_MARKER, "").trim();
    if (!title) continue;

    const normalizedTitle = title.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(normalizedTitle)) {
      droppedRepeats += 1;
      continue;
    }

    if (lines.length === BRAIN_DUMP_MAX_LINES) {
      return { lines, droppedRepeats, overLimit: true };
    }

    seen.add(normalizedTitle);
    lines.push({ index: lines.length, title });
  }

  return { lines, droppedRepeats, overLimit: false };
}

export function draftBrainDumpTasks(
  keptLines: readonly string[],
  now: number
):
  | { ok: true; tasks: TaskDoc[]; refused: number }
  | { ok: false; reason: "bad-time" | "nothing-kept" } {
  if (!Number.isFinite(now)) return { ok: false, reason: "bad-time" };
  if (keptLines.length === 0) return { ok: false, reason: "nothing-kept" };

  const tasks: TaskDoc[] = [];
  let refused = 0;

  for (const title of keptLines) {
    const draft = draftQuickTask({ title }, now);
    if (!draft.ok) {
      refused += 1;
      continue;
    }
    tasks.push(draft.doc);
  }

  return { ok: true, tasks, refused };
}
