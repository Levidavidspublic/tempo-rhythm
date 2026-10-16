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

  test("a fenced code block is never the title, and neither is its info string", () => {
    expect(deriveTitle(`${STUDY_BLOCK}\nCell notes`)).toBe("Cell notes");
    expect(deriveTitle("```python\nprint('hi')\n```\nLoops in Python")).toBe("Loops in Python");
    expect(deriveTitle("  ~~~\nraw text\n~~~~\n# After the code")).toBe("After the code");
    // A shorter or different fence doesn't close the block (CommonMark).
    expect(deriveTitle("````\n```\nstill code\n````\nOutside")).toBe("Outside");
    expect(deriveTitle("```\nonly code, never closed")).toBe("");
    // Inline code in a normal line still gives a title, without its backticks.
    expect(deriveTitle("Use `map` here")).toBe("Use map here");
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

describe("long text stays quick", () => {
  // A long run of spaces in the middle of the text: `/\s+$/` backtracks over it once per
  // start position in V8, which took seconds for 80k spaces (review finding, T9).
  const runs = [
    `x${" ".repeat(200_000)}y`,
    `x${"\t".repeat(200_000)}y`,
    `x${"\u00a0".repeat(200_000)}y`,
  ];

  test("a 200k whitespace run goes through every helper in well under a second", () => {
    const start = performance.now();
    for (const text of runs) {
      normaliseNewlines(text);
      deriveTitle(text);
      toPageBody(text);
      interpretFile("a.txt", text);
    }
    expect(performance.now() - start).toBeLessThan(500);
    expect(normaliseNewlines(`a${" ".repeat(200_000)}`)).toBe("a");
  });

  // Bun runs JavaScriptCore, which doesn't backtrack on `/\s+$/`; Chrome runs V8, which does.
  // When Node (V8) is on the machine, run the same helpers there too.
  const node = Bun.which("node");
  test.skipIf(!node)(
    "and in V8 (the engine in Chrome) too",
    async () => {
      const source = await Bun.file(
        `${import.meta.dir}/../../../apps/web/components/ingest/ingest-text.ts`
      ).text();
      const js = new Bun.Transpiler({ loader: "ts" }).transformSync(source);
      const bench = [
        js,
        "const runs = ['x' + ' '.repeat(200000) + 'y', 'x' + '\\t'.repeat(200000) + 'y'];",
        "let worst = 0;",
        "for (const text of runs) {",
        "  const start = performance.now();",
        "  normaliseNewlines(text); deriveTitle(text); toPageBody(text); interpretFile('a.txt', text);",
        "  worst = Math.max(worst, performance.now() - start);",
        "}",
        "console.log(JSON.stringify({ worst }));",
      ].join("\n");
      const run = Bun.spawnSync({
        cmd: [node ?? "node", "--input-type=module", "-e", bench],
        timeout: 15_000,
      });
      expect(run.exitCode).toBe(0);
      const { worst } = JSON.parse(run.stdout.toString().trim()) as { worst: number };
      expect(worst).toBeLessThan(500);
    },
    20_000
  );

  test("the size check never encodes text that is longer than the limit in characters", () => {
    const Real = globalThis.TextEncoder;
    let encoded = 0;
    globalThis.TextEncoder = class extends Real {
      override encode(input?: string) {
        encoded += input?.length ?? 0;
        return super.encode(input);
      }
    };
    try {
      expect(isTooLarge("a".repeat(5_000_000))).toBe(true);
      expect(encoded).toBe(0);
      // Within the character limit it still counts UTF-8 bytes: Hebrew letters take two.
      expect(isTooLarge("א".repeat(INGEST_MAX_BYTES / 2 + 1))).toBe(true);
      expect(isTooLarge("א".repeat(INGEST_MAX_BYTES / 2))).toBe(false);
    } finally {
      globalThis.TextEncoder = Real;
    }
  });

  test("the title comes from the first 4,096 characters, so a huge paste isn't scanned each key", () => {
    expect(deriveTitle(`Real title\n${"x ".repeat(3_000_000)}`)).toBe("Real title");
    expect(deriveTitle(`${"\n".repeat(5000)}Too far down`)).toBe("");
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
