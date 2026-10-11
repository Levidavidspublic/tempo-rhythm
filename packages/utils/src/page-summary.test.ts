import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOCK_CODEC_LIMITS, parseTempoBlocks, serializeTempoBlocks } from "./blocks";
import * as utils from "./index";
import { PAGE_TEXT_LIMITS, pageSnippet, projectPageText } from "./page-summary";

/**
 * Every fixture is synthetic. Every projection in this file goes through `project()`, which also
 * asserts the safety contract: no Tempo envelope, fence syntax, block id, bidi override or lone
 * surrogate in `summary` or `searchText`, whatever the test is about.
 *
 * Control characters are written as `\u{...}` escapes on purpose, so no hidden character lives in
 * this source file.
 */

const TICKS = "```";
/** Lone surrogates cannot be written as escapes in every toolchain. */
const HIGH = String.fromCharCode(0xd800);
const LOW = String.fromCharCode(0xdc00);
const ids = {
  meta: "blk_01K5F3Z8Q0A7M2N4P6R8T0V2X4",
  task: "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6",
  template: "blk_01K5F3Z8Q4E1N3P5R7T9V1X3Z5",
};

const meta = {
  type: "page-meta",
  id: ids.meta,
  v: 1,
  data: { pageType: "daily", date: "2026-10-09", tags: ["uni", "שלום", "secret-tag"] },
};
const task = {
  type: "task",
  id: ids.task,
  v: 1,
  data: {
    title: "Email supervisor",
    status: "now",
    order: 1,
    inelastic: false,
    durationMin: 45,
    reason: "hidden-reason",
  },
};
const template = {
  type: "template",
  id: ids.template,
  v: 1,
  data: {
    name: "Gentle day",
    forPageType: "daily",
    isDefault: true,
    tokens: ["hidden-token"],
    origin: "builtin",
    status: "live",
    enabled: true,
  },
};

function fence(value: unknown, eol = "\n") {
  return `${TICKS}json tempo${eol}${JSON.stringify(value)}${eol}${TICKS}${eol}`;
}

function withTitle(title: string, id = ids.task) {
  return { ...task, id, data: { ...task.data, title } };
}

function numberedId(n: number) {
  return `blk_0${String(n).padStart(25, "0")}`;
}

/** Fails if `text` carries anything a reader must never see. */
function expectSafe(text: string) {
  expect(text).not.toMatch(/blk_/i);
  expect(text).not.toMatch(/`{3}|~{3}/);
  expect(text).not.toMatch(/json tempo/i);
  expect(text).not.toMatch(/"(?:id|v|type|data)"\s*:/);
  expect(text).not.toMatch(/[\u{202A}-\u{202E}\u{2066}-\u{2069}]/u);
  expect(text).not.toMatch(/[\u{D800}-\u{DFFF}]/u);
  for (const secret of [
    "inelastic",
    "durationMin",
    "hidden-reason",
    "hidden-token",
    "secret-tag",
  ]) {
    expect(text).not.toContain(secret);
  }
}

function project(body: string, options?: Parameters<typeof projectPageText>[1]) {
  const projection = projectPageText(body, options);
  expectSafe(projection.summary);
  expectSafe(projection.searchText);
  return projection;
}

/** True when the shared codec reads the whole body as markdown, so the fences in it are look-alikes. */
function isAllMarkdown(body: string) {
  return parseTempoBlocks(body).every((segment) => segment.kind === "markdown");
}

describe("valid blocks", () => {
  test("shows prose plus the title of a task and the name of a template, in order", () => {
    const body = `# Thursday 🌱\n\nBefore\n${fence(meta)}between\n${fence(task)}${fence(template)}after`;
    const result = project(body);
    expect(result.searchText).toBe("Thursday 🌱 Before between Email supervisor Gentle day after");
    expect(result.summary).toBe(result.searchText);
    expect(result.truncated).toBe(false);
    expect(result.omittedBlocks).toBe(0);
  });

  test("a page with only blocks still has text, and page-meta alone has none", () => {
    expect(project(fence(task)).searchText).toBe("Email supervisor");
    expect(project(fence(meta)).searchText).toBe("");
    expect(project(fence(meta)).summary).toBe("");
  });

  test("a query for payload content finds nothing, a query for a title finds it", () => {
    const text = project(`Plan\n${fence(task)}`).searchText.toLowerCase();
    expect(text.includes("email supervisor")).toBe(true);
    for (const payload of ["blk_", "task", "inelastic", "durationmin", "json tempo", "45", "now"]) {
      expect(text.includes(payload)).toBe(false);
    }
  });

  test("a title that would put payload or fence syntax on screen is left out", () => {
    const hostile = [
      `${TICKS}json tempo`,
      `~~~ ${ids.task}`,
      `see ${ids.task}`,
      `{"id": "${ids.task}"}`,
      '"type": "task"',
      `blk\u{200B}_${ids.task.slice(4)}`,
    ];
    for (const title of hostile) {
      const body = `Keep\n${fence(withTitle(title))}`;
      expect(isAllMarkdown(body)).toBe(false);
      expect(project(body).searchText).toBe("Keep");
    }
  });

  test("a title is one clean line", () => {
    const title = "Line one\nLine two\t\u{202E}reversed\u{202C}  end\u{0}";
    expect(project(fence(withTitle(title))).searchText).toBe("Line one Line two reversed end");
  });
});

describe("malformed, unknown and oversized blocks", () => {
  const brokenBodies: Record<string, string> = {
    unclosedFence: `Intro\n${TICKS}json tempo\n${JSON.stringify(task)}`,
    unclosedFenceCrlf: `Intro\r\n${TICKS}json tempo\r\n${JSON.stringify(task)}\r\n`,
    unclosedAfterValid: `${fence(task)}Mid\n${TICKS}json tempo\n{"id": "${ids.meta}"`,
    malformedJson: `Intro\n${TICKS}json tempo\n{"id": "${ids.task}", "v": 1, oops}\n${TICKS}\n`,
    emptyFence: `Intro\n${TICKS}json tempo\n${TICKS}\n`,
    arrayEnvelope: `Intro\n${fence([task])}`,
    unsupportedType: `Intro\n${fence({ ...task, type: "event" })}`,
    unsupportedVersion: `Intro\n${fence({ ...task, v: 2 })}`,
    invalidData: `Intro\n${fence({ ...task, data: { ...task.data, status: "someday" } })}`,
    extraProperty: `Intro\n${fence({ ...task, data: { ...task.data, done: true } })}`,
    duplicateId: `Intro\n${fence(task)}${fence(withTitle("Second copy"))}`,
    duplicatePageMeta: `Intro\n${fence(meta)}${fence({ ...meta, id: ids.template })}`,
    nestedTooDeep: `Intro\n${fence({ ...task, data: { ...task.data, deep: nested(20) } })}`,
    blockTooLarge: `Intro\n${fence(withTitle("x".repeat(BLOCK_CODEC_LIMITS.maxBlockChars)))}`,
  };

  function nested(depth: number): unknown {
    let value: unknown = "leaf";
    for (let level = 0; level < depth; level += 1) value = [value];
    return value;
  }

  for (const [name, body] of Object.entries(brokenBodies)) {
    test(`${name}: only the surrounding prose is shown`, () => {
      const result = project(body);
      const expectedBlocks = parseTempoBlocks(body).filter((s) => s.kind === "broken").length;
      expect(expectedBlocks).toBeGreaterThan(0);
      expect(result.omittedBlocks).toBe(expectedBlocks);
      expect(result.searchText.startsWith("Intro") || result.searchText.startsWith("Email")).toBe(
        true
      );
      expect(result.searchText).not.toContain("Second copy");
    });
  }

  test("a broken block does not hide valid blocks around it", () => {
    const body = `${fence(withTitle("First"))}${TICKS}json tempo\n{ nope }\n${TICKS}\n${fence(withTitle("Last", ids.meta))}`;
    const result = project(body);
    expect(result.searchText).toBe("First Last");
    expect(result.omittedBlocks).toBe(1);
  });

  test("a body over the codec limit yields nothing instead of a slice of the raw body", () => {
    const body = `Visible prose ${"x".repeat(BLOCK_CODEC_LIMITS.maxBodyChars)}\n${fence(task)}`;
    const result = project(body);
    expect(result).toEqual({ summary: "", searchText: "", truncated: false, omittedBlocks: 1 });
  });

  test("blocks past the codec block limit are left out", () => {
    const count = BLOCK_CODEC_LIMITS.maxBlocks + 1;
    const body = Array.from({ length: count }, (_, index) =>
      fence(withTitle(`T${index + 1}x`, numberedId(index + 1)))
    ).join("");
    const result = project(body);
    expect(result.searchText).toContain("T256x");
    expect(result.searchText).not.toContain("T257x");
    expect(result.omittedBlocks).toBe(1);
  });
});

describe("fenced and raw-HTML look-alikes", () => {
  const payload = fence(task);
  const pretty = JSON.stringify(task, null, 2);

  const htmlLookalikes: Record<string, string> = {
    pre: `<pre>\n${payload}</pre>\nAfter`,
    indentedPre: `   <pre>\n${payload}</pre>\nAfter`,
    comment: `<!--\n${payload}-->\nAfter`,
    script: `<script>\n${payload}</script>\nAfter`,
    style: `<style>\n${payload}</style>\nAfter`,
    textarea: `<textarea>\n${payload}</textarea>\nAfter`,
    cdata: `<![CDATA[\n${payload}]]>\nAfter`,
    processingInstruction: `<?php\n${payload}?>\nAfter`,
    declaration: `<!DOCTYPE x\n${payload}>\nAfter`,
    rawJsonInPre: `<pre>\n${JSON.stringify(task)}\n</pre>\nAfter`,
    prettyJsonInPre: `<pre>\n${pretty}\n</pre>\nAfter`,
    unclosedPre: `Before\n<pre>\n${payload}`,
  };

  for (const [name, body] of Object.entries(htmlLookalikes)) {
    test(`${name}: payload inside literal HTML is not shown`, () => {
      expect(isAllMarkdown(body)).toBe(true);
      const result = project(body);
      expect(result.searchText).not.toContain("Email supervisor");
      expect(result.searchText).not.toContain("<");
      expect(result.omittedBlocks).toBe(0);
      if (body.includes("After")) expect(result.searchText).toBe("After");
      else expect(result.searchText).toBe("Before");
    });
  }

  test("a one-line HTML comment does not hide the real block after it", () => {
    const body = `<!-- note -->\n${payload}After`;
    expect(project(body).searchText).toBe("Email supervisor After");
  });

  const fenceLookalikes: Record<string, string> = {
    tildeFence: `~~~json tempo\n${JSON.stringify(task)}\n~~~\nAfter`,
    spacedInfo: `${TICKS} json tempo\n${JSON.stringify(task)}\n${TICKS}\nAfter`,
    uppercaseInfo: `${TICKS}JSON TEMPO\n${JSON.stringify(task)}\n${TICKS}\nAfter`,
    indentedOneSpace: ` ${TICKS}json tempo\n${JSON.stringify(task)}\n ${TICKS}\nAfter`,
    indentedCode: `    ${TICKS}json tempo\n    ${JSON.stringify(task)}\n    ${TICKS}\nAfter`,
    prettyIndentedCode: `    ${TICKS}json tempo\n${pretty
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")}\n    ${TICKS}\nAfter`,
    tabIndented: `\t${TICKS}json tempo\n\t${JSON.stringify(task)}\n\t${TICKS}\nAfter`,
    inBlockquote: `> ${TICKS}json tempo\n> ${JSON.stringify(task)}\n> ${TICKS}\n\nAfter`,
    outerFourTicks: `${TICKS}\`markdown\n${payload}${TICKS}\`\nAfter`,
    longerCloserNeeded: `${TICKS}\`js\n${payload}${TICKS}\nstill inside\n${TICKS}\`\nAfter`,
    bareJson: `${JSON.stringify(task)}\nAfter`,
    prettyJson: `${pretty}\nAfter`,
    bulletedJson: `- ${JSON.stringify(task)}\nAfter`,
    inlineEnvelope: `The block was ${JSON.stringify(task)} when saved.\nAfter`,
    inlineEnvelopeWithoutId: `Saved as {"type":"task","v":1,"data":{"title":"Email supervisor"}} ok.\nAfter`,
    prosePlusId: `Copied from ${ids.task} yesterday.\nAfter`,
    linkToId: `Open [the task](tempo://block/${ids.task}) now.\nAfter`,
    imageToId: `![diagram](https://example.invalid/${ids.task}.png)\nAfter`,
    htmlWithId: `<span data-id="${ids.task}">Hello</span>\nAfter`,
    commentWithId: `Hello <!-- ${ids.task} --> there\nAfter`,
    invisibleInId: `Copied from blk\u{200B}_${ids.task.slice(4)} and b\u{200F}lk_${ids.task.slice(4)}\nAfter`,
    invisibleInFence: `${TICKS}\u{200B}json\u{200D} tempo\n${JSON.stringify(task)}\n${TICKS}\nAfter`,
    bidiOverrideFence: `\u{202E}${TICKS}json tempo\n${JSON.stringify(task)}\n${TICKS}\nAfter`,
    inlineFence: `Use ${TICKS}json tempo${TICKS} for blocks.\nAfter`,
  };

  for (const [name, body] of Object.entries(fenceLookalikes)) {
    test(`${name}: nothing Tempo-shaped is shown and prose is kept`, () => {
      const result = project(body);
      expect(result.searchText).not.toContain("Email supervisor");
      expect(result.omittedBlocks).toBe(0);
      expect(result.searchText.endsWith("After")).toBe(true);
    });
  }

  test("these fence look-alikes are all plain markdown to the shared codec", () => {
    for (const name of ["tildeFence", "spacedInfo", "uppercaseInfo", "indentedOneSpace"]) {
      expect(isAllMarkdown(fenceLookalikes[name]!)).toBe(true);
    }
    for (const name of ["indentedCode", "tabIndented", "inBlockquote", "outerFourTicks"]) {
      expect(isAllMarkdown(fenceLookalikes[name]!)).toBe(true);
    }
  });

  test("a list-item fence the codec cannot see is closed by its own indented closer", () => {
    // The codec reads the indented closer as the opener of an ordinary fence that swallows "After".
    // The projection follows CommonMark: the item's fence ends there, and "After" is a paragraph.
    const body = `Before\n- ${TICKS}json tempo\n  ${JSON.stringify(task)}\n  ${TICKS}\nAfter`;
    expect(isAllMarkdown(body)).toBe(true);
    expect(project(body).searchText).toBe("Before After");
  });

  test("ordinary fenced code is not part of the projection", () => {
    const body = `Before\n${TICKS}js\nconsole.log("secret code");\n${TICKS}\nAfter\n~~~\nmore code\n~~~\nEnd`;
    expect(project(body).searchText).toBe("Before After End");
    expect(project(`Before\n${TICKS}js\nunclosed code\nAfter`).searchText).toBe("Before");
  });
});

describe("fenced code inside quotes and list items", () => {
  const secret = "secret code line";
  const cases: Record<string, { body: string; text: string }> = {
    quote: { body: `> ${TICKS}js\n> ${secret}\n> ${TICKS}\nAfter`, text: "After" },
    quoteNoSpace: { body: `>${TICKS}js\n>${secret}\n>${TICKS}\nAfter`, text: "After" },
    quoteTilde: { body: `> ~~~\n> ${secret}\n> ~~~\n\nAfter`, text: "After" },
    quoteTempoFence: {
      body: `> ${TICKS}json tempo\n> ${JSON.stringify(task)}\n> ${TICKS}\nAfter`,
      text: "After",
    },
    nestedQuotes: { body: `> > ${TICKS}js\n> > ${secret}\n> > ${TICKS}\nAfter`, text: "After" },
    dash: { body: `- ${TICKS}js\n  ${secret}\n  ${TICKS}\nAfter`, text: "After" },
    star: { body: `* ${TICKS}js\n  ${secret}\n  ${TICKS}\nAfter`, text: "After" },
    plus: { body: `+ ${TICKS}js\n  ${secret}\n  ${TICKS}\nAfter`, text: "After" },
    ordered: { body: `1. ${TICKS}js\n   ${secret}\n   ${TICKS}\nAfter`, text: "After" },
    orderedParen: { body: `2) ${TICKS}js\n   ${secret}\n   ${TICKS}\nAfter`, text: "After" },
    wideMarker: { body: `10.  ${TICKS}js\n     ${secret}\n     ${TICKS}\nAfter`, text: "After" },
    tabIndented: { body: `- ${TICKS}js\n\t${secret}\n\t${TICKS}\nAfter`, text: "After" },
    blankLinesInside: {
      body: `- ${TICKS}js\n\n  ${secret}\n\n  ${TICKS}\nAfter`,
      text: "After",
    },
    quoteInList: { body: `- > ${TICKS}js\n  > ${secret}\n  > ${TICKS}\nAfter`, text: "After" },
    listInQuote: { body: `> - ${TICKS}js\n>   ${secret}\n>   ${TICKS}\nAfter`, text: "After" },
    nestedList: {
      body: `- outer\n  - ${TICKS}js\n    ${secret}\n    ${TICKS}\nAfter`,
      text: "outer After",
    },
    longerOpener: {
      body: `> ${TICKS}\`js\n> ${TICKS}\n> ${secret}\n> ${TICKS}\`\nAfter`,
      text: "After",
    },
    openedOnItsOwnLine: {
      body: `10. item\n\n    ${TICKS}js\n    ${secret}\n    ${TICKS}\n\nAfter`,
      text: "item After",
    },
    thematicBreakIsNotAnItem: {
      body: `- - -\n${TICKS}js\n${secret}\n${TICKS}\nAfter`,
      text: "After",
    },
  };

  for (const [name, { body, text }] of Object.entries(cases)) {
    test(`${name}: the fenced code is not shown, the prose around it is`, () => {
      const result = project(body);
      expect(result.searchText).not.toContain("secret");
      expect(result.searchText).not.toContain("Email supervisor");
      expect(result.searchText).toBe(text);
      expect(result.omittedBlocks).toBe(0);
    });
  }

  test("a fence ends with the quote or list item it is in, closed or not", () => {
    expect(project(`> ${TICKS}js\n> ${secret}\n\nAfter`).searchText).toBe("After");
    expect(project(`> ${TICKS}js\n> ${secret}\nAfter`).searchText).toBe("After");
    expect(project(`- ${TICKS}js\n  ${secret}\nAfter`).searchText).toBe("After");
    expect(project(`- ${TICKS}js\n  ${secret}\n- Next`).searchText).toBe("Next");
    // The quote is over on line 3, so line 3 opens an ordinary fence of its own.
    const body = `> ${TICKS}js\n> ${secret}\n${TICKS}js\nlater ${secret}\n${TICKS}\nAfter`;
    expect(project(body).searchText).toBe("After");
  });

  test("quoted text and list items outside fences are still shown", () => {
    expect(project("> quoted\n- item\n1. one\n   more").searchText).toBe("quoted item one more");
  });

  test("a closer in another container does not close the fence", () => {
    const body = `> ${TICKS}js\n> ${secret}\n> - ${TICKS}\n> ${secret} again\n> ${TICKS}\nAfter`;
    expect(project(body).searchText).toBe("After");
  });

  test("a real Tempo block after a container fence is still read", () => {
    const body = `> ${TICKS}js\n> ${secret}\n> ${TICKS}\n\n${fence(task)}After`;
    expect(project(body).searchText).toBe("Email supervisor After");
  });
});

describe("Tempo-looking fences inside HTML blocks that end at a blank line", () => {
  const payload = fence(task);
  const second = fence(withTitle("Second block", numberedId(2)));

  /** The codec accepts these as valid blocks (it does not model CommonMark HTML blocks 6 and 7). */
  const gated: Record<string, string> = {
    blockTag: `<div>\n${payload}After`,
    blockTagWithAttributes: `<div class="note">\n${payload}After`,
    blockTagUpperCase: `<DIV>\n${payload}After`,
    blockTagSelfClosed: `<hr/>\n${payload}After`,
    blockTagWithContent: `<div>text</div>\n${payload}After`,
    closingTag: `</div>\n${payload}After`,
    table: `<table>\n<tr>\n${payload}After`,
    headingTag: `<h2>\n${payload}After`,
    indentedStart: `   <section>\n${payload}After`,
    interruptsParagraph: `Before\n<section>\n${payload}After`,
    completeTag: `<span>\n${payload}After`,
    customElement: `<my-widget data-x="1">\n${payload}After`,
    selfClosingTag: `<br/>\n${payload}After`,
    closingCustomTag: `</my-widget>\n${payload}After`,
    afterBlankLine: `Before\n\n<span>\n${payload}After`,
  };

  for (const [name, body] of Object.entries(gated)) {
    test(`${name}: the codec trusts it, the projection does not`, () => {
      expect(parseTempoBlocks(body).some((segment) => segment.kind === "valid")).toBe(true);
      const result = project(body);
      expect(result.searchText).not.toContain("Email supervisor");
      expect(result.searchText.endsWith("After")).toBe(true);
      expect(result.omittedBlocks).toBe(0);
    });
  }

  test("every block in the same HTML block is left out, and the blank line that ends it is honoured", () => {
    expect(project(`<div>\n${payload}${second}After`).searchText).toBe("After");
    expect(project(`<div>\n${payload}\n${second}After`).searchText).toBe("Second block After");
    expect(project(`<div>\n${payload}\n\n${second}After`).searchText).toBe("Second block After");
  });

  test("broken and unclosed fences inside the HTML block are not counted as blocks", () => {
    const broken = `<div>\n${TICKS}json tempo\n{ nope\n${TICKS}\nAfter`;
    expect(parseTempoBlocks(broken).some((segment) => segment.kind === "broken")).toBe(true);
    expect(project(broken).omittedBlocks).toBe(0);
    expect(project(broken).searchText).toBe("After");
    const unclosed = `<div>\n${TICKS}json tempo\n${JSON.stringify(task)}`;
    expect(parseTempoBlocks(unclosed).some((segment) => segment.kind === "broken")).toBe(true);
    expect(project(unclosed).omittedBlocks).toBe(0);
    expect(project(unclosed).searchText).toBe("");
  });

  test("a broken block outside any HTML block is still counted", () => {
    expect(project(`<div>\n\n${TICKS}json tempo\n{ nope\n${TICKS}\nAfter`).omittedBlocks).toBe(1);
    expect(project(`Text\n<span>\n${TICKS}json tempo\n{ nope\n${TICKS}\nAfter`).omittedBlocks).toBe(1);
  });

  const trusted: Record<string, { body: string; text: string }> = {
    blankLine: { body: `<div>\n\n${payload}After`, text: "Email supervisor After" },
    blankLineWithSpaces: { body: `<div>\n   \n${payload}After`, text: "Email supervisor After" },
    inlineTagAfterParagraph: {
      body: `Text\n<span>\n${payload}After`,
      text: "Text Email supervisor After",
    },
    tagBeforeText: { body: `<span>text\n${payload}After`, text: "text Email supervisor After" },
    notATag: { body: `<3 hearts\n${payload}After`, text: "<3 hearts Email supervisor After" },
    unknownNameWithText: {
      body: `<divider>\n\n${payload}After`,
      text: "Email supervisor After",
    },
    comparison: { body: `a < b\n${payload}After`, text: "a < b Email supervisor After" },
    inQuote: { body: `> <div>\n${payload}After`, text: "Email supervisor After" },
    inListItem: { body: `- item\n  <div>\n${payload}After`, text: "item Email supervisor After" },
    inCodeFence: {
      body: `${TICKS}html\n<div>\n${TICKS}\n${payload}After`,
      text: "Email supervisor After",
    },
    inTildeFence: { body: `~~~\n<div>\n~~~\n${payload}After`, text: "Email supervisor After" },
    afterTrustedBlock: {
      body: `${payload}Text\n<span>\n${second}After`,
      text: "Email supervisor Text Second block After",
    },
  };

  for (const [name, { body, text }] of Object.entries(trusted)) {
    test(`${name}: not an HTML block, so the block is shown`, () => {
      expect(project(body).searchText).toBe(text);
    });
  }

  test("a tag alone on the line right after a block starts an HTML block of its own", () => {
    const body = `${payload}<span>\n${second}After`;
    expect(project(body).searchText).toBe("Email supervisor After");
  });

  test("a gated block does not hide prose, only the block", () => {
    const result = project(`Intro\n\n<div>\n${payload}\nOutro`);
    expect(result.searchText).toBe("Intro Outro");
  });

  test("gating keeps following HTML blocks past the text limit", () => {
    const filler = "word ".repeat(40);
    const body = `${filler}\n\n<div>\n${payload}${TICKS}json tempo\n{ nope\n${TICKS}\n`;
    const result = project(body, { searchChars: 50 });
    expect(result.truncated).toBe(true);
    expect(result.omittedBlocks).toBe(0);
    const open = `${filler}\n\n${TICKS}json tempo\n{ nope\n${TICKS}\n`;
    expect(project(open, { searchChars: 50 }).omittedBlocks).toBe(1);
  });
});

describe("prose", () => {
  test("markdown becomes plain text and ordinary prose survives", () => {
    const body = [
      "# Weekly review ##",
      "> quoted _thought_",
      "1. **Bold** step with `code` and ~~gone~~",
      "- [ ] Call the bank",
      "- [x] Pay rent",
      "See [the docs](https://example.invalid/a_b) and ![alt text](https://example.invalid/i.png).",
      "[[Weekly review]] notes",
      '"Rest is productive," she said',
      "snake_case_name and 2*3*4 stay",
      "Hello <b>world</b><br/> <!-- hidden --> there",
      "---",
      "| a | b |",
      "| --- | :-: |",
      "[1]: https://example.invalid/ref",
      "Last line",
    ].join("\n");
    expect(project(body).searchText).toBe(
      [
        "Weekly review",
        "quoted thought",
        "Bold step with code and gone",
        "Call the bank",
        "Pay rent",
        "See the docs and alt text.",
        "[[Weekly review]] notes",
        '"Rest is productive," she said',
        "snake_case_name and 2*3*4 stay",
        "Hello world there",
        "| a | b |",
        "Last line",
      ].join(" ")
    );
  });

  test("lines that look like raw JSON are dropped", () => {
    const body = '{"task":"hidden"}\n- ["x", "y"]\n"key": 1,\n[1, 2]\n[]\n}\nText';
    expect(project(body).searchText).toBe("Text");
  });

  test("empty and whitespace-only bodies give empty text", () => {
    for (const body of ["", "   \n\t\r\n  ", "---\n***"]) {
      expect(project(body)).toEqual({
        summary: "",
        searchText: "",
        truncated: false,
        omittedBlocks: 0,
      });
    }
  });

  test("line endings are all handled", () => {
    expect(project("a\r\nb\rc\nd\u{2028}e").searchText).toBe("a b c d e");
  });
});

describe("limits", () => {
  test("long content is cut at the search limit and says so", () => {
    const body = `${"word ".repeat(10_000)}\n${fence(task)}`;
    const result = project(body);
    expect(result.truncated).toBe(true);
    expect(result.searchText.length).toBeLessThanOrEqual(PAGE_TEXT_LIMITS.searchChars);
    expect(result.searchText.length).toBeGreaterThan(PAGE_TEXT_LIMITS.searchChars - 10);
    expect(result.searchText).not.toContain("Email supervisor");
  });

  test("text that exactly fills the limit is not reported as cut", () => {
    const result = project("a".repeat(50), { searchChars: 50 });
    expect(result.searchText).toBe("a".repeat(50));
    expect(result.truncated).toBe(false);
    expect(project("a".repeat(51), { searchChars: 50 }).truncated).toBe(true);
  });

  test("summary is the start of the search text with an ellipsis when cut", () => {
    const result = project("The quick brown fox jumps over the lazy dog", { summaryChars: 20 });
    expect(result.summary).toBe("The quick brown fox\u{2026}");
    expect(result.summary.length).toBeLessThanOrEqual(20);
    expect(result.searchText).toBe("The quick brown fox jumps over the lazy dog");
    expect(project("short").summary).toBe("short");
    expect(project("x".repeat(500)).summary.length).toBe(PAGE_TEXT_LIMITS.summaryChars);
  });

  test("a cut search text forces an ellipsis on the summary", () => {
    const result = project("abcdefghij klmnop", { searchChars: 10, summaryChars: 100 });
    expect(result.searchText).toBe("abcdefghij");
    expect(result.summary).toBe("abcdefghij\u{2026}");
  });

  test("caller limits are clamped", () => {
    expect(project("abcdef", { summaryChars: 0 }).summary).toBe("\u{2026}");
    expect(project("abcdef", { searchChars: -5 }).searchText).toBe("a");
    expect(project("abc", { summaryChars: Number.NaN }).summary).toBe("abc");
    expect(project("abc", { searchChars: Number.POSITIVE_INFINITY }).searchText).toBe("abc");
    const big = "y".repeat(PAGE_TEXT_LIMITS.maxChars + 5000);
    expect(project(big, { searchChars: 10 ** 9 }).searchText.length).toBe(
      PAGE_TEXT_LIMITS.maxChars
    );
  });

  test("pathological bodies stay linear", () => {
    const size = 1_000_000;
    const bodies = [
      "x ".concat("<!--".repeat(size / 4)),
      "[".repeat(size),
      "<a ".repeat(size / 3),
      "-".repeat(size).concat("x"),
      "a".concat(" ".repeat(size), "b #"),
      "*_".repeat(size / 2),
      '"'.concat("\\".repeat(size / 2)),
      `[${" ".repeat(size)}x`,
      "`".repeat(size),
      "> ".repeat(size / 2),
      "- ".repeat(size / 2),
      ">".repeat(size),
      "1. ".repeat(size / 3),
      "> - ".repeat(size / 4).concat("```js"),
      `- ${TICKS}js\n`.repeat(size / 8),
      `> ${TICKS}\n  x\n`.repeat(size / 12),
      "<div>\n".repeat(size / 6),
      "<a ".repeat(size / 3).concat(">"),
      `<span>\n${TICKS}json tempo\n{}\n${TICKS}\n`.repeat(size / 40),
      "\t".repeat(size),
      `- ${"\t".repeat(size / 2)}x`,
    ];
    for (const body of bodies) {
      const started = performance.now();
      const result = projectPageText(body);
      expectSafe(result.searchText);
      expect(performance.now() - started).toBeLessThan(3000);
    }
  });
});

describe("Hebrew and bidirectional text", () => {
  test("Hebrew prose, Hebrew titles and combining points come through unchanged", () => {
    const heading = "תכנון היום";
    const pointed = "שָׁלוֹם עוֹלָם";
    const title = "שליחת מייל למנחה";
    const body = `# ${heading}\n\n- ${pointed}\n${fence(withTitle(title))}סוף`;
    expect(project(body).searchText).toBe(`${heading} ${pointed} ${title} סוף`);
  });

  test("mixed Hebrew, Latin, digits and punctuation keep their logical order", () => {
    const line = "פגישה עם Dana ב-10:30 (zoom) — 2026-10-11, חדר 4B";
    expect(project(line).searchText).toBe(line);
  });

  test("direction marks and joiners are kept; they are text, not controls", () => {
    const line =
      "שלום\u{200F} (hello)\u{200E} 12 \u{200E}صباح\u{061C}\u{200C}x 👨\u{200D}👩\u{200D}👧";
    expect(project(line).searchText).toBe(line);
  });

  test("a direction mark before a list marker does not hide the marker", () => {
    expect(project("\u{200F}- פריט ראשון\n\u{200F}1. פריט שני").searchText).toBe(
      "פריט ראשון פריט שני"
    );
  });

  test("embeddings, overrides and isolates are removed, not just ignored", () => {
    const body =
      "abc \u{202E}gnp.exe\u{202C} \u{2067}שלום\u{2069} \u{202A}x\u{202B}\u{202D}y\u{2066}z\u{2068}";
    expect(project(body).searchText).toBe("abc gnp.exe שלום xyz");
  });

  test("lone surrogates and invisible separators are removed", () => {
    expect(project(`a${HIGH}b${LOW}c d\u{200B}e\u{FEFF}f\u{AD}g`).searchText).toBe("abc defg");
  });

  test("Hebrew around look-alike fences is kept and the payload is not", () => {
    const body = `לפני\n<pre>\n${fence(withTitle("משימה סודית"))}</pre>\nאחרי\n~~~json tempo\n${JSON.stringify(withTitle("עוד סוד"))}\n~~~\nסוף`;
    expect(project(body).searchText).toBe("לפני אחרי סוף");
  });

  test("a cut never splits a surrogate pair, a combining point or an emoji sequence", () => {
    const text = "שָׁלוֹם 👍🏽 a\u{301}b 👨\u{200D}👩\u{200D}👧 🇮🇱 עוֹלָם 🌱 end";
    for (let max = 1; max <= text.length + 2; max += 1) {
      expect(project(text, { summaryChars: max }).summary.length).toBeLessThanOrEqual(max);
      for (const result of [
        project(text, { summaryChars: max }),
        project(text, { searchChars: max }),
      ]) {
        const cut = result.summary.endsWith("\u{2026}")
          ? result.summary.slice(0, -1)
          : result.summary;
        const kept = result.searchText.startsWith(cut) ? cut : result.searchText;
        const next = result.searchText.slice(kept.length);
        expect(result.searchText.startsWith(kept)).toBe(true);
        // Whatever follows the cut must start a new character cluster.
        expect(next).not.toMatch(
          /^(?:[\p{M}\p{Emoji_Modifier}\u{DC00}-\u{DFFF}]|\u{200C}|\u{200D})/u
        );
        expect(kept).not.toMatch(/\u{200D}$/u);
        expect(kept).not.toMatch(/[\u{D800}-\u{DBFF}]$/u);
      }
    }
  });
});

describe("pageSnippet", () => {
  const filler = "lorem ipsum dolor sit amet ".repeat(20);
  const text = `${filler}Needle in the middle ${filler}`;

  test("short text is returned whole", () => {
    expect(pageSnippet({ searchText: "tiny" }, "x")).toBe("tiny");
  });

  test("windows around the first match, case-insensitively, within the limit", () => {
    const snippet = pageSnippet({ searchText: text }, "  NEEDLE ");
    expect(snippet.toLowerCase()).toContain("needle");
    expect(snippet.length).toBeLessThanOrEqual(PAGE_TEXT_LIMITS.snippetChars);
    expect(snippet.startsWith("\u{2026}")).toBe(true);
    expect(snippet.endsWith("\u{2026}")).toBe(true);
  });

  test("starts at the beginning when there is no match or no query", () => {
    for (const query of ["absent", "", "   "]) {
      const snippet = pageSnippet({ searchText: text }, query, 40);
      expect(snippet).toBe(`${text.slice(0, 39).trim()}\u{2026}`);
    }
  });

  test("works on a projection, so a payload query never matches payload", () => {
    const projection = project(`${filler}\n${fence(task)}`);
    const snippet = pageSnippet(projection, "inelastic");
    expectSafe(snippet);
    expect(snippet.startsWith("lorem")).toBe(true);
  });

  test("a snippet never exceeds its limit, whatever the limit and the match", () => {
    const hebrew = "בוקר טוב שָׁלוֹם 👍🏽 ".repeat(30);
    const texts = [
      `${filler}Needle in the middle ${filler}`,
      `${filler}${filler}Needle`,
      `Needle ${filler}`,
      `${hebrew}מילת מפתח ${hebrew}`,
      "x".repeat(200),
    ];
    for (const searchText of texts) {
      for (const query of ["needle", "מילת", "absent", ""]) {
        for (let max = 0; max <= 60; max += 1) {
          const snippet = pageSnippet({ searchText }, query, max);
          expect(snippet.length).toBeLessThanOrEqual(max);
          expect(snippet).not.toMatch(/^\u{2026}?[\p{M}\u{DC00}-\u{DFFF}]/u);
          expect(snippet).not.toMatch(/[\u{D800}-\u{DBFF}]\u{2026}?$/u);
        }
      }
    }
  });

  test("a limit of 0 gives an empty snippet and a limit of 1 gives at most the ellipsis", () => {
    expect(pageSnippet({ searchText: text }, "needle", 0)).toBe("");
    expect(pageSnippet({ searchText: text }, "absent", 0)).toBe("");
    expect(pageSnippet({ searchText: "" }, "needle", 0)).toBe("");
    expect(pageSnippet({ searchText: "tiny" }, "x", 0)).toBe("");
    expect(pageSnippet({ searchText: "a" }, "a", 1)).toBe("a");
    expect(pageSnippet({ searchText: text }, "needle", 1)).toBe("\u{2026}");
    expect(pageSnippet({ searchText: text }, "absent", 1)).toBe("\u{2026}");
    expect(pageSnippet({ searchText: text }, "needle", -4)).toBe("");
  });

  test("a window too small for two ellipses and text starts at the beginning instead", () => {
    expect(pageSnippet({ searchText: text }, "needle", 2)).toBe("l\u{2026}");
    const three = pageSnippet({ searchText: text }, "needle", 3);
    expect(three.length).toBeLessThanOrEqual(3);
    expect(three).not.toBe("\u{2026}\u{2026}");
  });

  test("the default limit applies when none is given", () => {
    const long = "word ".repeat(100);
    expect(pageSnippet({ searchText: long }, "").length).toBeLessThanOrEqual(
      PAGE_TEXT_LIMITS.snippetChars
    );
    expect(pageSnippet({ searchText: long }, "", Number.NaN).length).toBeGreaterThan(40);
  });

  test("Hebrew snippets keep clusters whole and still contain the match", () => {
    const hebrew = "בוקר טוב שָׁלוֹם 👍🏽 ".repeat(30);
    const searchText = `${hebrew}מילת מפתח ${hebrew}`;
    for (let max = 5; max <= 60; max += 1) {
      const snippet = pageSnippet({ searchText }, "מילת מפתח", max);
      expect(snippet.length).toBeLessThanOrEqual(max);
      expect(snippet).not.toMatch(/^\u{2026}?[\p{M}\u{DC00}-\u{DFFF}]/u);
      expect(snippet).not.toMatch(/[\u{D800}-\u{DBFF}]\u{2026}?$/u);
      if (max >= 30) expect(snippet).toContain("מילת");
    }
  });
});

describe("source is untouched", () => {
  test("the body is never rewritten and the codec still round-trips it", () => {
    const body = `# Hebrew שלום\n${fence(task)}<pre>\n${fence(meta)}</pre>\n${TICKS}json tempo\n{ nope`;
    const copy = `${body}`;
    const first = projectPageText(body);
    const second = projectPageText(body);
    expect(body).toBe(copy);
    expect(second).toEqual(first);
    expect(serializeTempoBlocks(parseTempoBlocks(body))).toBe(body);
  });

  test("no input makes it throw", () => {
    for (const body of ["", "\u{0}", HIGH, "```", "~~~", "<", "[", '"', "{", "blk_", fence({})]) {
      expect(() => projectPageText(body)).not.toThrow();
    }
  });
});

describe("module shape", () => {
  test("the public index exports the projection", () => {
    expect(utils.projectPageText).toBe(projectPageText);
    expect(utils.pageSnippet).toBe(pageSnippet);
    expect(utils.PAGE_TEXT_LIMITS).toBe(PAGE_TEXT_LIMITS);
  });

  test("it reads blocks through the shared codec and has no parser of its own", () => {
    const source = readFileSync(join(import.meta.dir, "page-summary.ts"), "utf8");
    expect(source).toContain('from "./blocks"');
    expect(source).toContain("parseTempoBlocks(");
    expect(source).not.toContain("JSON.parse");
    expect(source).not.toContain("safeParse");
    expect(source).not.toContain("tempoBlockSchema");
  });
});
