/**
 * Template sketch (docs/design/v3/screens/web/template-sketch.html): a rough outline in plain
 * lines becomes a template proposal. This is code, not a model: the same outline always gives
 * the same Markdown, the person's words are kept, and nothing is saved until they accept
 * (templates.create). Templates are Markdown pages (OVERNIGHT-RUN.md decision 6), and a
 * checklist stays a plain `- [ ]` line (decision 4).
 *
 * The first non-empty line is the name. Each other line is one part; a word in brackets at the
 * end is a hint, not a rule:
 *   (tasks)    → a checklist line you can tick; tasks next to each other share one list
 *   (question) → a prompt line, with room under it for the answer
 *   no hint    → a section heading
 * An unknown bracket word is kept as part of the text.
 */

export type SketchPartKind = "section" | "task" | "question";

export type SketchPart = { kind: SketchPartKind; text: string };

export type SketchDraft = {
  name: string;
  parts: SketchPart[];
  /** The template body: Markdown, exactly what Accept saves. */
  body: string;
  counts: Record<SketchPartKind, number>;
};

/** Longest outline the sketch takes (it also travels in the builder's URL). */
export const SKETCH_MAX_CHARS = 2000;
/** Template names are capped like page titles. */
const NAME_MAX = 200;

/** Bracket words for each hint, English and Hebrew. Matched without case. */
export const SKETCH_HINTS: Readonly<Record<Exclude<SketchPartKind, "section">, readonly string[]>> = {
  task: ["tasks", "task", "todo", "משימות", "משימה"],
  question: ["question", "ask", "שאלה"],
};

const HINT = /^(.*?)\s*[(（]\s*([^()（）]{1,24}?)\s*[)）]\s*$/u;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function partFor(line: string): SketchPart | null {
  // A line already written as a checklist item is a task.
  const check = /^\s*[-*+]\s+\[[ xX]\]\s+(.*)$/u.exec(line);
  if (check && clean(check[1] as string)) return { kind: "task", text: clean(check[1] as string) };
  const text = clean(line.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/u, ""));
  if (!text) return null;
  const hint = HINT.exec(text);
  if (hint) {
    const word = (hint[2] as string).toLowerCase();
    const words = clean(hint[1] as string);
    for (const kind of ["task", "question"] as const) {
      if (words && SKETCH_HINTS[kind].includes(word)) return { kind, text: words };
    }
  }
  return { kind: "section", text };
}

/** The Markdown body for a name and its parts. */
export function sketchBody(name: string, parts: readonly SketchPart[]): string {
  let out = `# ${name}\n`;
  let previous: SketchPartKind | null = null;
  for (const part of parts) {
    if (part.kind === "task") {
      out += previous === "task" ? `- [ ] ${part.text}\n` : `\n- [ ] ${part.text}\n`;
    } else if (part.kind === "question") {
      out += `\n> ${part.text}\n`;
    } else {
      out += `\n## ${part.text}\n`;
    }
    previous = part.kind;
  }
  return out;
}

/** The proposal for an outline, or null when it has no name line yet. */
export function parseSketch(outline: string): SketchDraft | null {
  const rows = outline.slice(0, SKETCH_MAX_CHARS).split(/\r?\n/);
  const first = rows.findIndex((row) => clean(row).length > 0);
  if (first < 0) return null;
  const nameLine = partFor(rows[first] as string);
  const name = Array.from(nameLine?.text ?? "")
    .slice(0, NAME_MAX)
    .join("");
  if (!name) return null;
  const parts: SketchPart[] = [];
  for (const row of rows.slice(first + 1)) {
    const part = partFor(row);
    if (part) parts.push(part);
  }
  const counts: Record<SketchPartKind, number> = { section: 0, task: 0, question: 0 };
  for (const part of parts) counts[part.kind] += 1;
  return { name, parts, body: sketchBody(name, parts), counts };
}
