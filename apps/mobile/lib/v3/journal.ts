import { splitLines } from "./markdown";

/**
 * Journal (docs/design/v3/screens/mobile/journal.html) on the one page model: today's entry is a
 * "## Journal" section in today's daily page, written as plain Markdown. Reading it back fills the
 * form; saving replaces only that section. Pure: no React Native imports.
 */

export type Mood = "low" | "okay" | "good";

/** Copy in both languages, so a page written in one language reads back in the other. */
export type JournalLabels = {
  heading: readonly string[];
  moodQ: readonly string[];
  q1: readonly string[];
  q2: readonly string[];
  mood: Readonly<Record<Mood, readonly string[]>>;
};

export type JournalEntry = { mood: Mood | null; q1: string; q2: string };

/** The section as Markdown, in one language. Empty parts are left out. */
export function buildJournalSection(
  entry: JournalEntry,
  copy: { heading: string; moodQ: string; q1: string; q2: string; mood: Record<Mood, string> },
): string {
  const parts: string[] = [`## ${copy.heading}`];
  if (entry.mood) parts.push(`**${copy.moodQ}** ${copy.mood[entry.mood]}`);
  const q1 = entry.q1.trim();
  const q2 = entry.q2.trim();
  if (q1) parts.push(`**${copy.q1}**\n${q1}`);
  if (q2) parts.push(`**${copy.q2}**\n${q2}`);
  return `${parts.join("\n\n")}\n`;
}

function isHeading(line: string, labels: readonly string[]): boolean {
  const m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
  return !!m && labels.includes((m[1] ?? "").trim());
}

/** Where the journal section sits in `body`: from its heading to the next # or ## heading. */
export function findJournalSection(body: string, headings: readonly string[]): { start: number; end: number } | null {
  let offset = 0;
  let start = -1;
  let inCode = false;
  for (const line of splitLines(body)) {
    const text = line.replace(/(?:\r\n|\r|\n)$/, "");
    if (/^ {0,3}(`{3,}|~{3,})/.test(text)) inCode = !inCode;
    if (!inCode) {
      if (start < 0 && isHeading(text, headings)) start = offset;
      else if (start >= 0 && /^#{1,2}\s/.test(text)) return { start, end: offset };
    }
    offset += line.length;
  }
  return start >= 0 ? { start, end: body.length } : null;
}

/**
 * Reads a journal section back into the form. Lines that are not under a known label are kept
 * in `q1`, so saving again never drops what was written there.
 */
export function parseJournalSection(section: string, labels: JournalLabels): JournalEntry {
  let mood: Mood | null = null;
  const answers: Record<"q1" | "q2" | "rest", string[]> = { q1: [], q2: [], rest: [] };
  let current: "q1" | "q2" | "rest" = "rest";
  const lines = section.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    if (i === 0 && isHeading(line, labels.heading)) continue;
    const label = /^\*\*(.+?)\*\*\s*(.*)$/.exec(line.trim());
    if (label) {
      const name = (label[1] ?? "").trim();
      const tail = (label[2] ?? "").trim();
      if (labels.moodQ.includes(name)) {
        for (const [key, words] of Object.entries(labels.mood) as [Mood, readonly string[]][]) {
          if (words.includes(tail)) mood = key;
        }
        current = "rest";
        continue;
      }
      if (labels.q1.includes(name) || labels.q2.includes(name)) {
        current = labels.q1.includes(name) ? "q1" : "q2";
        if (tail) answers[current].push(tail);
        continue;
      }
    }
    answers[current].push(line);
  }
  const join = (rows: string[]) => rows.join("\n").trim();
  const rest = join(answers.rest);
  const q1 = join(answers.q1);
  return { mood, q1: rest ? (q1 ? `${q1}\n\n${rest}` : rest) : q1, q2: join(answers.q2) };
}

/** The entry already in `body`, or null when today's page has no journal section yet. */
export function readJournal(body: string, labels: JournalLabels): JournalEntry | null {
  const at = findJournalSection(body, labels.heading);
  return at ? parseJournalSection(body.slice(at.start, at.end), labels) : null;
}

/** `body` with its journal section replaced by `section`, or with `section` added at the end. */
export function upsertJournalSection(body: string, section: string, headings: readonly string[]): string {
  const at = findJournalSection(body, headings);
  if (at) {
    const after = body.slice(at.end);
    return `${body.slice(0, at.start)}${section}${after ? `\n${after.replace(/^\n+/, "")}` : ""}`;
  }
  const head = body.replace(/\s+$/, "");
  return head ? `${head}\n\n${section}` : section;
}
