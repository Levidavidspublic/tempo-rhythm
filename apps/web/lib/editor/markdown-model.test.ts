import { describe, expect, test } from "bun:test";
import { parseTempoBlocks } from "@tempo/utils";
import {
  applyTemplateTokens,
  backlinksFor,
  dayTokens,
  exportFileName,
  filterSlashCommands,
  findWikiLinks,
  isDirty,
  isoWeek,
  newBlockId,
  pickPages,
  removeRange,
  SLASH_COMMANDS,
  type SlashCommandId,
  slashInsertion,
  slashQuery,
  tempoBlockRanges,
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
});
