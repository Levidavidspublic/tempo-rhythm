/**
 * A page is its Markdown body (`notes.body`, OVERNIGHT-RUN.md decision 1). Mobile shows a simple
 * read view and edits the body as plain text; nothing here stores a second representation.
 *
 * Tempo blocks are ```json tempo fences inside the body. Their JSON is never shown: the read view
 * draws a quiet card, and the text editor shows a one-line placeholder that is put back
 * byte-for-byte on save. Fence recognition follows the shared codec's rules for openers (no
 * indent, exactly three backticks, info `json tempo`) and treats tempo-looking lines inside an
 * ordinary code fence as code. Pure: no React Native imports.
 */

export type TempoInfo =
  | { type: "task"; title: string; done: boolean }
  | { type: "template"; name: string }
  | { type: "page-meta"; tags: string[] }
  | { type: "unknown" };

export type Segment = { kind: "text"; source: string } | { kind: "tempo"; source: string; info: TempoInfo };

const LINE = /[^\r\n]*(?:\r\n|\r|\n|$)/g;

/** Lines of `body`, each with its own line ending; joining them gives the body back. */
export function splitLines(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(LINE)) {
    if (m[0] === "") break;
    out.push(m[0]);
  }
  return out;
}

function content(line: string): string {
  return line.replace(/(?:\r\n|\r|\n)$/, "");
}

function readTempo(json: string): TempoInfo {
  try {
    const value = JSON.parse(json) as { type?: unknown; data?: Record<string, unknown> };
    const data = value?.data ?? {};
    if (value?.type === "task" && typeof data.title === "string") {
      return { type: "task", title: data.title, done: data.status === "done" };
    }
    if (value?.type === "template" && typeof data.name === "string") return { type: "template", name: data.name };
    if (value?.type === "page-meta") {
      const tags = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : [];
      return { type: "page-meta", tags };
    }
  } catch {
    // A block that does not parse is shown as "edit on the web", never as raw text.
  }
  return { type: "unknown" };
}

/** Splits a body into prose and Tempo fences. Joining every `source` gives the body back exactly. */
export function splitTempoFences(body: string): Segment[] {
  const out: Segment[] = [];
  let text = "";
  let ordinary: { marker: string; length: number } | null = null;
  let tempo: { source: string; json: string } | null = null;
  for (const line of splitLines(body)) {
    const c = content(line);
    if (tempo) {
      tempo.source += line;
      if (/^```[\t ]*$/.test(c)) {
        out.push({ kind: "tempo", source: tempo.source, info: readTempo(tempo.json) });
        tempo = null;
      } else {
        tempo.json += `${c}\n`;
      }
      continue;
    }
    const fence = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(c);
    if (ordinary) {
      if (fence && fence[2]?.[0] === ordinary.marker && (fence[2]?.length ?? 0) >= ordinary.length && /^[\t ]*$/.test(fence[3] ?? "")) {
        ordinary = null;
      }
      text += line;
      continue;
    }
    if (fence && fence[1] === "" && fence[2] === "```" && /^json tempo[\t ]*$/.test(fence[3] ?? "")) {
      if (text) out.push({ kind: "text", source: text });
      text = "";
      tempo = { source: line, json: "" };
      continue;
    }
    if (fence) ordinary = { marker: fence[2]?.[0] ?? "`", length: fence[2]?.length ?? 3 };
    text += line;
  }
  // An unclosed tempo fence stays prose, exactly as written, joined to the prose before it.
  if (tempo) {
    const prev = out[out.length - 1];
    if (prev?.kind === "text") {
      out.pop();
      text = prev.source + tempo.source;
    } else {
      text = tempo.source;
    }
  }
  if (text) out.push({ kind: "text", source: text });
  return out;
}

/** Tags from the page-meta block (the only place tags live). */
export function pageTags(body: string): string[] {
  for (const seg of splitTempoFences(body)) {
    if (seg.kind === "tempo" && seg.info.type === "page-meta") return seg.info.tags;
  }
  return [];
}

const PLACEHOLDER = /⟦(\d+)[^⟧\r\n]*⟧/g;

/**
 * The body for the plain-text editor: each Tempo fence becomes one line `⟦n · label⟧`.
 * `unmaskTempoBlocks` puts the fences back; an untouched text round-trips byte for byte.
 */
export function maskTempoBlocks(body: string, label: (info: TempoInfo) => string): { text: string; fences: string[] } {
  const fences: string[] = [];
  let text = "";
  for (const seg of splitTempoFences(body)) {
    if (seg.kind === "text") {
      text += seg.source;
      continue;
    }
    fences.push(seg.source);
    const eol = /(?:\r\n|\r|\n)$/.exec(seg.source)?.[0] ?? "";
    const name = label(seg.info).replace(/[⟦⟧\r\n]/g, "");
    text += `⟦${fences.length}${name ? ` · ${name}` : ""}⟧${eol}`;
  }
  return { text, fences };
}

/** Puts each fence back where its placeholder is. A removed placeholder removes its block. */
export function unmaskTempoBlocks(text: string, fences: readonly string[]): string {
  return text.replace(PLACEHOLDER, (whole, n: string) => {
    const source = fences[Number(n) - 1];
    if (source === undefined) return whole;
    return source.replace(/(?:\r\n|\r|\n)$/, "");
  });
}

/**
 * A page's page-meta block (what a dated page is, and its tags) can't be removed in the plain
 * editor: if its placeholder was deleted, the block goes back at the top, where pages keep it.
 */
export function keepPageMeta(next: string, original: string): string {
  const meta = splitTempoFences(original).find((seg) => seg.kind === "tempo" && seg.info.type === "page-meta");
  if (!meta) return next;
  const fence = meta.source.replace(/(?:\r\n|\r|\n)$/, "");
  if (next.includes(fence)) return next;
  const eol = /(?:\r\n|\r|\n)$/.exec(meta.source)?.[0] || "\n";
  return `${fence}${eol}${next}`;
}

/* ------------------------------------------------------------------ */
/* Read view                                                            */
/* ------------------------------------------------------------------ */

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean; link?: boolean };

export type ViewBlock =
  | { kind: "heading"; level: 1 | 2 | 3; inlines: Inline[] }
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "bullet"; depth: number; marker: string; inlines: Inline[] }
  | { kind: "check"; depth: number; checked: boolean; line: number; inlines: Inline[] }
  | { kind: "quote"; inlines: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "rule" }
  | { kind: "tempo"; info: TempoInfo };

/** Bold, italic, inline code, [text](url) and [[wikilinks]]; everything else stays as typed. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]*\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) out.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith("`")) out.push({ text: tok.slice(1, -1), code: true });
    else if (tok.startsWith("[[")) out.push({ text: (tok.slice(2, -2).split("|").pop() ?? "").trim(), link: true });
    else if (tok.startsWith("[")) out.push({ text: tok.slice(1, tok.indexOf("](")), link: true });
    else out.push({ text: tok.slice(1, -1), italic: true });
    last = at + tok.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.filter((i) => i.text.length > 0);
}

/** The body as blocks for the read view. `line` on a checkbox is its 0-based line in the body. */
export function parseMarkdownView(body: string): ViewBlock[] {
  const blocks: ViewBlock[] = [];
  let lineNo = 0;
  for (const seg of splitTempoFences(body)) {
    const segLines = splitLines(seg.source);
    if (seg.kind === "tempo") {
      if (seg.info.type !== "page-meta") blocks.push({ kind: "tempo", info: seg.info });
      lineNo += segLines.length;
      continue;
    }
    let para: string[] = [];
    let code: { marker: string; text: string[] } | null = null;
    const flush = () => {
      if (para.length) blocks.push({ kind: "paragraph", inlines: parseInline(para.join(" ")) });
      para = [];
    };
    for (const raw of segLines) {
      const c = content(raw);
      const at = lineNo;
      lineNo += 1;
      if (code) {
        if (new RegExp(`^ {0,3}${code.marker === "`" ? "`{3,}" : "~{3,}"}[\\t ]*$`).test(c)) {
          blocks.push({ kind: "code", text: code.text.join("\n") });
          code = null;
        } else {
          code.text.push(c);
        }
        continue;
      }
      const fence = /^ {0,3}(`{3,}|~{3,})/.exec(c);
      if (fence) {
        flush();
        code = { marker: fence[1]?.[0] ?? "`", text: [] };
        continue;
      }
      if (!c.trim()) {
        flush();
        continue;
      }
      const heading = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(c);
      if (heading) {
        flush();
        const level = Math.min(heading[1]?.length ?? 1, 3) as 1 | 2 | 3;
        blocks.push({ kind: "heading", level, inlines: parseInline(heading[2] ?? "") });
        continue;
      }
      if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(c)) {
        flush();
        blocks.push({ kind: "rule" });
        continue;
      }
      const check = /^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(c);
      if (check) {
        flush();
        blocks.push({
          kind: "check",
          depth: Math.floor((check[1]?.length ?? 0) / 2),
          checked: check[2] !== " ",
          line: at,
          inlines: parseInline(check[3] ?? ""),
        });
        continue;
      }
      const bullet = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(c);
      if (bullet) {
        flush();
        const marker = bullet[2] ?? "-";
        blocks.push({
          kind: "bullet",
          depth: Math.floor((bullet[1]?.length ?? 0) / 2),
          marker: /\d/.test(marker) ? marker.replace(")", ".") : "•",
          inlines: parseInline(bullet[3] ?? ""),
        });
        continue;
      }
      const quote = /^ {0,3}>\s?(.*)$/.exec(c);
      if (quote) {
        flush();
        blocks.push({ kind: "quote", inlines: parseInline(quote[1] ?? "") });
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(c)) {
        flush();
        const prev = blocks[blocks.length - 1];
        if (prev?.kind === "code") prev.text += `\n${c.trim()}`;
        else blocks.push({ kind: "code", text: c.trim() });
        continue;
      }
      para.push(c.trim());
    }
    flush();
    if (code) blocks.push({ kind: "code", text: code.text.join("\n") });
  }
  return blocks;
}

/**
 * Ticks or unticks the `- [ ]` checkbox on 0-based `line`. Only that one character changes; the
 * body comes back unchanged when the line is not a checkbox.
 */
export function toggleCheckbox(body: string, line: number): string {
  const all = splitLines(body);
  const target = all[line];
  if (target === undefined) return body;
  const m = /^(\s*[-*+]\s+\[)( |x|X)(\][\s\S]*)$/.exec(target);
  if (!m) return body;
  all[line] = `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}`;
  return all.join("");
}

/** True when the body has nothing to read once page details are left out. */
export function isBlankBody(body: string): boolean {
  return splitTempoFences(body).every((s) => (s.kind === "text" ? !s.source.trim() : s.info.type === "page-meta"));
}
