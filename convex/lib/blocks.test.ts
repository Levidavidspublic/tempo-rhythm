import { describe, expect, test } from "bun:test";
import { BLOCK_CODEC_LIMITS, parseTempoBlocks, serializeTempoBlocks } from "./blocks";

const ids = {
  meta: "blk_01K5F3Z8Q0A7M2N4P6R8T0V2X4",
  task: "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6",
  template: "blk_01K5F3Z8Q4E1N3P5R7T9V1X3Z5",
};

function fence(value: unknown, eol = "\n") {
  return `\`\`\`json tempo${eol}${JSON.stringify(value)}${eol}\`\`\`${eol}`;
}

function validSegments(body: string) {
  return parseTempoBlocks(body).filter((segment) => segment.kind === "valid");
}

function brokenCodes(body: string) {
  return parseTempoBlocks(body)
    .filter((segment) => segment.kind === "broken")
    .map((segment) => segment.errorCode);
}

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

describe("Tempo block codec", () => {
  test("validates all three types, defaults duration, and preserves arbitrary Markdown", () => {
    const body = `# Thursday 🌱\n\nBefore\n${fence(meta)}between\n${fence(task)}${fence(template)}after`;
    const parsed = parseTempoBlocks(body);
    const valid = validSegments(body);
    expect(valid).toHaveLength(3);
    expect(valid[1]?.block.type).toBe("task");
    if (valid[1]?.block.type === "task") expect(valid[1].block.data.durationMin).toBe(15);
    expect(serializeTempoBlocks(parsed)).toBe(body);
    expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
  });

  test("preserves CRLF, Unicode, adjacent fences, and ordinary or nested-looking fences", () => {
    const ordinary = "```json\r\n{not tempo}\r\n```\r\n";
    const nestedLooking = "````markdown\r\n```json tempo\r\nnot parsed by markdown nesting rules\r\n```\r\n````\r\n";
    const body = `${ordinary}${fence(meta, "\r\n")}${fence(task, "\r\n")}${nestedLooking}עברית`;
    expect(serializeTempoBlocks(parseTempoBlocks(body))).toBe(body);
    expect(validSegments(body)).toHaveLength(2);
    expect(parseTempoBlocks(ordinary)).toEqual([
      { kind: "markdown", source: ordinary, start: 0, end: ordinary.length },
    ]);
  });

  test("recognizes only Markdown CR, LF, and CRLF line boundaries", () => {
    for (const eol of ["\r", "\n", "\r\n"]) {
      const body = `prefix${eol}${fence(task, eol)}suffix`;
      const parsed = parseTempoBlocks(body);

      expect(validSegments(body), JSON.stringify(eol)).toHaveLength(1);
      expect(serializeTempoBlocks(parsed)).toBe(body);
      expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
    }

    for (const separator of ["\u2028", "\u2029"]) {
      const body = `prefix${separator}${fence(task)}`;
      const parsed = parseTempoBlocks(body);

      expect(validSegments(body), JSON.stringify(separator)).toHaveLength(0);
      expect(parsed).toEqual([{ kind: "markdown", source: body, start: 0, end: body.length }]);
      expect(serializeTempoBlocks(parsed)).toBe(body);
      expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
    }
  });

  test("applies CommonMark indentation to ordinary fences without consuming Tempo blocks", () => {
    const nestedTempo = fence(meta);
    const indentedContainer = `  \`\`\`\`markdown\n${nestedTempo}   \`\`\`\`\n`;
    const body = `${indentedContainer}${fence(task)}`;
    const parsed = parseTempoBlocks(body);

    expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.task]);
    expect(parsed[0]).toEqual({
      kind: "markdown",
      source: indentedContainer,
      start: 0,
      end: indentedContainer.length,
    });
    expect(serializeTempoBlocks(parsed)).toBe(body);
    expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
  });

  test("uses the exact Tempo closer in both fence passes", () => {
    const body =
      fence(task).replace("\n```\n", "\n ```\n````markdown\n```\n") + fence(meta) + "````\n";
    const parsed = parseTempoBlocks(body);

    expect(brokenCodes(body)).toEqual(["malformed_json"]);
    expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta]);
    expect(serializeTempoBlocks(parsed)).toBe(body);
    expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
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
      expect(serializeTempoBlocks(parseTempoBlocks(body))).toBe(body);
    }
  });

  test("keeps Unicode separators inside ordinary-fence info strings", () => {
    for (const separator of ["\u2028", "\u2029"]) {
      for (const { opener, closer } of [
        { opener: `\`\`\`\`markdown${separator}example`, closer: "````" },
        { opener: `~~~markdown${separator}example`, closer: "~~~" },
      ]) {
        const body = `${opener}\n${fence(task)}${closer}\n${fence(meta)}`;
        const parsed = parseTempoBlocks(body);

        expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta]);
        expect(parsed[0]).toEqual({
          kind: "markdown",
          source: `${opener}\n${fence(task)}${closer}\n`,
          start: 0,
          end: `${opener}\n${fence(task)}${closer}\n`.length,
        });
        expect(serializeTempoBlocks(parsed)).toBe(body);
        expect(parsed.every((segment) => segment.source === body.slice(segment.start, segment.end))).toBe(true);
      }
    }
  });

  test("does not broaden exact Tempo openers or closers with ordinary-fence whitespace", () => {
    const body = ` \`\`\`json tempo\n${JSON.stringify(task)}\n\`\`\`\n${fence(meta)}`;
    expect(validSegments(body).map((segment) => segment.block.id)).toEqual([ids.meta]);
    expect(serializeTempoBlocks(parseTempoBlocks(body))).toBe(body);

    for (const closing of [" ```", "\t```", "```\v"]) {
      const candidate = fence(task).replace("\n```\n", `\n${closing}\n`) + fence(meta);
      expect(serializeTempoBlocks(parseTempoBlocks(candidate))).toBe(candidate);
      expect(validSegments(candidate)).toHaveLength(0);
    }
  });

  test("keeps malformed JSON and unclosed fences as broken source", () => {
    const malformed = "```json tempo\n{ nope }\n```\n";
    const unclosed = "tail\n```json tempo\n{}";
    expect(brokenCodes(malformed)).toEqual(["malformed_json"]);
    expect(brokenCodes(unclosed)).toEqual(["unclosed_fence"]);
    expect(serializeTempoBlocks(parseTempoBlocks(malformed + unclosed))).toBe(malformed + unclosed);
  });

  test("rejects invalid properties, types, versions, duplicate IDs and page-meta blocks", () => {
    expect(brokenCodes(fence({ ...task, data: { ...task.data, done: false } }))).toEqual([
      "invalid_data",
    ]);
    expect(brokenCodes(fence({ ...task, type: "event" }))).toEqual(["unsupported_type"]);
    expect(brokenCodes(fence({ ...task, v: 2 }))).toEqual(["unsupported_version"]);
    expect(brokenCodes(fence(task) + fence(task))).toEqual(["duplicate_id"]);
    expect(brokenCodes(fence(meta) + fence({ ...meta, id: ids.template }))).toEqual([
      "duplicate_page_meta",
    ]);
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
    const body = fence(invalidData) + fence(task);
    expect(serializeTempoBlocks(parseTempoBlocks(body))).toBe(body);
  });

  test("reserves a parsed ID before rejecting excessive nesting", () => {
    let nested: unknown = "leaf";
    for (let index = 0; index <= BLOCK_CODEC_LIMITS.maxJsonDepth; index += 1) nested = [nested];
    const deep = { ...task, data: nested };
    const body = fence(deep) + fence(task);

    expect(brokenCodes(body)).toEqual(["nesting_too_deep", "duplicate_id"]);
    expect(validSegments(body)).toHaveLength(0);
    expect(serializeTempoBlocks(parseTempoBlocks(body))).toBe(body);
  });

  test("accepts only real calendar dates and ULIDs without overflow", () => {
    for (const date of ["2024-02-29", "2026-01-31", "2026-12-31"]) {
      expect(validSegments(fence({ ...meta, data: { ...meta.data, date } }))).toHaveLength(1);
    }
    for (const date of ["2023-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "0000-00-00"]) {
      expect(brokenCodes(fence({ ...meta, data: { ...meta.data, date } }))).toEqual(["invalid_data"]);
    }

    const overflowId = "blk_8" + "0".repeat(25);
    expect(validSegments(fence({ ...task, id: "blk_7" + "Z".repeat(25) }))).toHaveLength(1);
    expect(brokenCodes(fence({ ...task, id: overflowId }))).toEqual(["invalid_data"]);
    const brokenOverflow = parseTempoBlocks(fence({ ...task, id: overflowId, v: 2 }))[0];
    expect(brokenOverflow).toMatchObject({ kind: "broken", errorCode: "unsupported_version" });
    expect(brokenOverflow?.kind === "broken" && brokenOverflow.blockId).toBeUndefined();
  });

  test("does not invent IDs for broken source but retains a syntactically valid source ID", () => {
    const noId = parseTempoBlocks(fence({ type: "task", v: 2, data: {} }))[0];
    const withId = parseTempoBlocks(fence({ ...task, v: 2 }))[0];
    expect(noId?.kind === "broken" && noId.blockId).toBeUndefined();
    expect(withId?.kind === "broken" && withId.blockId).toBe(ids.task);
  });

  test("fails safety bounds without truncating or rewriting source", () => {
    const hugeBody = "x".repeat(BLOCK_CODEC_LIMITS.maxBodyChars + 1);
    const hugeBlock = fence({ ...task, data: { ...task.data, title: "x".repeat(BLOCK_CODEC_LIMITS.maxBlockChars) } });
    let nested: unknown = "leaf";
    for (let index = 0; index <= BLOCK_CODEC_LIMITS.maxJsonDepth; index += 1) nested = [nested];
    const deep = fence({ ...task, data: nested });
    const repeated = Array.from({ length: BLOCK_CODEC_LIMITS.maxBlocks + 1 }, (_, index) =>
      fence({ ...task, id: `blk_${index.toString(32).toUpperCase().padStart(26, "0")}` }),
    ).join("");

    expect(brokenCodes(hugeBody)).toEqual(["body_too_large"]);
    expect(brokenCodes(hugeBlock)).toEqual(["block_too_large"]);
    expect(brokenCodes(deep)).toEqual(["nesting_too_deep"]);
    expect(brokenCodes(repeated).at(-1)).toBe("too_many_blocks");
    for (const body of [hugeBody, hugeBlock, deep, repeated]) {
      expect(serializeTempoBlocks(parseTempoBlocks(body))).toBe(body);
    }
  });

  test("enforces every named string, text, and array limit at its boundary", () => {
    const shortAtLimit = "s".repeat(BLOCK_CODEC_LIMITS.maxShortStringChars);
    const textAtLimit = "t".repeat(BLOCK_CODEC_LIMITS.maxTextChars);
    const arrayAtLimit = Array.from({ length: BLOCK_CODEC_LIMITS.maxArrayItems }, () => shortAtLimit);

    expect(validSegments(fence({ ...meta, data: { ...meta.data, tags: arrayAtLimit } }))).toHaveLength(1);
    expect(validSegments(fence({ ...task, data: { ...task.data, title: textAtLimit, reason: textAtLimit } }))).toHaveLength(1);
    expect(validSegments(fence({ ...template, data: { ...template.data, name: textAtLimit, tokens: arrayAtLimit } }))).toHaveLength(1);

    expect(brokenCodes(fence({ ...meta, data: { ...meta.data, tags: [shortAtLimit + "x"] } }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...task, data: { ...task.data, title: textAtLimit + "x" } }))).toEqual(["invalid_data"]);
    expect(brokenCodes(fence({ ...template, data: { ...template.data, tokens: [...arrayAtLimit, "x"] } }))).toEqual(["invalid_data"]);
  });
});
