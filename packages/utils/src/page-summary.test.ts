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
/**
 * Time a stress test may take in all, building its body included: well above the 3 s each
 * projection must stay under, so a slower runner does not time out before the real check runs.
 */
const PATHOLOGICAL_TIMEOUT_MS = 30_000;
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

  test("HTML in a title or template name is removed as it is in prose", () => {
    const titles: Record<string, string> = {
      "<script>alert(1)</script>": "alert(1)",
      "Call <b>mum</b><br/>": "Call mum",
      "Call <!-- hidden --> mum": "Call mum",
      "Call <!--\nhidden\n--> mum": "Call mum",
      "Call <!-- hidden": "Call",
      'Call <span class="hidden"': "Call",
      "Call <?php hidden ?> mum": "Call mum",
      // A removed hidden character could fake the end marker, so the comment is not trusted to end.
      "Call <!-- hidden -\u{200B}-> mum": "Call",
      // A quoted attribute value may hold ">": the tag ends only after the value.
      'Call <a title="x > hidden">mum</a>': "Call mum",
      "Call <a title='x > hidden'>mum</a>": "Call mum",
      'Call <a title="x\n> hidden">mum': "Call mum",
      'Call <a title="x > hidden': "Call",
      'Call <a title="a < b">hidden</a> hidden': "Call",
    };
    for (const [title, text] of Object.entries(titles)) {
      const result = project(fence(withTitle(title)));
      expect(result.searchText).toBe(text);
      expect(result.summary).toBe(text);
    }
    const named = { ...template, data: { ...template.data, name: "<i>Gentle</i> <!-- x -->day" } };
    expect(project(fence(named)).searchText).toBe("Gentle day");
    const quoted = {
      ...template,
      data: { ...template.data, name: '<i title="a > hidden">Gentle</i> day' },
    };
    expect(project(fence(quoted)).searchText).toBe("Gentle day");
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

  test("each raw HTML block kind ends only at its own end marker", () => {
    const bodies = [
      `<!--\n?>\n]]>\n</pre>\n${payload}secret\n-->\nAfter`,
      `<?php\n-->\n]]>\n${payload}secret\n?>\nAfter`,
      `<![CDATA[\n>\n-->\n?>\n${payload}secret\n]]>\nAfter`,
      `<pre>\n-->\n?>\n]]>\n${payload}secret\n</pre>\nAfter`,
    ];
    for (const body of bodies) {
      expect(isAllMarkdown(body)).toBe(true);
      expect(project(body).searchText).toBe("After");
    }
  });

  test("a pre, script, style or textarea block ends at any of the four end tags, as in CommonMark", () => {
    // CommonMark 0.31.2, HTML block condition 1: the end tag "need not match the start tag". The
    // codec ends the block there too, so the fence after it is a real block and its title is text.
    for (const [open, close] of [
      ["pre", "script"],
      ["script", "pre"],
      ["style", "textarea"],
      ["textarea", "style"],
    ]) {
      const body = `<${open}>\nsecret\n</${close}>\n${payload}</${open}>\nAfter`;
      expect(parseTempoBlocks(body).map((segment) => segment.kind)).toEqual([
        "markdown",
        "valid",
        "markdown",
      ]);
      // The stray end tag after the block is alone on its line, so it starts an HTML block of its
      // own (condition 7 in micromark) that runs to the next blank line, "After" included.
      expect(project(body).searchText).toBe("Email supervisor");
      expect(project(body.replace(/After$/, "\nAfter")).searchText).toBe("Email supervisor After");
    }
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

describe("raw HTML inside quotes and list items", () => {
  const secret = "secret html line";
  const cases: Record<string, string> = {
    quotePre: `> <pre>\n> ${secret}\n> </pre>\nAfter`,
    quoteNoSpace: `><script>\n>${secret}\n></script>\nAfter`,
    quoteComment: `> <!--\n> ${secret}\n> -->\nAfter`,
    quoteProcessing: `> <?php\n> ${secret}\n> ?>\nAfter`,
    // The quote marker is a ">" but not part of the block: only "> >" ends the declaration.
    quoteDeclaration: `> <!DOCTYPE x\n> ${secret}\n> ${secret} 2\n> >\nAfter`,
    quoteCdata: `> <![CDATA[\n> ${secret}\n> ]]>\nAfter`,
    nestedQuotes: `> > <!--\n> > ${secret}\n> > -->\nAfter`,
    dash: `- <script>\n  ${secret}\n  </script>\nAfter`,
    ordered: `1. <pre>\n   ${secret}\n   </pre>\nAfter`,
    listInQuote: `> - <style>\n>   ${secret}\n>   </style>\nAfter`,
    quoteInList: `- > <textarea>\n  > ${secret}\n  > </textarea>\nAfter`,
    itemOnItsOwnLine: `- item\n\n  <!--\n  ${secret}\n  -->\n\nAfter`,
    blankLineInItem: `- <pre>\n\n  ${secret}\n  </pre>\nAfter`,
    tempoFenceInside: `> <pre>\n> ${TICKS}json tempo\n> ${JSON.stringify(task)}\n> ${TICKS}\n> </pre>\nAfter`,
  };

  for (const [name, body] of Object.entries(cases)) {
    test(`${name}: the HTML block is not shown, the prose after it is`, () => {
      const result = project(body);
      expect(result.searchText).not.toContain("secret");
      expect(result.searchText).not.toContain("<");
      expect(result.searchText).not.toContain("Email supervisor");
      expect(result.searchText.endsWith("After")).toBe(true);
      expect(result.omittedBlocks).toBe(0);
    });
  }

  test("the HTML block ends with the quote or list item it is in, closed or not", () => {
    expect(project(`> <pre>\n> ${secret}\n\nAfter`).searchText).toBe("After");
    expect(project(`> <pre>\n> ${secret}\nAfter`).searchText).toBe("After");
    expect(project(`- <script>\n  ${secret}\nAfter`).searchText).toBe("After");
    expect(project(`- <!--\n  ${secret}\n- Next`).searchText).toBe("Next");
  });

  test("a real Tempo block after a container HTML block is still read", () => {
    expect(project(`> <pre>\n> ${secret}\n\n${fence(task)}After`).searchText).toBe(
      "Email supervisor After"
    );
    expect(project(`- <!--\n  ${secret}\n${fence(task)}After`).searchText).toBe(
      "Email supervisor After"
    );
  });
});

describe("inline HTML that runs over several lines", () => {
  const cases: Record<string, string> = {
    comment: "visible <!--\nprivate note\n--> public",
    longComment: "visible <!-- private\nprivate note\nprivate end --> public",
    tag: 'visible <span\nclass="secret private">x</span> public',
    closingTag: "visible </span\nprivate> public",
    processing: "visible <?php\nprivate\n?> public",
    cdata: "visible <![CDATA[\nprivate\n]]> public",
    declaration: "visible <!ELEMENT\nprivate x> public",
    inQuote: "> visible <!--\n> private note\n> --> public",
    lazyQuoteLine: "> visible <!--\nprivate note\n--> public",
    inListItem: "- visible <!--\n  private note\n  --> public",
    ltInsideComment: "visible <!-- private < note\nprivate --> public",
    // CommonMark keeps the hidden character, so "-\u{200B}->" does not end the comment.
    fakeEnd: "visible <!--\nnote -\u{200B}->\nprivate\n--> public",
    // The line is dropped as fence-looking, but the comment it opens still runs on.
    onDroppedLine: "visible\nsee ``` here <!--\nprivate\n--> public",
    // A quoted attribute value may hold ">", so a tag ends only at the ">" after its last value.
    quotedGt: 'visible <a title="x > private">public</a>',
    singleQuotedGt: "visible <a title='x > private'>public</a>",
    quotedGtSecondAttribute: "visible <a href=\"/x\" title='a > private'>public",
    quotedGtSelfClosing: 'visible <img alt="x > private"/>public',
    quotedGtOverLines: 'visible <a title="x >\nprivate > note">public',
    quoteClosedOnNextLine: 'visible <span class="a\nprivate">public',
    quotedGtInQuote: '> visible <a title="x > private">public',
    // The spec reads "/" as part of an unquoted value, micromark ends the tag there: hide either way.
    slashInUnquotedValue: 'visible <a href=/x/y title="z > private">public',
    // A hidden character in a quoted value cannot end it.
    hiddenInQuotedValue: 'visible <a title="x\u{200B} > private">public',
  };

  for (const [name, body] of Object.entries(cases)) {
    test(`${name}: the HTML is hidden up to its end, the text around it is kept`, () => {
      const result = project(body);
      expect(result.searchText).not.toContain("private");
      expect(result.searchText).not.toContain("secret");
      expect(result.searchText).not.toContain("<");
      expect(result.searchText).not.toContain("-->");
      expect(result.searchText.startsWith("visible")).toBe(true);
      expect(result.searchText.endsWith("public")).toBe(true);
    });
  }

  test("inline HTML on one line is removed whole, also a comment holding a <", () => {
    expect(project("a <!-- x < y --> b").searchText).toBe("a b");
    expect(project("a <?php echo 1; ?> b").searchText).toBe("a b");
    expect(project("a <!-- one --> b <!-- two --> c").searchText).toBe("a b c");
    expect(project("a <!--> b").searchText).toBe("a b");
  });

  test("an opener never closed is hidden to the end of its paragraph only", () => {
    expect(project("visible <!--\nprivate\n\npublic").searchText).toBe("visible public");
    expect(project('visible <span class="private"\nprivate\n\npublic').searchText).toBe(
      "visible public"
    );
    expect(project("> visible <!--\n> private\n>\n> public").searchText).toBe("visible public");
    expect(project('visible <a title="x > private\nprivate\n\npublic').searchText).toBe(
      "visible public"
    );
    expect(project("visible <a title='x > private\n\npublic").searchText).toBe("visible public");
  });

  test("a tag whose end is not certain hides the rest of its paragraph", () => {
    const bodies = [
      // A "<" in a quoted value: where that tag is not read as one (here a code span covers its
      // start), the "<" can start a tag of its own, which hides what follows it.
      'visible `x<a title="` <b c="> private">\nprivate\n\npublic',
      'visible <a title="a < b">private</a> private\nprivate\n\npublic',
      // Not a tag (no space before x), so CommonMark starts one at the inner "<" instead.
      "visible <a b=\"<c d='\"x>private'> private\n\npublic",
      // CommonMark reads "2." as a value here; without it, the line no longer parses as a tag.
      'visible <a b=\n2. d="x > private">private\n\npublic',
      // A control character is a value to CommonMark and a space here.
      'visible <a b=\u{7} c="x > private">private\n\npublic',
    ];
    for (const body of bodies) {
      expect(project(body).searchText).toMatch(/^visible (?:x )?public$/);
    }
  });

  test("a comment does not end on a later line where a tag may have started first", () => {
    // The quote ends the paragraph, and the comment with it, so the "-->" is inside a title.
    expect(project('visible <!--\n> <a title="--> private">public\n\nend').searchText).toBe(
      "visible end"
    );
    expect(project('visible <!--\n> <a title="\n--> private">public\n\nend').searchText).toBe(
      "visible end"
    );
  });

  test("a backslash-escaped < starts nothing, so a tag after it is still read as one", () => {
    expect(project('visible \\<!x <a title="x > private">public').searchText).toBe(
      "visible \\<!x public"
    );
    // An escaped backslash does not escape the "<" after it.
    expect(project('visible \\\\<a title="x > private">public').searchText).toBe(
      "visible \\\\ public"
    );
    // CommonMark keeps the hidden character, so there the "<" is not escaped and starts a tag.
    expect(project('visible \\\u{200B}<a title="x > private">private\n\npublic').searchText).toBe(
      "visible \\ public"
    );
  });

  test("a < that starts no tag is text, as it is in CommonMark", () => {
    expect(project("mail <a@b.example> or see <https://example.invalid/x>").searchText).toBe(
      "mail <a@b.example> or see <https://example.invalid/x>"
    );
  });

  test("a Tempo block ends the paragraph, and the inline HTML left open in it", () => {
    expect(project(`visible <!--\n${fence(task)}public`).searchText).toBe(
      "visible Email supervisor public"
    );
  });
});

describe("hidden characters never end a block", () => {
  // CommonMark keeps these characters, so to it these lines are not closers, end markers or blank.
  test("a closing fence with a hidden character does not close the fence", () => {
    for (const hidden of ["\u{200B}", "\u{FEFF}", "\u{AD}", "\u{2028}", "\u{7}"]) {
      const body = `${TICKS}js\ncode\n${TICKS}${hidden}\nsecret code\n${TICKS}\nAfter`;
      expect(project(body).searchText).toBe("After");
      const quoted = `> ${TICKS}js\n> code\n> ${TICKS}${hidden}\n> secret code\n> ${TICKS}\nAfter`;
      expect(project(quoted).searchText).toBe("After");
    }
  });

  test("an end marker split by a hidden character does not end the raw HTML block", () => {
    const bodies = [
      `<!--\nnote\n-\u{200B}->\nsecret comment\n-->\nAfter`,
      `<pre>\n<\u{200B}/pre>\nsecret html\n</pre>\nAfter`,
      `<?php\n?\u{FEFF}>\nsecret html\n?>\nAfter`,
      `<!-- note -\u{200B}->\nsecret comment\n-->\nAfter`,
      `> <!--\n> -\u{200B}->\n> secret comment\n> -->\nAfter`,
    ];
    for (const body of bodies) {
      expect(project(body).searchText).toBe("After");
    }
  });

  test("a line of hidden characters does not end an HTML block that ends at a blank line", () => {
    const body = `<div>\n\u{200B}\n${fence(task)}\nAfter`;
    expect(parseTempoBlocks(body).some((segment) => segment.kind === "valid")).toBe(true);
    expect(project(body).searchText).toBe("After");
    expect(project(`<div>\n\n${fence(task)}After`).searchText).toBe("Email supervisor After");
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
    // A quoted attribute value may hold ">": the tag is still complete and alone on its line.
    quotedGt: `<span title="x > y">\n${payload}After`,
    singleQuotedGt: `<span title='x > y'>\n${payload}After`,
    quotedGtSelfClosing: `<span title="x > y"/>\n${payload}After`,
    quotedGtCustomElement: `<my-widget data-a='1' data-b="x > y" hidden>\n${payload}After`,
    // micromark also starts a block where a value follows an unquoted one.
    chainedValue: `<span title=x=" > y">\n${payload}After`,
    // Only "<pre>" and the like start a block that ends at an end tag; micromark reads these as
    // condition 7.
    closingPre: `</pre>\n${payload}After`,
    closingScript: `</script>\n${payload}After`,
    selfClosingPre: `<pre/>\n${payload}After`,
    // Inside an HTML block "> " and "- " are HTML too, not a quote or list item with a blank line.
    quoteMarkersInBlock: `<div>\n> \n> \n${payload}After`,
    listMarkersInBlock: `<div>\n- \n- \n${payload}After`,
  };

  for (const [name, body] of Object.entries(gated)) {
    test(`${name}: the codec trusts it, the projection does not`, () => {
      expect(parseTempoBlocks(body).some((segment) => segment.kind === "valid")).toBe(true);
      const result = project(body);
      expect(result.searchText).not.toContain("Email supervisor");
      // With no blank line after the fence, "After" is still inside the HTML block.
      expect(result.searchText).not.toContain("After");
      expect(result.omittedBlocks).toBe(0);
      const ended = project(body.replace(/After$/, "\nAfter"));
      expect(ended.searchText).not.toContain("Email supervisor");
      expect(ended.searchText.endsWith("After")).toBe(true);
    });
  }

  test("every block in the same HTML block is left out, and the blank line that ends it is honoured", () => {
    expect(project(`<div>\n${payload}${second}After`).searchText).toBe("");
    expect(project(`<div>\n${payload}\n${second}After`).searchText).toBe("Second block After");
    expect(project(`<div>\n${payload}\n\n${second}After`).searchText).toBe("Second block After");
  });

  test("broken and unclosed fences inside the HTML block are not counted as blocks", () => {
    const broken = `<div>\n${TICKS}json tempo\n{ nope\n${TICKS}\nAfter`;
    expect(parseTempoBlocks(broken).some((segment) => segment.kind === "broken")).toBe(true);
    expect(project(broken).omittedBlocks).toBe(0);
    expect(project(broken).searchText).toBe("");
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
    quotedGtThenText: {
      body: `<span title="x > y">text\n${payload}After`,
      text: "text Email supervisor After",
    },
    // The quote never closes on its line, so the tag is not complete: a paragraph, which the fence
    // interrupts.
    unclosedQuote: { body: `<span title="x >\n${payload}After`, text: "Email supervisor After" },
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
    expect(project(body).searchText).toBe("Email supervisor");
  });

  test("no line of an HTML block that ends at a blank line is shown, its first line included", () => {
    const cases: Record<string, string> = {
      "<div>\nprivate\n\npublic": "public",
      '<div class="note">\nprivate\nmore private\n\npublic': "public",
      "<td>secret cell</td>\nprivate\n\npublic": "public",
      "</div>\nprivate\n\npublic": "public",
      "<span>\nprivate\n\npublic": "public",
      '<my-widget data-x="1">\nprivate\n\npublic': "public",
      '<span title="x > private">\nprivate\n\npublic': "public",
      "</pre>\nprivate\n\npublic": "public",
      // A new list item or quote is a new block, so its tag line starts one after a paragraph too.
      "Intro\n- <span>\n  private\n\npublic": "Intro public",
      "Intro\n> <span>\n> private\n\npublic": "Intro public",
      // micromark starts one on a line that does not continue the list item, too.
      '- item\n<span title=x=" > private">\n\npublic': "item public",
      "Intro\n<section>\nprivate\n\npublic": "Intro public",
      // A tag alone on a line cannot interrupt a paragraph (condition 7), so this stays text.
      "Intro\n<span>\nstill text\n\npublic": "Intro still text public",
      "> <div>\n> private\n\npublic": "public",
      "> <div>\n> private\nAfter": "After",
      "- <div>\n  private\n\n  item text\nAfter": "item text After",
      // A line of hidden characters is not blank, so the block goes on.
      "<div>\nprivate\n\u{200B}\nmore private\n\npublic": "public",
    };
    for (const [body, text] of Object.entries(cases)) {
      const result = project(body);
      expect(result.searchText).toBe(text);
      expect(result.searchText).not.toContain("private");
      expect(result.searchText).not.toContain("secret");
    }
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
});

describe("pathological bodies stay linear", () => {
  const size = 1_000_000;
  /**
   * One test per body, each built inside its test, so a slow runner never has to fit all of them in
   * one test's time. Every body must still project within the same 3 s.
   */
  const bodies: Record<string, () => string> = {
    commentOpeners: () => "x ".concat("<!--".repeat(size / 4)),
    brackets: () => "[".repeat(size),
    tagStarts: () => "<a ".repeat(size / 3),
    dashes: () => "-".repeat(size).concat("x"),
    spacesBeforeHash: () => "a".concat(" ".repeat(size), "b #"),
    emphasisMarkers: () => "*_".repeat(size / 2),
    backslashes: () => '"'.concat("\\".repeat(size / 2)),
    bracketAndSpaces: () => `[${" ".repeat(size)}x`,
    backticks: () => "`".repeat(size),
    quoteMarkers: () => "> ".repeat(size / 2),
    listMarkers: () => "- ".repeat(size / 2),
    greaterThans: () => ">".repeat(size),
    orderedMarkers: () => "1. ".repeat(size / 3),
    nestedContainersAndFence: () => "> - ".repeat(size / 4).concat("```js"),
    fencesInItems: () => `- ${TICKS}js\n`.repeat(size / 8),
    fencesInQuotes: () => `> ${TICKS}\n  x\n`.repeat(size / 12),
    htmlBlockLines: () => "<div>\n".repeat(size / 6),
    tagStartsClosedAtEnd: () => "<a ".repeat(size / 3).concat(">"),
    gatedFences: () => `<span>\n${TICKS}json tempo\n{}\n${TICKS}\n`.repeat(size / 40),
    tabs: () => "\t".repeat(size),
    itemAndTabs: () => `- ${"\t".repeat(size / 2)}x`,
    flags: () => "🇮🇱".repeat(size / 4),
    flagsAfterLoneIndicator: () => "x🇮".concat("🇮🇱".repeat(size / 4)),
    quotedCommentOpeners: () => "> <!--\n".repeat(size / 7),
    preInItem: () => `- <pre>\n${"  x\n".repeat(size / 4)}`,
    closedComments: () => "a <!-- -->".repeat(size / 10),
    instructionOpeners: () => "a <?".repeat(size / 4),
    tagsOpenOnEveryLine: () => "x <b\n".repeat(size / 5),
    commentsOpenOnEveryLine: () => "x <!--\ny\n".repeat(size / 9),
    htmlBlocksWithText: () => "<div>\nx\n".repeat(size / 8),
    unclosedQuotedValues: () => '<a b="'.repeat(size / 6),
    quotedGtInEveryTag: () => '<a title="x > y">z'.repeat(size / 18),
    quotedGtTagLines: () => '<a title="x > y">\n'.repeat(size / 18),
    quotesOpenOverLines: () => 'x <a title="\n'.repeat(size / 13),
    slashesInUnquotedValues: () => "<a b=c/".repeat(size / 7),
    closingTagsOpenOnEveryLine: () => "</a\n".repeat(size / 4),
    oneLongQuotedValue: () => '<a title="'.concat("x".repeat(size), '">'),
    manyAttributes: () => "<a".concat(' b="x > y"'.repeat(size / 10), ">"),
  };

  for (const [name, build] of Object.entries(bodies)) {
    test(
      name,
      () => {
        const body = build();
        const started = performance.now();
        const result = projectPageText(body);
        expectSafe(result.searchText);
        expect(performance.now() - started).toBeLessThan(3000);
      },
      PATHOLOGICAL_TIMEOUT_MS
    );
  }
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
        expectWholeFlags(kept);
      }
    }
  });

  test("a cut never splits a flag into its two regional indicators", () => {
    expect(project("A 🇮🇱 B", { summaryChars: 5 }).summary).toBe("A\u{2026}");
    expect(project("A 🇮🇱 B", { summaryChars: 7 }).summary).toBe("A 🇮🇱\u{2026}");
    expect(project("A 🇮🇱 B", { searchChars: 4 }).searchText).toBe("A");
    const flags = "🇮🇱🇺🇸🇯🇵🇧🇷 ".repeat(6);
    for (let max = 1; max <= flags.length + 2; max += 1) {
      expectWholeFlags(project(flags, { summaryChars: max }).summary);
      expectWholeFlags(project(flags, { searchChars: max }).searchText);
    }
  });
});

/** Every run of regional indicators in `text` is made of whole flags (the fixtures hold only flags). */
function expectWholeFlags(text: string) {
  for (const run of text.match(/\p{RI}+/gu) ?? []) {
    expect([...run].length % 2).toBe(0);
  }
}

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

  test("a short snippet still shows the match it was asked for", () => {
    expect(pageSnippet({ searchText: text }, "needle", 10)).toBe("\u{2026}Needle\u{2026}");
    const early = `${"ab ".repeat(5)}Needle ${filler}`;
    for (const searchText of [text, early, `${filler}${filler}Needle`]) {
      for (let max = "needle".length + 2; max <= 60; max += 1) {
        const snippet = pageSnippet({ searchText }, "needle", max);
        expect(snippet.length).toBeLessThanOrEqual(max);
        expect(snippet).toContain("Needle");
      }
    }
  });

  test("a snippet never starts or ends inside a flag", () => {
    const flags = "🇮🇱🇺🇸🇯🇵".repeat(8);
    const searchText = `${flags}Needle${flags}`;
    for (let max = 0; max <= 60; max += 1) {
      for (const query of ["needle", ""]) {
        const snippet = pageSnippet({ searchText }, query, max);
        expect(snippet.length).toBeLessThanOrEqual(max);
        expectWholeFlags(snippet);
        if (query !== "" && max >= 8) expect(snippet).toContain("Needle");
      }
    }
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
      if (max >= "מילת מפתח".length + 2) expect(snippet).toContain("מילת מפתח");
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
