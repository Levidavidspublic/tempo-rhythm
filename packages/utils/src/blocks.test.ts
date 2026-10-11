import { build } from "bun";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as convexCompat from "../../../convex/lib/blocks";
import * as shared from "./blocks";
import * as utils from "./index";

/**
 * The block codec is one pure module (`./blocks`). These tests run the same fixture matrix through
 * its three entry points: the shared module itself, the `@tempo/utils` public index (what the
 * browser imports) and the Convex compatibility re-export (`convex/lib/blocks.ts`). Fixtures are
 * synthetic. Duplicating fixtures here is deliberate; duplicating production codec code is not.
 */

const RUNTIME_EXPORTS = [
  "BLOCK_CODEC_LIMITS",
  "pageMetaDataSchema",
  "parseTempoBlocks",
  "serializeTempoBlocks",
  "taskDataSchema",
  "tempoBlockSchema",
  "templateDataSchema",
] as const;

type Codec = Pick<typeof shared, (typeof RUNTIME_EXPORTS)[number]>;

/** The seven runtime exports of an entry point, read by static property access. */
function codecOf(entry: Codec): Codec {
  return {
    BLOCK_CODEC_LIMITS: entry.BLOCK_CODEC_LIMITS,
    pageMetaDataSchema: entry.pageMetaDataSchema,
    parseTempoBlocks: entry.parseTempoBlocks,
    serializeTempoBlocks: entry.serializeTempoBlocks,
    taskDataSchema: entry.taskDataSchema,
    tempoBlockSchema: entry.tempoBlockSchema,
    templateDataSchema: entry.templateDataSchema,
  };
}

const entryPoints: [string, Codec][] = [
  ["shared module", codecOf(shared)],
  ["@tempo/utils public index", codecOf(utils)],
  ["Convex compatibility module", codecOf(convexCompat)],
];

const { BLOCK_CODEC_LIMITS, parseTempoBlocks } = shared;

const ids = {
  meta: "blk_01K5F3Z8Q0A7M2N4P6R8T0V2X4",
  task: "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6",
  template: "blk_01K5F3Z8Q4E1N3P5R7T9V1X3Z5",
};

const meta = {
  type: "page-meta",
  id: ids.meta,
  v: 1,
  data: { pageType: "daily", date: "2026-10-09", tags: ["uni", "שלום"] },
};
const task = {
  type: "task",
  id: ids.task,
  v: 1,
  data: { title: "Email supervisor", status: "now", order: 1, inelastic: false },
};
const template = {
  type: "template",
  id: ids.template,
  v: 1,
  data: {
    name: "Gentle day",
    forPageType: "daily",
    isDefault: true,
    tokens: ["date"],
    origin: "builtin",
    status: "live",
    enabled: true,
  },
};

function fence(value: unknown, eol = "\n") {
  return `\`\`\`json tempo${eol}${JSON.stringify(value)}${eol}\`\`\`${eol}`;
}

function nestedArray(depth: number): unknown {
  let nested: unknown = "leaf";
  for (let index = 0; index <= depth; index += 1) nested = [nested];
  return nested;
}

/** Complete shape of a parse result: kind, span and (for broken or valid) code or type. */
function summary(body: string) {
  return parseTempoBlocks(body).map((segment) => [
    segment.kind,
    segment.start,
    segment.end,
    segment.kind === "broken"
      ? segment.errorCode
      : segment.kind === "valid"
        ? segment.block.type
        : null,
  ]);
}

// ---------------------------------------------------------------------------------------------
// Fixture bodies shared by the per-entry-point suites and the cross-entry-point equality check.
// ---------------------------------------------------------------------------------------------

const ordinaryJson = "```json\r\n{not tempo}\r\n```\r\n";
const nestedLooking =
  "````markdown\r\n```json tempo\r\nnot parsed by markdown nesting rules\r\n```\r\n````\r\n";
const indentedContainer = `  \`\`\`\`markdown\n${fence(meta)}   \`\`\`\`\n`;
const unicodeSeparators = [" ", " "];

const fixtureBodies: Record<string, string> = {
  allThreeTypes: `# Thursday 🌱\n\nBefore\n${fence(meta)}between\n${fence(task)}${fence(template)}after`,
  crlfUnicodeAdjacent: `${ordinaryJson}${fence(meta, "\r\n")}${fence(task, "\r\n")}${nestedLooking}עברית`,
  cr: `prefix\r${fence(task, "\r")}suffix`,
  lineSeparator: `prefix ${fence(task)}`,
  paragraphSeparator: `prefix ${fence(task)}`,
  indentedOrdinaryFence: `${indentedContainer}${fence(task)}`,
  exactCloserBothPasses: [
    fence(task).replace("\n```\n", "\n ```\n````markdown\n```\n"),
    fence(meta),
    "````\n",
  ].join(""),
  backtickInfoInvalid: `\`\`\`markdown \` invalid\n${fence(task)}`,
  tildeInfoWithBacktick: `~~~markdown \` allowed\n~~~\n${fence(task)}`,
  tildeUnclosed: `~~~markdown \` allowed and unclosed\n${fence(task)}`,
  unicodeInfoBacktick: `\`\`\`\`markdown example\n${fence(task)}\`\`\`\`\n${fence(meta)}`,
  unicodeInfoTilde: `~~~markdown example\n${fence(task)}~~~\n${fence(meta)}`,
  indentedTempoOpener: ` \`\`\`json tempo\n${JSON.stringify(task)}\n\`\`\`\n${fence(meta)}`,
  indentedTempoCloser: fence(task).replace("\n```\n", "\n ```\n") + fence(meta),
  malformedAndUnclosed: "```json tempo\n{ nope }\n```\n" + "tail\n```json tempo\n{}",
  strictExtraProperty: fence({ ...task, data: { ...task.data, done: false } }),
  unsupportedType: fence({ ...task, type: "event" }),
  unsupportedVersion: fence({ ...task, v: 2 }),
  duplicateId: fence(task) + fence(task),
  duplicatePageMeta: fence(meta) + fence({ ...meta, id: ids.template }),
  reservedByInvalid: fence({ ...task, data: { ...task.data, title: "" } }) + fence(task),
  reservedByNesting: fence({ ...task, data: nestedArray(BLOCK_CODEC_LIMITS.maxJsonDepth) }) + fence(task),
  invalidCalendarDate: fence({ ...meta, data: { ...meta.data, date: "2026-02-30" } }),
  ulidOverflow: fence({ ...task, id: `blk_8${"0".repeat(25)}` }),
  hugeBody: "x".repeat(BLOCK_CODEC_LIMITS.maxBodyChars + 1),
  hugeBlock: fence({
    ...task,
    data: { ...task.data, title: "x".repeat(BLOCK_CODEC_LIMITS.maxBlockChars) },
  }),
  tooManyBlocks: Array.from({ length: BLOCK_CODEC_LIMITS.maxBlocks + 1 }, (_, index) =>
    fence({ ...task, id: `blk_${index.toString(32).toUpperCase().padStart(26, "0")}` }),
  ).join(""),
  htmlComment: `<!--\n${fence(task)}-->\n${fence(meta)}`,
  htmlPre: `<pre>\n${fence(task)}</pre>\n${fence(meta)}`,
  htmlUnclosed: `<!--\n${fence(task)}`,
  htmlInline: `<!-- note -->\n${fence(task)}`,
  htmlCrlf: `<!--\r\n${fence(task, "\r\n")}-->\r\n${fence(meta, "\r\n")}`,
};

// ---------------------------------------------------------------------------------------------
// Public surface, identity and cross-entry-point equality
// ---------------------------------------------------------------------------------------------

describe("shared codec public surface", () => {
  test("every entry point exposes the same runtime objects", () => {
    const direct = codecOf(shared);
    for (const [label, entry] of [
      ["utils", codecOf(utils)],
      ["convex", codecOf(convexCompat)],
    ] as const) {
      for (const name of RUNTIME_EXPORTS) {
        expect(entry[name], `${label}.${name}`).toBe(direct[name]);
      }
    }
  });

  test("the Convex compatibility module exposes exactly the codec, not other utils", () => {
    expect(Object.keys(convexCompat).sort()).toEqual([...RUNTIME_EXPORTS].sort());
    expect(Object.keys(shared).sort()).toEqual([...RUNTIME_EXPORTS].sort());
    for (const name of ["formatDate", "clamp", "buildBreathCycle", "resolveEnergySuggestion"]) {
      expect(name in convexCompat, name).toBe(false);
    }
  });

  test("the utils index keeps its existing exports alongside the codec", () => {
    for (const name of [
      "buildBreathCycle",
      "clamp",
      "formatDate",
      "formatTime",
      "getBreathPhaseAt",
      "getBreathworkSnapshot",
      "habitRoutineCopy",
      "randomId",
      "resolveEnergySuggestion",
      "truncate",
    ]) {
      expect(typeof (utils as Record<string, unknown>)[name], name).not.toBe("undefined");
    }
  });

  test("limits keep their exact values and units", () => {
    expect(BLOCK_CODEC_LIMITS).toEqual({
      maxBodyChars: 1_048_576,
      maxBlockChars: 65_536,
      maxBlocks: 256,
      maxJsonDepth: 16,
      maxShortStringChars: 200,
      maxTextChars: 500,
      maxArrayItems: 100,
    });
  });

  test("every fixture parses to the identical complete result through every entry point", () => {
    for (const [label, body] of Object.entries(fixtureBodies)) {
      const expected = shared.parseTempoBlocks(body);
      for (const [name, codec] of entryPoints) {
        const actual = codec.parseTempoBlocks(body);
        expect(actual, `${name}: ${label}`).toEqual(expected);
        expect(codec.serializeTempoBlocks(actual), `${name}: ${label}`).toBe(body);
        expect(actual.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
      }
    }
  });

  test("golden segment shapes for representative fixtures", () => {
    const { allThreeTypes, htmlComment, duplicateId, hugeBody } = fixtureBodies;
    expect(summary(allThreeTypes ?? "").map(([kind, , , detail]) => [kind, detail])).toEqual([
      ["markdown", null],
      ["valid", "page-meta"],
      ["markdown", null],
      ["valid", "task"],
      ["valid", "template"],
      ["markdown", null],
    ]);
    expect(summary(duplicateId ?? "").map(([kind, , , detail]) => [kind, detail])).toEqual([
      ["valid", "task"],
      ["broken", "duplicate_id"],
    ]);
    expect(summary(hugeBody ?? "")).toEqual([
      ["broken", 0, BLOCK_CODEC_LIMITS.maxBodyChars + 1, "body_too_large"],
    ]);
    const commentEnd = (htmlComment ?? "").indexOf("-->\n") + 4;
    expect(summary(htmlComment ?? "")).toEqual([
      ["markdown", 0, commentEnd, null],
      ["valid", commentEnd, (htmlComment ?? "").length, "page-meta"],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// Browser safety: no Convex, Node, React or platform imports in the shared codec
// ---------------------------------------------------------------------------------------------

describe("shared codec is browser-safe", () => {
  const sourceDir = import.meta.dir;
  const read = (path: string) => readFileSync(path, "utf8");

  function importSpecifiers(source: string): string[] {
    const specifiers: string[] = [];
    for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g)) {
      specifiers.push(match[1] as string);
    }
    for (const match of source.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) {
      specifiers.push(match[1] as string);
    }
    for (const match of source.matchAll(/\b(?:require|import)\(\s*["']([^"']+)["']\s*\)/g)) {
      specifiers.push(match[1] as string);
    }
    return specifiers;
  }

  test("the shared module imports only zod and uses no platform global", () => {
    const source = read(join(sourceDir, "blocks.ts"));
    expect(importSpecifiers(source)).toEqual(["zod"]);
    for (const forbidden of [/\bprocess\b/, /\bBuffer\b/, /\bBun\b/, /\bwindow\b/, /\bdocument\b/, /\bfetch\b/]) {
      expect(source, String(forbidden)).not.toMatch(forbidden);
    }
  });

  test("the Convex module is only a re-export from @tempo/utils with no second codec", () => {
    const source = read(join(sourceDir, "../../../convex/lib/blocks.ts"));
    expect(importSpecifiers(source)).toEqual(["@tempo/utils"]);
    for (const duplicated of [/from\s*["']zod["']/, /\bz\./, /function\s+\w+/, /JSON\.parse/, /=>/]) {
      expect(source, String(duplicated)).not.toMatch(duplicated);
    }
  });

  test("a browser-target bundle of the public entry reaches no Convex, Node or external module", async () => {
    const result = await build({
      entrypoints: [join(sourceDir, "index.ts")],
      target: "browser",
      metafile: true,
    });
    expect(result.success).toBe(true);
    const metafile = result.metafile;
    if (!metafile) throw new Error("Bun.build did not return a metafile");
    const inputs = Object.keys(metafile.inputs).map((path) => path.replaceAll("\\", "/"));
    expect(inputs.some((path) => path.endsWith("packages/utils/src/blocks.ts"))).toBe(true);
    for (const path of inputs) {
      expect(path, path).not.toMatch(/(^|\/)convex(\/|$)|@convex-dev|convex-helpers|\.env/);
      expect(path, path).not.toMatch(/^node:|(^|\/)node:/);
    }
    for (const output of Object.values(metafile.outputs)) {
      expect(output.imports).toEqual([]);
    }
    const text = await result.outputs[0]?.text();
    expect(text).not.toMatch(/node:|convex\/server|process\.env/);
  }, 30_000);
});

// ---------------------------------------------------------------------------------------------
// The complete codec fixture suite, once per entry point
// ---------------------------------------------------------------------------------------------

describe.each(entryPoints)("Tempo block codec through the %s", (_name, codec) => {
  const { parseTempoBlocks: parse, serializeTempoBlocks: serialize } = codec;
  const limits = codec.BLOCK_CODEC_LIMITS;

  function validSegments(body: string) {
    return parse(body).filter((segment) => segment.kind === "valid");
  }

  function brokenCodes(body: string) {
    return parse(body)
      .filter((segment) => segment.kind === "broken")
      .map((segment) => segment.errorCode);
  }

  function expectExactSpans(body: string) {
    const parsed = parse(body);
    expect(serialize(parsed)).toBe(body);
    expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
    let cursor = 0;
    for (const segment of parsed) {
      expect(segment.start).toBe(cursor);
      cursor = segment.end;
    }
    expect(cursor).toBe(body.length);
  }

  function expectProse(body: string) {
    expect(parse(body)).toEqual([{ kind: "markdown", source: body, start: 0, end: body.length }]);
    expectExactSpans(body);
  }

  test("validates all three types, defaults duration, and preserves arbitrary Markdown", () => {
    const body = fixtureBodies.allThreeTypes ?? "";
    const parsed = parse(body);
    const valid = validSegments(body);
    expect(valid).toHaveLength(3);
    expect(valid[1]?.block.type).toBe("task");
    if (valid[1]?.block.type === "task") expect(valid[1].block.data.durationMin).toBe(15);
    expect(serialize(parsed)).toBe(body);
    expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
  });

  test("exports schemas that apply the same defaults and strict properties", () => {
    const parsedTask = codec.tempoBlockSchema.safeParse(task);
    expect(parsedTask.success && parsedTask.data.type === "task" && parsedTask.data.data.durationMin).toBe(15);
    expect(codec.taskDataSchema.safeParse(task.data).success).toBe(true);
    expect(codec.pageMetaDataSchema.safeParse(meta.data).success).toBe(true);
    expect(codec.templateDataSchema.safeParse(template.data).success).toBe(true);
    expect(codec.taskDataSchema.safeParse({ ...task.data, extra: 1 }).success).toBe(false);
    expect(codec.pageMetaDataSchema.safeParse({ ...meta.data, extra: 1 }).success).toBe(false);
    expect(codec.templateDataSchema.safeParse({ ...template.data, extra: 1 }).success).toBe(false);
    expect(codec.tempoBlockSchema.safeParse({ ...task, extra: 1 }).success).toBe(false);
    expect(codec.tempoBlockSchema.safeParse({ ...task, data: { ...task.data, durationMin: 0 } }).success).toBe(false);
    expect(codec.tempoBlockSchema.safeParse({ ...task, data: { ...task.data, durationMin: 1441 } }).success).toBe(false);
  });

  test("preserves CRLF, Unicode, adjacent fences, and ordinary or nested-looking fences", () => {
    const body = fixtureBodies.crlfUnicodeAdjacent ?? "";
    expect(serialize(parse(body))).toBe(body);
    expect(validSegments(body)).toHaveLength(2);
    expect(parse(ordinaryJson)).toEqual([
      { kind: "markdown", source: ordinaryJson, start: 0, end: ordinaryJson.length },
    ]);
  });

  test("recognizes only Markdown CR, LF, and CRLF line boundaries", () => {
    for (const eol of ["\r", "\n", "\r\n"]) {
      const body = `prefix${eol}${fence(task, eol)}suffix`;
      expect(validSegments(body), JSON.stringify(eol)).toHaveLength(1);
      expectExactSpans(body);
    }

    for (const separator of unicodeSeparators) {
      const body = `prefix${separator}${fence(task)}`;
      expect(validSegments(body), JSON.stringify(separator)).toHaveLength(0);
      expectProse(body);
    }
  });

  test("applies CommonMark indentation to ordinary fences without consuming Tempo blocks", () => {
    const body = fixtureBodies.indentedOrdinaryFence ?? "";
    const parsed = parse(body);

    expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.task]);
    expect(parsed[0]).toEqual({
      kind: "markdown",
      source: indentedContainer,
      start: 0,
      end: indentedContainer.length,
    });
    expectExactSpans(body);
  });

  test("uses the exact Tempo closer in both fence passes", () => {
    const body = fixtureBodies.exactCloserBothPasses ?? "";

    expect(brokenCodes(body)).toEqual(["malformed_json"]);
    expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta]);
    expectExactSpans(body);
  });

  test("distinguishes CommonMark backtick and tilde info-string rules", () => {
    const cases = [
      { prefix: "```markdown\n```\n", expected: 1 },
      { prefix: "```markdown ` invalid\n", expected: 1 },
      { prefix: "~~~markdown ` allowed\n~~~\n", expected: 1 },
      { prefix: "~~~markdown ` allowed and unclosed\n", expected: 0 },
    ];

    for (const { prefix, expected } of cases) {
      const body = prefix + fence(task);
      expect(validSegments(body), prefix).toHaveLength(expected);
      expectExactSpans(body);
    }
  });

  test("keeps Unicode separators inside ordinary-fence info strings", () => {
    for (const separator of unicodeSeparators) {
      for (const { opener, closer } of [
        { opener: `\`\`\`\`markdown${separator}example`, closer: "````" },
        { opener: `~~~markdown${separator}example`, closer: "~~~" },
      ]) {
        const body = `${opener}\n${fence(task)}${closer}\n${fence(meta)}`;
        const parsed = parse(body);
        const ordinary = `${opener}\n${fence(task)}${closer}\n`;

        expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta]);
        expect(parsed[0]).toEqual({ kind: "markdown", source: ordinary, start: 0, end: ordinary.length });
        expectExactSpans(body);
      }
    }
  });

  test("does not broaden exact Tempo openers or closers with ordinary-fence whitespace", () => {
    const body = fixtureBodies.indentedTempoOpener ?? "";
    expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta]);
    expectExactSpans(body);

    for (const closing of [" ```", "\t```", "```\v"]) {
      const candidate = fence(task).replace("\n```\n", `\n${closing}\n`) + fence(meta);
      expectExactSpans(candidate);
      expect(validSegments(candidate)).toHaveLength(0);
    }
  });

  test("keeps malformed JSON and unclosed fences as broken source", () => {
    const malformed = "```json tempo\n{ nope }\n```\n";
    const unclosed = "tail\n```json tempo\n{}";
    expect(brokenCodes(malformed)).toEqual(["malformed_json"]);
    expect(brokenCodes(unclosed)).toEqual(["unclosed_fence"]);
    expectExactSpans(malformed + unclosed);
  });

  test("rejects invalid properties, types, versions, duplicate IDs and page-meta blocks", () => {
    expect(brokenCodes(fence({ ...task, data: { ...task.data, done: false } }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...task, extra: true }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...meta, data: { ...meta.data, extra: true } }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...template, data: { ...template.data, extra: true } }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...task, type: "event" }))).toEqual(["unsupported_type"]);
    expect(brokenCodes(fence({ ...task, v: 2 }))).toEqual(["unsupported_version"]);
    expect(brokenCodes(fence([task]))).toEqual(["invalid_envelope"]);
    expect(brokenCodes(fence(task) + fence(task))).toEqual(["duplicate_id"]);
    expect(brokenCodes(fence(meta) + fence({ ...meta, id: ids.template }))).toEqual(["duplicate_page_meta"]);
  });

  test("reserves valid source IDs even when their first block is semantically broken", () => {
    const invalidData = { ...task, data: { ...task.data, title: "" } };
    const duplicateMeta = { ...meta, id: ids.template };
    const laterTaskWithMetaId = { ...task, id: ids.template };

    expect(brokenCodes(fence(invalidData) + fence(task))).toEqual(["invalid_data", "duplicate_id"]);
    expect(brokenCodes(fence(meta) + fence(duplicateMeta) + fence(laterTaskWithMetaId))).toEqual([
      "duplicate_page_meta",
      "duplicate_id",
    ]);
    expectExactSpans(fence(invalidData) + fence(task));
  });

  test("reserves a parsed ID before rejecting excessive nesting", () => {
    const body = fixtureBodies.reservedByNesting ?? "";

    expect(brokenCodes(body)).toEqual(["nesting_too_deep", "duplicate_id"]);
    expect(validSegments(body)).toHaveLength(0);
    expectExactSpans(body);
  });

  test("accepts only real calendar dates and ULIDs without overflow", () => {
    for (const date of ["2024-02-29", "2026-01-31", "2026-12-31"]) {
      expect(validSegments(fence({ ...meta, data: { ...meta.data, date } }))).toHaveLength(1);
    }
    for (const date of ["2023-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "0000-00-00"]) {
      expect(brokenCodes(fence({ ...meta, data: { ...meta.data, date } }))).toEqual(["invalid_data"]);
    }

    const overflowId = `blk_8${"0".repeat(25)}`;
    expect(validSegments(fence({ ...task, id: `blk_7${"Z".repeat(25)}` }))).toHaveLength(1);
    expect(brokenCodes(fence({ ...task, id: overflowId }))).toEqual(["invalid_data"]);
    const brokenOverflow = parse(fence({ ...task, id: overflowId, v: 2 }))[0];
    expect(brokenOverflow).toMatchObject({ kind: "broken", errorCode: "unsupported_version" });
    expect(brokenOverflow?.kind === "broken" && brokenOverflow.blockId).toBeUndefined();
  });

  test("does not invent IDs for broken source but retains a syntactically valid source ID", () => {
    const noId = parse(fence({ type: "task", v: 2, data: {} }))[0];
    const withId = parse(fence({ ...task, v: 2 }))[0];
    expect(noId?.kind === "broken" && noId.blockId).toBeUndefined();
    expect(withId?.kind === "broken" && withId.blockId).toBe(ids.task);
  });

  test("fails safety bounds without truncating or rewriting source", () => {
    const hugeBody = fixtureBodies.hugeBody ?? "";
    const hugeBlock = fixtureBodies.hugeBlock ?? "";
    const deep = fence({ ...task, data: nestedArray(limits.maxJsonDepth) });
    const repeated = fixtureBodies.tooManyBlocks ?? "";

    expect(brokenCodes(hugeBody)).toEqual(["body_too_large"]);
    expect(brokenCodes(hugeBlock)).toEqual(["block_too_large"]);
    expect(brokenCodes(deep)).toEqual(["nesting_too_deep"]);
    expect(brokenCodes(repeated).at(-1)).toBe("too_many_blocks");
    for (const body of [hugeBody, hugeBlock, deep, repeated]) {
      expect(serialize(parse(body))).toBe(body);
    }
  });

  test("enforces every named string, text, and array limit at its boundary", () => {
    const shortAtLimit = "s".repeat(limits.maxShortStringChars);
    const textAtLimit = "t".repeat(limits.maxTextChars);
    const arrayAtLimit = Array.from({ length: limits.maxArrayItems }, () => shortAtLimit);

    expect(validSegments(fence({ ...meta, data: { ...meta.data, tags: arrayAtLimit } }))).toHaveLength(1);
    expect(validSegments(fence({ ...task, data: { ...task.data, title: textAtLimit, reason: textAtLimit } }))).toHaveLength(1);
    expect(validSegments(fence({ ...template, data: { ...template.data, name: textAtLimit, tokens: arrayAtLimit } }))).toHaveLength(1);

    expect(brokenCodes(fence({ ...meta, data: { ...meta.data, tags: [`${shortAtLimit}x`] } }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...task, data: { ...task.data, title: `${textAtLimit}x` } }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...template, data: { ...template.data, tokens: [...arrayAtLimit, "x"] } }))).toEqual(["invalid_data"]);
  });

  test("measures every size limit in UTF-16 code units, not UTF-8 bytes", () => {
    // 1-unit / 2-byte and 2-unit / 4-byte characters: a byte count would reject all of the
    // "at limit" cases below, and a code point count would accept all of the "over limit" ones.
    const twoByte = "é";
    const astral = "😀";
    expect(astral.length).toBe(2);

    const bodyAtLimit = twoByte.repeat(limits.maxBodyChars);
    expect(new TextEncoder().encode(bodyAtLimit).length).toBeGreaterThan(limits.maxBodyChars);
    expect(brokenCodes(bodyAtLimit)).toEqual([]);
    expect(brokenCodes(twoByte.repeat(limits.maxBodyChars + 1))).toEqual(["body_too_large"]);
    expect(brokenCodes(astral.repeat(limits.maxBodyChars / 2))).toEqual([]);
    expect(brokenCodes(`${astral.repeat(limits.maxBodyChars / 2)}x`)).toEqual(["body_too_large"]);

    const block = (json: string) => `\`\`\`json tempo\n${json}\n\`\`\`\n`;
    expect(brokenCodes(block(twoByte.repeat(limits.maxBlockChars)))).toEqual(["malformed_json"]);
    expect(brokenCodes(block(twoByte.repeat(limits.maxBlockChars + 1)))).toEqual(["block_too_large"]);
    expect(brokenCodes(block(astral.repeat(limits.maxBlockChars / 2)))).toEqual(["malformed_json"]);
    expect(brokenCodes(block(astral.repeat(limits.maxBlockChars / 2 + 1)))).toEqual(["block_too_large"]);

    const shortAstral = astral.repeat(limits.maxShortStringChars / 2);
    const textAstral = astral.repeat(limits.maxTextChars / 2);
    expect(validSegments(fence({ ...meta, data: { ...meta.data, tags: [shortAstral] } }))).toHaveLength(1);
    expect(brokenCodes(fence({ ...meta, data: { ...meta.data, tags: [`${shortAstral}${astral}`] } }))).toEqual(["invalid_data"]);
    expect(validSegments(fence({ ...task, data: { ...task.data, title: textAstral } }))).toHaveLength(1);
    expect(brokenCodes(fence({ ...task, data: { ...task.data, title: `${textAstral}${astral}` } }))).toEqual(["invalid_data"]);
  });

  describe("raw HTML blocks keep fence-looking lines as prose", () => {
    const live = fence(task);

    test("an HTML comment spanning lines hides a fence-looking Tempo block", () => {
      expectProse(`<!--\n${live}-->\n`);
      expectProse(`<!--\n${live}-->`);
      expectProse(`<!-- example\n\nmore\n${live}\n-->\n`);
      expect(validSegments(`<!--\n${live}-->\n`)).toHaveLength(0);
      expect(brokenCodes(`<!--\n${live}-->\n`)).toEqual([]);
    });

    test("pre, script, style and textarea blocks hide fences, case-insensitively", () => {
      for (const [open, close] of [
        ["<pre>", "</pre>"],
        ["<PRE>", "</Pre>"],
        ['<pre class="example">', "</pre>"],
        ["<pre", "</pre>"],
        ["<script>", "</script>"],
        ['<script type="text/plain">', "</SCRIPT>"],
        ["<style>", "</style>"],
        ["<textarea>", "</textarea>"],
        ["   <pre>", "</pre>"],
        ["<pre\t>", "</pre>"],
      ] as const) {
        expectProse(`${open}\n${live}${close}\n`);
        expect(validSegments(`${open}\n${live}${close}\n`), open).toHaveLength(0);
      }
    });

    test("the block ends at the first line containing its end marker", () => {
      for (const [open, close] of [
        ["<!--", "-->"],
        ["<pre>", "</pre>"],
        ["<script>", "</script>"],
        ["<style>", "</style>"],
        ["<textarea>", "</textarea>"],
      ] as const) {
        const hidden = `${open}\n${live}${close} tail text\n`;
        const body = `${hidden}${fence(meta)}`;
        expect(validSegments(body).map((segment) => segment.block.id), open).toEqual([ids.meta]);
        expect(parse(body)[0], open).toEqual({ kind: "markdown", source: hidden, start: 0, end: hidden.length });
        expectExactSpans(body);
      }
    });

    test("the end marker may share a line with content and with the fence-looking text", () => {
      const hidden = `<!-- start\n${live}trailing --> and after\n`;
      const body = `${hidden}${fence(meta)}`;
      expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta]);
      expect(parse(body)[0]).toEqual({ kind: "markdown", source: hidden, start: 0, end: hidden.length });
      expectExactSpans(body);
    });

    test("a block that opens and closes on its own line hides nothing after it", () => {
      for (const single of ["<!-- note -->", "<!-->", "<pre>x</pre>", "<script src=a></script>", "<!DOCTYPE html>"]) {
        const body = `${single}\n${live}`;
        expect(validSegments(body).map((segment) => segment.block.id), single).toEqual([ids.task]);
        expectExactSpans(body);
      }
    });

    test("script, style, pre and textarea end at any of their end tags", () => {
      const hidden = `<script>\n${live}</STYLE>\n`;
      const body = `${hidden}${live}`;
      expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.task]);
      expect(parse(body)[0]).toEqual({ kind: "markdown", source: hidden, start: 0, end: hidden.length });
      expectProse(`<pre>\n</div>\n${live}</span>\n`);
    });

    test("processing instructions, declarations and CDATA end at their own markers", () => {
      for (const [open, close] of [
        ["<?php", "?>"],
        ["<!DOCTYPE html", ">"],
        ["<![CDATA[", "]]>"],
      ] as const) {
        expectProse(`${open}\n${live}${close}\n`);
        const body = `${open}\n${live}${close}\n${fence(meta)}`;
        expect(validSegments(body).map((segment) => segment.block.id), open).toEqual([ids.meta]);
        expectExactSpans(body);
      }
    });

    test("an unclosed raw HTML block runs to the end of the document, as in CommonMark", () => {
      expectProse(`<!--\n${live}`);
      expectProse(`before\n<pre>\n${live}${fence(meta)}`);
      expect(brokenCodes(`<!--\n${live}`)).toEqual([]);
      const body = `${live}<!--\n${fence(meta)}`;
      expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.task]);
      expectExactSpans(body);
    });

    test("only lines that start a raw HTML block count", () => {
      for (const notHtml of [
        "    <!--", // indented code, not an HTML block
        "\t<!--",
        "text <!--",
        "<!-",
        "<preview>",
        "<pre-x>",
        "<prefix>",
        "<scripts>",
        "<styled>",
        "<pre >",
        "< !--",
        "`<!--`",
      ]) {
        const body = `${notHtml}\n${live}`;
        expect(validSegments(body).map((segment) => segment.block.id), notHtml).toEqual([ids.task]);
        expectExactSpans(body);
      }
    });

    test("fence-looking lines inside raw HTML do not open ordinary fences", () => {
      for (const marker of ["```", "````", "~~~", "```js", "~~~ md"]) {
        const body = `<!--\n${marker}\n-->\n${live}`;
        expect(validSegments(body).map((segment) => segment.block.id), marker).toEqual([ids.task]);
        expectExactSpans(body);
      }
      const unclosedInside = `<pre>\n\`\`\`\n</pre>\n${fence(meta)}`;
      expect(validSegments(unclosedInside).map((segment) => segment.block.id)).toEqual([ids.meta]);
    });

    test("raw HTML starts are ignored inside ordinary and Tempo fences", () => {
      for (const [open, close] of [
        ["~~~", "~~~"],
        ["```js", "```"],
        ["````", "````"],
      ] as const) {
        const body = `${open}\n<!--\n<pre>\n${close}\n${live}`;
        expect(validSegments(body).map((segment) => segment.block.id), open).toEqual([ids.task]);
        expectExactSpans(body);
      }
      const insideTempo = `\`\`\`json tempo\n<!--\n\`\`\`\n${live}`;
      expect(brokenCodes(insideTempo)).toEqual(["malformed_json"]);
      expect(validSegments(insideTempo).map((segment) => segment.block.id)).toEqual([ids.task]);
      expectExactSpans(insideTempo);
    });

    test("works with CR, LF and CRLF line endings", () => {
      for (const eol of ["\r", "\n", "\r\n"]) {
        const hidden = `<!--${eol}${fence(task, eol)}-->${eol}`;
        const body = `${hidden}${fence(meta, eol)}`;
        expect(validSegments(body).map((segment) => segment.block.id), JSON.stringify(eol)).toEqual([ids.meta]);
        expect(parse(body)[0]).toEqual({ kind: "markdown", source: hidden, start: 0, end: hidden.length });
        expectExactSpans(body);
        expectProse(`<pre>${eol}${fence(task, eol)}</pre>${eol}`);
      }
    });

    test("Unicode separators are ordinary characters inside raw HTML lines", () => {
      for (const separator of unicodeSeparators) {
        const hidden = `<!--${separator}start\n${live}end${separator}-->${separator}\n`;
        const body = `${hidden}${fence(meta)}`;
        expect(validSegments(body).map((segment) => segment.block.id), JSON.stringify(separator)).toEqual([ids.meta]);
        expect(parse(body)[0]).toEqual({ kind: "markdown", source: hidden, start: 0, end: hidden.length });
        expectExactSpans(body);
      }
    });

    test("a real block before, between and after raw HTML blocks stays valid", () => {
      const body = `${fence(meta)}<!--\n${live}-->\n${fence(template)}<pre>\n${live}</pre>\n${live}`;
      expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta, ids.template, ids.task]);
      expect(brokenCodes(body)).toEqual([]);
      expectExactSpans(body);
    });

    test("scans a maximum-size body of unterminated markers without blowing up", () => {
      for (const line of ["<!-- x\n", "<pre \n", "<script\t\n", "<!--\r\n", "    <!--\n", "<?\n", "<!-\n"]) {
        const body = line.repeat(Math.floor((limits.maxBodyChars - live.length) / line.length)) + live;
        expect(body.length).toBeLessThanOrEqual(limits.maxBodyChars);
        const parsed = parse(body);
        expect(serialize(parsed)).toBe(body);
        expect(parsed.every((segment) => segment.kind !== "broken")).toBe(true);
      }
      const spaces = `<pre${" ".repeat(limits.maxBodyChars - 10)}\n${live}`.slice(0, limits.maxBodyChars);
      expect(serialize(parse(spaces))).toBe(spaces);
    });
  });
});
