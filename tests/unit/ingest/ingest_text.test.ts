/**
 * IngestSheet helpers (T8-T10 spec, S2): HTML to text, newlines, tempo-fence escaping, titles,
 * the size limit and the file-type check.
 */
import { describe, expect, test } from "bun:test";
import { ingestCopy } from "../../../apps/web/components/ingest/copy";
import {
  deriveTitle,
  escapeTempoFences,
  fileKind,
  INGEST_MAX_BYTES,
  interpretFile,
  isTooLarge,
  nodeToText,
  normaliseNewlines,
  stripHtmlFallback,
  type TextNodeLike,
  textBytes,
  toPageBody,
} from "../../../apps/web/components/ingest/ingest-text";
import { en, he } from "../../../apps/web/lib/i18n-groups/ingest";
import { parseTempoBlocks } from "../../../packages/utils/src/blocks";

const STUDY_BLOCK = [
  "```json tempo",
  '{"type":"flashcards","id":"blk_01HZY3K8R6V1QW9M2N4P5T7XYZ","data":{"title":"x","cards":[]}}',
  "```",
].join("\n");

describe("normaliseNewlines", () => {
  test("CRLF and CR become LF, the BOM and NULs go, blank runs shrink to one", () => {
    const bom = String.fromCharCode(0xfeff);
    const nul = String.fromCharCode(0);
    expect(normaliseNewlines(`${bom}one\r\ntwo\rthree${nul}\n\n\n\n  \nfour  \n\n`)).toBe(
      "one\ntwo\nthree\n\nfour"
    );
  });

  test("keeps a Markdown hard break (two trailing spaces) inside the text", () => {
    expect(normaliseNewlines("line one  \nline two")).toBe("line one  \nline two");
  });
});

describe("escapeTempoFences", () => {
  test("a pasted json tempo fence never becomes a block", () => {
    expect(parseTempoBlocks(STUDY_BLOCK).some((s) => s.kind !== "markdown")).toBe(true);
    const safe = toPageBody(`Notes\n\n${STUDY_BLOCK}\n`);
    expect(safe).toContain("\\```json tempo");
    expect(parseTempoBlocks(safe).every((s) => s.kind === "markdown")).toBe(true);
  });

  test("variants are escaped too: indent, longer fences, tildes, case and spacing", () => {
    const input = ["  ```json tempo", "````json tempo", "~~~ json  tempo", "```JSON Tempo"].join(
      "\n"
    );
    const out = escapeTempoFences(input).split("\n");
    expect(out).toEqual([
      "  \\```json tempo",
      "\\````json tempo",
      "\\~~~ json  tempo",
      "\\```JSON Tempo",
    ]);
  });

  test("ordinary code fences stay as they are", () => {
    const code = "```ts\nconst a = 1;\n```\n```json\n{}\n```";
    expect(escapeTempoFences(code)).toBe(code);
  });
});

describe("HTML to text", () => {
  const html = [
    "<!doctype html><html><head><title>T</title><style>p{color:red}</style>",
    "<script>window.hacked = true</script></head><body>",
    "<h1>Cell biology</h1><p>The <b>cell</b>&nbsp;is the unit &amp; base.</p>",
    "<ul><li>Nucleus</li><li>Ribosome</li></ul><!-- hidden --><p>Line<br>break</p>",
    '<noscript>enable js</noscript><img src="x" onerror="alert(1)"></body></html>',
  ].join("");

  test("the fallback stripper keeps text, drops scripts, styles and comments", () => {
    const text = stripHtmlFallback(html);
    expect(text).toBe(
      "Cell biology\n\nThe cell is the unit & base.\n\n- Nucleus\n- Ribosome\n\nLine\nbreak"
    );
    expect(text).not.toContain("hacked");
    expect(text).not.toContain("color");
    expect(text).not.toContain("hidden");
  });

  test("the DOM walker gives paragraphs and list items and skips scripts", () => {
    const el = (nodeName: string, ...childNodes: TextNodeLike[]): TextNodeLike => ({
      nodeType: 1,
      nodeName,
      childNodes,
    });
    const txt = (nodeValue: string): TextNodeLike => ({
      nodeType: 3,
      nodeName: "#text",
      nodeValue,
      childNodes: [],
    });
    const body = el(
      "BODY",
      el("H2", txt("Plants")),
      el("SCRIPT", txt("steal()")),
      el("P", txt("Leaves   make "), el("EM", txt("food")), txt(".")),
      el("UL", el("LI", txt("Root")), el("LI", txt("Stem"))),
      el("P", txt("a"), el("BR"), txt("b"))
    );
    expect(nodeToText(body)).toBe("Plants\n\nLeaves make food.\n\n- Root\n- Stem\n\na\nb");
  });

  test("Hebrew text survives untouched", () => {
    expect(stripHtmlFallback("<p>שלום עולם</p>")).toBe("שלום עולם");
  });
});

describe("titles", () => {
  test("from the file name without its extension", () => {
    expect(deriveTitle("whatever", "Biology_notes week 3.md")).toBe("Biology notes week 3");
  });

  test("from the first line with words, without Markdown marks", () => {
    expect(deriveTitle("\n\n## **Photosynthesis** basics\nmore")).toBe("Photosynthesis basics");
    expect(deriveTitle("---\n- 12 things to know")).toBe("12 things to know");
    expect(deriveTitle("   \n")).toBe("");
  });

  test("long first lines are cut at a word", () => {
    const title = deriveTitle(`${"word ".repeat(40)}end`);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith("word")).toBe(true);
  });
});

describe("files and size", () => {
  test("only text, Markdown, CSV and HTML files are read", () => {
    expect(fileKind("a.txt")).toBe("text");
    expect(fileKind("a.MD")).toBe("text");
    expect(fileKind("a.markdown")).toBe("text");
    expect(fileKind("a.csv")).toBe("text");
    expect(fileKind("a.html")).toBe("html");
    expect(fileKind("a.htm")).toBe("html");
    expect(fileKind("a.pdf", "application/pdf")).toBeNull();
    expect(fileKind("a.docx")).toBeNull();
    expect(fileKind("pasted", "text/plain")).toBe("text");
  });

  test("the limit is 200 KB of UTF-8 text", () => {
    expect(INGEST_MAX_BYTES).toBe(204800);
    expect(textBytes("א")).toBe(2);
    expect(isTooLarge("a".repeat(INGEST_MAX_BYTES))).toBe(false);
    expect(isTooLarge("a".repeat(INGEST_MAX_BYTES + 1))).toBe(true);
  });

  test("interpretFile names each problem", () => {
    expect(interpretFile("a.pdf", "x")).toEqual({ ok: false, problem: "type" });
    expect(interpretFile("a.txt", " \n\r\n ")).toEqual({ ok: false, problem: "empty" });
    expect(interpretFile("a.html", "<script>only()</script>")).toEqual({
      ok: false,
      problem: "empty",
    });
    expect(interpretFile("a.txt", "a".repeat(INGEST_MAX_BYTES + 1))).toEqual({
      ok: false,
      problem: "too_large",
    });
    expect(interpretFile("notes.html", "<p>Hi there</p>")).toEqual({
      ok: true,
      text: "Hi there",
      title: "notes",
    });
  });
});

describe("copy", () => {
  const bad = /\b(failed|failure|must|overdue|streak)\b/i;
  const emoji = /\p{Extended_Pictographic}/u;

  test("English and Hebrew have the same keys and kind words", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const value of [...Object.values(en), ...Object.values(he)]) {
      expect(value).not.toMatch(bad);
      expect(value).not.toMatch(emoji);
      expect(value).not.toContain("—");
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  test("slots are filled", () => {
    expect(ingestCopy("en")("ig.count", { n: 12 })).toBe("12 characters");
    expect(ingestCopy("he")("ig.file.read", { name: "a.md" })).toContain("a.md");
  });
});
