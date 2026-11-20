/**
 * The template editor's "Sections, in order" (docs/design/v3/screens/web/template-editor.html).
 * A template body is Markdown (OVERNIGHT-RUN.md decision 6); a section is one heading line and
 * every line under it up to the next heading. Moving, removing and renaming sections are pure
 * string edits that copy every untouched line byte for byte, so an untouched body joins back to
 * exactly the text it was split from. Headings inside fenced code (and Tempo block fences) are
 * text, not sections.
 */

export type TemplateSection = {
  /** Stable React key for this row while the form is open; never saved. */
  key: string;
  /** 1–6, the number of `#` signs. */
  level: number;
  title: string;
  /** The heading line as it was read, with its line break; null once the title is edited. */
  heading: string | null;
  /** Every line under the heading, exactly as written. */
  rest: string;
};

export type SectionedBody = {
  /** Text before the first heading; it stays on top and is never a row. */
  preamble: string;
  sections: TemplateSection[];
};

export type SectionKind = "heading" | "tasks" | "text";

const HEADING = /^(#{1,6})[ \t]+(\S.*?)[ \t]*\r?\n?$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const CHECKLIST = /^\s*[-*+] \[[ xX]\]/m;
const TASK_FENCE = /^```json tempo\s*\n[^\n]*"type"\s*:\s*"task"/m;

function lines(body: string): string[] {
  return body.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/** Splits a body into its preamble and heading sections. `keyPrefix` keeps keys unique per load. */
export function splitSections(body: string, keyPrefix = "s"): SectionedBody {
  let preamble = "";
  const sections: TemplateSection[] = [];
  let fence: { char: string; size: number } | null = null;
  for (const line of lines(body)) {
    const open = FENCE.exec(line);
    if (open) {
      const marker = open[1] as string;
      if (!fence) fence = { char: marker[0] as string, size: marker.length };
      else if (marker[0] === fence.char && marker.length >= fence.size && line.trim() === marker) fence = null;
    } else if (!fence) {
      const heading = HEADING.exec(line);
      if (heading) {
        sections.push({
          key: `${keyPrefix}${sections.length}`,
          level: (heading[1] as string).length,
          title: heading[2] as string,
          heading: line,
          rest: "",
        });
        continue;
      }
    }
    const current = sections[sections.length - 1];
    if (current) current.rest += line;
    else preamble += line;
  }
  return { preamble, sections };
}

function headingLine(section: TemplateSection, fallbackTitle: string): string {
  if (section.heading !== null) return section.heading;
  const title = section.title.replace(/\s+/g, " ").trim() || fallbackTitle;
  return `${"#".repeat(section.level)} ${title}\n`;
}

/**
 * The body again. Untouched rows give back the exact text they were read from; an edited
 * title rewrites only its own heading line (a blank one falls back to `fallbackTitle`).
 */
export function joinSections(doc: SectionedBody, fallbackTitle: string): string {
  const parts = [doc.preamble, ...doc.sections.map((s) => headingLine(s, fallbackTitle) + s.rest)];
  let out = "";
  for (const part of parts) {
    if (!part) continue;
    // A moved last row may have no line break; the next row must still start on its own line.
    if (out && !out.endsWith("\n")) out += "\n";
    out += part;
  }
  return out;
}

/** Moves one row up (-1) or down (+1). Out-of-range moves return the same doc. */
export function moveSection(doc: SectionedBody, index: number, delta: -1 | 1): SectionedBody {
  const to = index + delta;
  if (index < 0 || index >= doc.sections.length || to < 0 || to >= doc.sections.length) return doc;
  const sections = [...doc.sections];
  const [row] = sections.splice(index, 1);
  sections.splice(to, 0, row as TemplateSection);
  return { ...doc, sections };
}

export function removeSection(doc: SectionedBody, index: number): SectionedBody {
  if (index < 0 || index >= doc.sections.length) return doc;
  return { ...doc, sections: doc.sections.filter((_, i) => i !== index) };
}

/** Puts a row back where it was (the Undo after Remove). */
export function insertSection(doc: SectionedBody, index: number, section: TemplateSection): SectionedBody {
  const sections = [...doc.sections];
  sections.splice(Math.max(0, Math.min(index, sections.length)), 0, section);
  return { ...doc, sections };
}

export function renameSection(doc: SectionedBody, index: number, title: string): SectionedBody {
  const row = doc.sections[index];
  if (!row || row.title === title) return doc;
  const sections = [...doc.sections];
  sections[index] = { ...row, title, heading: null };
  return { ...doc, sections };
}

/** A new, empty section heading at level 2 ("## …"). */
export function newSection(key: string, title = ""): TemplateSection {
  return { key, level: 2, title, heading: null, rest: "" };
}

/** What a section holds, for the row's label: tasks (checklist or task block), text, or only a heading. */
export function sectionKind(section: TemplateSection): SectionKind {
  if (CHECKLIST.test(section.rest) || TASK_FENCE.test(section.rest)) return "tasks";
  return section.rest.trim() ? "text" : "heading";
}
