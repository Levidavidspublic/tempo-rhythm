import { parseTempoBlocks } from "@tempo/utils";

/**
 * Pure helpers for the ShareSheet (S26, PRD F-90). Nothing here touches the network: every file
 * is made in the browser from text the page already holds.
 */

export type ShareCard = { front: string; back: string };

/** One Anki field's text: tabs and line breaks would split the row, so they become single spaces. */
function ankiField(text: string): string {
  return text.replace(/[\t\r\n]+/g, " ").trim();
}

/**
 * A field as Anki's importer quotes it: in double quotes, with any `"` inside doubled. Quoting
 * keeps a leading `#` from being read as a comment and a stray `"` from merging rows.
 */
function ankiQuoted(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/** The header Anki reads first: tab-separated fields, plain text (not HTML). */
export const ANKI_HEADER = "#separator:tab\n#html:false\n";

/**
 * Cards as Anki's plain-text import reads them: the header, then `"front"<TAB>"back"`, one card
 * per line. Cards with an empty side after cleaning are left out, since Anki would reject them;
 * no cards gives an empty file.
 */
export function toAnkiTsv(cards: readonly ShareCard[]): string {
  const lines: string[] = [];
  for (const card of cards) {
    const front = ankiField(card.front);
    const back = ankiField(card.back);
    if (front && back) lines.push(`${ankiQuoted(front)}\t${ankiQuoted(back)}`);
  }
  return lines.length ? `${ANKI_HEADER}${lines.join("\n")}\n` : "";
}

function baseName(title: string): string {
  const cleaned = title
    .trim()
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what a file name must drop
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || "Untitled";
}

/** `My page.md`: the title with the characters a file name can't hold taken out. */
export function markdownFileName(title: string): string {
  return `${baseName(title)}.md`;
}

/** `My deck (Anki).txt`: Anki imports plain text files. */
export function ankiFileName(title: string): string {
  return `${baseName(title)} (Anki).txt`;
}

/** Every flashcard in a page's study blocks, in page order. */
export function flashcardsInBody(body: string): ShareCard[] {
  const cards: ShareCard[] = [];
  for (const segment of parseTempoBlocks(body)) {
    if (segment.kind === "valid" && segment.block.type === "flashcards") {
      for (const card of segment.block.data.cards) cards.push({ front: card.front, back: card.back });
    }
  }
  return cards;
}

/** True when the browser has a system share sheet (`navigator.share`). */
export function canSystemShare(nav: { share?: unknown } | undefined): boolean {
  return typeof nav?.share === "function";
}

/** How long the object URL lives after the click: some browsers start the download late. */
export const DOWNLOAD_REVOKE_MS = 5_000;

/** Saves `text` as a file through a short-lived object URL, revoked a few seconds after. */
export function downloadText(text: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_MS);
}
