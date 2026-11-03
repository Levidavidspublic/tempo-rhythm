import { describe, expect, test } from "bun:test";
import { parseTempoBlocks } from "@tempo/utils";
import {
  applyTemplateTokens,
  backlinksFor,
  closesPageMenu,
  dayTokens,
  exportContents,
  exportFileName,
  exportMarkdownFile,
  filterSlashCommands,
  findWikiLinks,
  insertedBlockId,
  isDirty,
  isoWeek,
  newBlockId,
  newTaskBlock,
  pickPages,
  removeRange,
  SLASH_COMMANDS,
  setTaskTitle,
  type SlashCommandId,
  slashInsertion,
  slashQuery,
  tempoBlockRanges,
  tempoFence,
  textChange,
  wikiLinkAtOffset,
  wikiQuery,
} from "./markdown-model";

const LABELS = Object.fromEntries(SLASH_COMMANDS.map((c) => [c.id, c.id])) as Record<SlashCommandId, string>;

describe("slash menu", () => {
  test("opens on a slash at line start or after a space, with a short query", () => {
    expect(slashQuery("/")).toEqual({ query: "", offset: 0 });
    expect(slashQuery("/tab")).toEqual({ query: "tab", offset: 0 });
    expect(slashQuery("notes /h")).toEqual({ query: "h", offset: 6 });
    expect(slashQuery("a/b")).toBeNull();
    expect(slashQuery("https://x")).toBeNull();
    expect(slashQuery("/two words")).toBeNull();
  });

  test("the Text group has exactly the settled commands (decision 7)", () => {
    expect(SLASH_COMMANDS.filter((c) => c.group === "text").map((c) => c.id)).toEqual([
      "h1",
      "h2",
      "h3",
      "bullet",
      "numbered",
      "checklist",
      "quote",
      "code",
      "divider",
      "table",
    ]);
  });

  test("filters by label and keyword, in English and Hebrew", () => {
    expect(filterSlashCommands("table", LABELS).map((c) => c.id)).toEqual(["table"]);
    expect(filterSlashCommands("טבלה", LABELS).map((c) => c.id)).toEqual(["table"]);
    expect(filterSlashCommands("", LABELS)).toHaveLength(SLASH_COMMANDS.length);
  });

  test("checklist inserts a plain markdown checkbox, not a Tempo task (decision 4)", () => {
    expect(slashInsertion("checklist", true)).toEqual({ text: "- [ ] ", cursor: 6 });
    expect(slashInsertion("h2", false)).toEqual({ text: "\n## ", cursor: 4 });
  });

  test("the task command inserts one valid Tempo task fence", () => {
    const { text } = slashInsertion("task", true);
    const segments = parseTempoBlocks(text);
    expect(segments.filter((s) => s.kind === "valid")).toHaveLength(1);
  });

  test("the table command inserts a GFM table", () => {
    expect(slashInsertion("table", true).text).toBe("| Column | Column |\n| --- | --- |\n|  |  |");
  });
});

describe("[[links]]", () => {
  const body = 'See [[Moving checklist]] and [[רשימת המעבר|the list]].\n```json tempo\n{"x":"[[Not a link]]"}\n```\n';

  test("finds links outside Tempo fences, with aliases", () => {
    expect(findWikiLinks(body).map((l) => l.title)).toEqual(["Moving checklist", "רשימת המעבר"]);
  });

  test("the picker opens on an unclosed [[ before the cursor", () => {
    expect(wikiQuery("see [[Mov")).toEqual({ query: "Mov", offset: 4 });
    expect(wikiQuery("see [[Moving]] ok")).toBeNull();
  });

  test("Mod-Enter finds the [[link]] under the cursor, brackets included", () => {
    const line = "see [[Moving|the move]] and [[רשימה]]";
    expect(wikiLinkAtOffset(line, 3)).toBeNull();
    expect(wikiLinkAtOffset(line, 4)).toBe("Moving");
    expect(wikiLinkAtOffset(line, 12)).toBe("Moving");
    expect(wikiLinkAtOffset(line, 23)).toBe("Moving");
    expect(wikiLinkAtOffset(line, 25)).toBeNull();
    expect(wikiLinkAtOffset(line, line.length)).toBe("רשימה");
    expect(wikiLinkAtOffset("an [[unclosed link", 6)).toBeNull();
  });

  test("Linked here lists other pages that link to this title, with the line as context", () => {
    const pages = [
      { id: "a", title: "Week 42", body: "- Monday: slides, then [[Today]].\nOther line" },
      { id: "b", title: "Today", body: "[[Today]] links itself" },
      { id: "c", title: "Unrelated", body: "No links here" },
      { id: "d", title: "Alias", body: "> see [[today|the day]]" },
    ];
    expect(backlinksFor("Today", "b", pages)).toEqual([
      { id: "a", title: "Week 42", context: "Monday: slides, then Today." },
      { id: "d", title: "Alias", context: "see the day" },
    ]);
  });

  test("the picker ranks titles that start with the query first and skips this page", () => {
    const pages = [
      { id: "1", title: "Kitchen moving", body: "" },
      { id: "2", title: "Moving checklist", body: "" },
      { id: "3", title: "Moving", body: "" },
    ];
    expect(pickPages("mov", pages, "3").map((p) => p.id)).toEqual(["2", "1"]);
  });
});

describe("templates", () => {
  test("fills known {{tokens}} and keeps unknown ones as typed", () => {
    expect(applyTemplateTokens("# {{title}}\n{{ date }} {{mood}}", { title: "Monday", date: "2026-10-12" })).toBe(
      "# Monday\n2026-10-12 {{mood}}",
    );
  });

  test("leaves tokens inside Tempo fences alone", () => {
    const fence = '```json tempo\n{"id":"blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2W","v":1,"type":"page-meta","data":{"pageType":"daily","tags":["{{date}}"]}}\n```\n';
    expect(applyTemplateTokens(`{{date}}\n${fence}`, { date: "D" })).toBe(`D\n${fence}`);
  });

  test("day tokens in English and Hebrew", () => {
    expect(dayTokens("2026-10-12", "en")).toMatchObject({ date: "2026-10-12", weekday: "Monday", week: "42" });
    expect(dayTokens("2026-10-12", "he").weekday).toContain("שני");
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toBe(1);
  });
});

describe("blocks", () => {
  test("new block ids pass the codec's id rule", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(newBlockId()).toMatch(/^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    }
  });

  test("removing a block removes exactly its source", () => {
    const body = "a\n```json tempo\n{}\n```\nb";
    const [range] = tempoBlockRanges(body);
    expect(removeRange(body, range!)).toBe("a\nb");
  });
});

describe("page menu", () => {
  test("Export .md file names keep letters and drop path characters", () => {
    expect(exportFileName("Weekend reset")).toBe("Weekend reset.md");
    expect(exportFileName("רשימת/המעבר: 2026")).toBe("רשימת המעבר 2026.md");
    expect(exportFileName("   ")).toBe("Untitled.md");
  });

  test("dirty only when the text differs", () => {
    expect(isDirty("a", "a")).toBe(false);
    expect(isDirty("a", "a ")).toBe(true);
  });

  test("Export .md starts with the title as a heading, a blank line, then the body as saved", () => {
    const body = "Pack the kitchen.\n\n- [ ] Boxes\n";
    expect(exportMarkdownFile("Moving day", body, "Untitled")).toBe(`# Moving day\n\n${body}`);
    expect(exportMarkdownFile("  Moving   day ", "x", "Untitled")).toBe("# Moving day\n\nx");
  });

  test("Export .md keeps Tempo fences and every body byte after the heading", () => {
    const body = `Before\n${tempoFence(newTaskBlock("Call the bank", 0, () => 0))}After`;
    expect(exportMarkdownFile("Week", body, "Untitled")).toBe(`# Week\n\n${body}`);
  });

  test("an untitled page gets the app's untitled name", () => {
    expect(exportMarkdownFile("", "Hello", "Untitled")).toBe("# Untitled\n\nHello");
    expect(exportMarkdownFile("   ", "Hello", "ללא כותרת")).toBe("# ללא כותרת\n\nHello");
  });

  test("an empty page exports just the heading, never a 0-byte file", () => {
    expect(exportMarkdownFile("Inbox", "", "Untitled")).toBe("# Inbox\n");
    expect(exportMarkdownFile("Inbox", " \n\n", "Untitled")).toBe("# Inbox\n");
    expect(exportMarkdownFile("", "", "Untitled")).toBe("# Untitled\n");
  });

  test("a title that starts with Markdown marks stays a plain heading", () => {
    const heading = (title: string) => exportMarkdownFile(title, "", "Untitled");
    expect(heading("# Not a subheading")).toBe("# \\# Not a subheading\n");
    expect(heading("#hashtag")).toBe("# \\#hashtag\n");
    expect(heading("#")).toBe("# \\#\n");
    expect(heading("* starred")).toBe("# \\* starred\n");
    expect(heading("*bold* and _soft_")).toBe("# \\*bold\\* and \\_soft\\_\n");
    expect(heading("> quoted")).toBe("# \\> quoted\n");
    expect(heading("- item")).toBe("# \\- item\n");
    expect(heading("+ item")).toBe("# \\+ item\n");
    expect(heading("1. First")).toBe("# 1\\. First\n");
    expect(heading("12) Twelfth")).toBe("# 12\\) Twelfth\n");
  });

  test("a title keeps its inline text and its trailing #", () => {
    const heading = (title: string) => exportMarkdownFile(title, "", "Untitled");
    expect(heading("Ideas #")).toBe("# Ideas \\#\n");
    expect(heading("Ideas ##")).toBe("# Ideas \\##\n");
    expect(heading("C# notes")).toBe("# C# notes\n");
    expect(heading("A > B")).toBe("# A > B\n");
    expect(heading("[link](x) `code` <b> ~~gone~~ \\")).toBe(
      "# \\[link\\](x) \\`code\\` \\<b> \\~\\~gone\\~\\~ \\\\\n",
    );
    expect(heading("Q&A &amp; more")).toBe("# Q&A \\&amp; more\n");
  });

  test("Hebrew titles and bodies export as typed", () => {
    expect(exportMarkdownFile("רשימת המעבר", "לארוז את המטבח\n", "ללא כותרת")).toBe("# רשימת המעבר\n\nלארוז את המטבח\n");
    expect(exportMarkdownFile("#משימות", "", "ללא כותרת")).toBe("# \\#משימות\n");
    expect(exportMarkdownFile("- קניות", "", "ללא כותרת")).toBe("# \\- קניות\n");
  });

  test("Copy as Markdown still copies the body alone", () => {
    expect(exportContents("Body only\n")).toBe("Body only\n");
  });

  test("Escape closes the page menu unless a popup above took it or an IME is composing", () => {
    expect(closesPageMenu({ key: "Escape" })).toBe(true);
    expect(closesPageMenu({ key: "Escape", isComposing: false, keyCode: 27, defaultPrevented: false })).toBe(true);
    expect(closesPageMenu({ key: "Escape", defaultPrevented: true })).toBe(false);
    expect(closesPageMenu({ key: "Escape", isComposing: true })).toBe(false);
    expect(closesPageMenu({ key: "Escape", keyCode: 229 })).toBe(false);
    expect(closesPageMenu({ key: "Process", keyCode: 229 })).toBe(false);
    expect(closesPageMenu({ key: "Enter" })).toBe(false);
    expect(closesPageMenu({ key: "Esc" })).toBe(false);
  });
});

describe("task titles", () => {
  test("renaming a task changes only its fence; empty or unchanged titles leave the body alone", () => {
    const body = `Before\n${tempoFence(newTaskBlock("New task", 0, () => 0))}After`;
    const range = tempoBlockRanges(body)[0]!;
    const renamed = setTaskTitle(body, range, "  Call   the bank ");
    expect(renamed.startsWith("Before\n")).toBe(true);
    expect(renamed.endsWith("After")).toBe(true);
    expect(parseTempoBlocks(renamed).find((s) => s.kind === "valid")).toMatchObject({ block: { data: { title: "Call the bank" } } });
    expect(setTaskTitle(body, range, "   ")).toBe(body);
    expect(setTaskTitle(body, range, "New task")).toBe(body);
  });

  test("the inserted fence's block id can be read back", () => {
    const { text } = slashInsertion("task", true);
    const id = insertedBlockId(text);
    expect(id).toMatch(/^blk_[0-9A-Z]{26}$/);
    expect(text).toContain(id!);
  });
});

describe("textChange", () => {
  const apply = (before: string, c: { from: number; to: number; insert: string }) =>
    before.slice(0, c.from) + c.insert + before.slice(c.to);

  test("an append is one insertion at the end", () => {
    const before = "## Intention\nRest\n";
    const after = `${before}\n### This afternoon\n`;
    expect(textChange(before, after)).toEqual({ from: before.length, to: before.length, insert: "\n### This afternoon\n" });
  });

  test("a removal in the middle touches only that range", () => {
    expect(textChange("a\nXYZ\nb", "a\nb")).toEqual({ from: 2, to: 6, insert: "" });
  });

  test("equal text is an empty change", () => {
    expect(textChange("same", "same")).toEqual({ from: 4, to: 4, insert: "" });
  });

  test("a repeated run is never counted twice", () => {
    const c = textChange("aaa", "aaaa");
    expect(apply("aaa", c)).toBe("aaaa");
    expect(c.to - c.from).toBe(0);
  });

  test("never splits a surrogate pair", () => {
    const before = "x😀y";
    const after = "x😃y";
    const c = textChange(before, after);
    expect(apply(before, c)).toBe(after);
    expect(c).toEqual({ from: 1, to: 3, insert: "😃" });
  });

  test("any pair of texts round-trips", () => {
    const samples = ["", "a", "ab", "abc", "😀", "a😀b", "hello\nworld\n", "שלום עולם", "```json tempo\n{}\n```\n"];
    for (const before of samples) {
      for (const after of samples) expect(apply(before, textChange(before, after))).toBe(after);
    }
  });
});
