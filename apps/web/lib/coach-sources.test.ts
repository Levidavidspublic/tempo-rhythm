import { describe, expect, test } from "bun:test";
import { createParser, Renderer } from "@openuidev/react-lang";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoachSourcesTContext, coachSourcesLibrary } from "@/components/coach/openui/CoachSourcesLibrary";
import { SourcesCard } from "@/components/coach/SourcesCard";
import {
  citedNumbers,
  MAX_SOURCES,
  nextUtcDayStartMs,
  rowLabel,
  safeSourceUrl,
  searchesLeft,
  siteLabel,
  sourceRows,
  sourcesProgram,
  utcDayOf,
} from "./coach-sources";
import { type Lang, MESSAGES, type MessageKey, translate } from "./i18n";

const parser = createParser(coachSourcesLibrary.toJSONSchema(), coachSourcesLibrary.root);

const SOURCES = [
  { title: "Real Madrid 2–1 Barcelona: match report", site: "marca.com", url: "https://www.marca.com/futbol/report.html" },
  { title: "מזג האוויר בתל אביב", site: "ims.gov.il", url: "https://ims.gov.il/he/forecast" },
  { title: "Opening hours", site: "example.org", url: "http://example.org/hours" },
];

const tFor = (lang: Lang) => (key: MessageKey) => translate(lang, key);

function renderOpenUi(program: string, lang: Lang = "en") {
  return renderToStaticMarkup(
    createElement(
      CoachSourcesTContext.Provider,
      { value: tFor(lang) },
      createElement(Renderer, { response: program, library: coachSourcesLibrary }),
    ),
  );
}

describe("safeSourceUrl", () => {
  test("keeps http and https links", () => {
    expect(safeSourceUrl("https://marca.com/a?b=1#c")).toBe("https://marca.com/a?b=1#c");
    expect(safeSourceUrl("  http://example.org/hours  ")).toBe("http://example.org/hours");
  });

  test("drops every other kind of link", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "mailto:a@b.c",
      "ftp://example.org/file",
      "/relative/path",
      "example.org",
      "https://",
      "",
      `https://example.org/${"a".repeat(2100)}`,
    ]) {
      expect(safeSourceUrl(bad)).toBeNull();
    }
    expect(safeSourceUrl(undefined)).toBeNull();
    expect(safeSourceUrl(42)).toBeNull();
  });

  test("removes a user name and password, so the link goes where it says", () => {
    expect(safeSourceUrl("https://google.com:pw@evil.example/x")).toBe("https://evil.example/x");
  });
});

describe("siteLabel", () => {
  test("names the link's own host, without www.", () => {
    expect(siteLabel("trusted.example", "https://www.marca.com/x")).toBe("marca.com");
    expect(siteLabel("", "https://WWW.Example.org/")).toBe("example.org");
  });

  test("international hosts show as the browser will open them", () => {
    expect(siteLabel("", safeSourceUrl("https://עברית.co.il/"))).toBe("xn--5dbqzzl.co.il");
  });

  test("without a link it falls back to the stored site, on one line", () => {
    expect(siteLabel(" www.ims.gov.il\n", null)).toBe("ims.gov.il");
    expect(siteLabel(undefined, null)).toBe("");
  });
});

describe("citedNumbers", () => {
  test("reads [n], lists, runs and ranges within the source count", () => {
    expect([...citedNumbers("It won [1]. Rain later [3].", 3)]).toEqual([1, 3]);
    expect([...citedNumbers("Both say so [1, 2].", 3)]).toEqual([1, 2]);
    expect([...citedNumbers("Both say so [1][2].", 3)]).toEqual([1, 2]);
    expect([...citedNumbers("See [2-3].", 3)]).toEqual([2, 3]);
    expect([...citedNumbers("גשם בערב [2].", 3)]).toEqual([2]);
  });

  test("ignores numbers out of range and other brackets", () => {
    expect(citedNumbers("[0] [4] [99] [a] [ ] [1.5]", 3).size).toBe(0);
    expect(citedNumbers("No citations here.", 3).size).toBe(0);
    expect(citedNumbers("[3-1] [1-999]", 3).size).toBe(0);
  });
});

describe("sourceRows", () => {
  test("numbers rows in stored order and lists only what the reply cites", () => {
    const rows = sourceRows(SOURCES, "It won [1]. Open until 9 [3].");
    expect(rows.map((r) => r.numbers)).toEqual([[1], [3]]);
    expect(rows[0]).toEqual({
      numbers: [1],
      title: "Real Madrid 2–1 Barcelona: match report",
      site: "marca.com",
      href: "https://www.marca.com/futbol/report.html",
    });
  });

  test("a reply that cites none lists them all", () => {
    expect(sourceRows(SOURCES, "Here is what I found.").map((r) => r.numbers)).toEqual([[1], [2], [3]]);
    expect(sourceRows(SOURCES).map((r) => r.numbers)).toEqual([[1], [2], [3]]);
  });

  test("the same link twice is one row carrying both numbers", () => {
    const twice = [SOURCES[0], SOURCES[1], { ...SOURCES[0], title: "Same page again" }];
    const rows = sourceRows(twice, "[1] [2] [3]");
    expect(rows.map((r) => r.numbers)).toEqual([[1, 3], [2]]);
    expect(rows[0]?.title).toBe(SOURCES[0]?.title);
    expect(rowLabel(rows[0]?.numbers ?? [])).toBe("[1, 3]");
  });

  test("an unsafe link keeps its row and number, without a link", () => {
    const rows = sourceRows([{ title: "Tricky", site: "www.tricky.example", url: "javascript:alert(1)" }, SOURCES[1]]);
    expect(rows[0]).toEqual({ numbers: [1], title: "Tricky", site: "tricky.example", href: null });
    expect(rows[1]?.numbers).toEqual([2]);
  });

  test("bad entries are skipped without renumbering the rest", () => {
    const rows = sourceRows([null, "text", { title: "", site: "", url: "nope" }, SOURCES[2]]);
    expect(rows.map((r) => r.numbers)).toEqual([[4]]);
  });

  test("titles are one line; a missing title shows the site", () => {
    const rows = sourceRows([
      { title: "Line one\nline   two", site: "a.example", url: "https://a.example/" },
      { title: "  ", site: "b.example", url: "https://b.example/" },
    ]);
    expect(rows.map((r) => r.title)).toEqual(["Line one line two", "b.example"]);
  });

  test("no sources, or not a list, is no rows", () => {
    expect(sourceRows(undefined, "[1]")).toEqual([]);
    expect(sourceRows({ 0: SOURCES[0] })).toEqual([]);
    expect(sourceRows([])).toEqual([]);
  });

  test("reads at most MAX_SOURCES", () => {
    const many = Array.from({ length: MAX_SOURCES + 5 }, (_, i) => ({ title: `T${i}`, site: "s", url: `https://s.example/${i}` }));
    expect(sourceRows(many)).toHaveLength(MAX_SOURCES);
  });
});

describe("sourcesProgram", () => {
  test("OpenUI's own parser reads it with no errors, rows in order", () => {
    const rows = sourceRows(SOURCES);
    const result = parser.parse(sourcesProgram(rows));
    expect(result.meta.errors).toEqual([]);
    expect(result.meta.incomplete).toBe(false);
    expect(result.root?.typeName).toBe("SourcesCard");
    const parsed = (result.root?.props as { rows: { props: Record<string, unknown> }[] }).rows.map((r) => r.props);
    expect(parsed.map((p) => p.label)).toEqual(["[1]", "[2]", "[3]"]);
    expect(parsed[1]?.title).toBe("מזג האוויר בתל אביב");
    expect(parsed[2]?.href).toBe("http://example.org/hours");
  });

  test("quotes, backslashes and Hebrew come back unchanged; a row without a link parses", () => {
    const title = 'He said "go" \\ אז הלכנו';
    const result = parser.parse(sourcesProgram([{ numbers: [2], title, site: "x.example", href: null }]));
    expect(result.meta.errors).toEqual([]);
    const row = (result.root?.props as { rows: { props: Record<string, unknown> }[] }).rows[0]?.props;
    expect(row?.title).toBe(title);
    expect(row?.href ?? null).toBeNull();
  });
});

describe("the sources card", () => {
  test("through OpenUI: numbered rows, title in its own direction, safe new-tab links", () => {
    const html = renderOpenUi(sourcesProgram(sourceRows(SOURCES, "[1] and [2]")));
    expect(html).toContain('data-component="SourcesCard"');
    expect(html).toContain('data-renderer="openui"');
    expect(html).toContain(">Sources<");
    expect(html).toContain(">[1]<");
    expect(html).toContain(">[2]<");
    expect(html).not.toContain(">[3]<");
    expect(html).toContain('href="https://www.marca.com/futbol/report.html"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('dir="auto"');
    expect(html).toContain('<span dir="ltr">marca.com</span>');
    expect(html).toContain("(opens in a new tab)");
  });

  test("through OpenUI: a link that slips into a program is checked again", () => {
    const html = renderOpenUi('root = SourcesCard([r])\nr = SourceRow("[1]", "Bad", "bad.example", "javascript:alert(1)")');
    expect(html).toContain("Bad");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a ");
  });

  test("in Hebrew the card's words are Hebrew and the site stays left to right", () => {
    const html = renderOpenUi(sourcesProgram(sourceRows(SOURCES)), "he");
    expect(html).toContain(">מקורות<");
    expect(html).toContain(">רשת<");
    expect(html).toContain("(נפתח בכרטיסייה חדשה)");
    expect(html).toContain('<span dir="ltr">ims.gov.il</span>');
  });

  test("the direct card (?openui=off) draws the same rows, without the OpenUI mark", () => {
    const html = renderToStaticMarkup(createElement(SourcesCard, { t: tFor("en"), rows: sourceRows(SOURCES) }));
    expect(html).toContain('data-component="SourcesCard"');
    expect(html).not.toContain("data-renderer");
    expect(html.match(/data-component="SourceRow"/g)).toHaveLength(3);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(3);
    expect(html.indexOf("marca.com")).toBeLessThan(html.indexOf("ims.gov.il"));
  });
});

describe("web search count", () => {
  test("the UTC day and when the next one starts", () => {
    expect(utcDayOf(Date.UTC(2026, 9, 16, 23, 59, 59))).toBe("2026-10-16");
    expect(utcDayOf(Date.UTC(2026, 9, 17, 0, 0, 0))).toBe("2026-10-17");
    expect(nextUtcDayStartMs("2026-10-16")).toBe(Date.UTC(2026, 9, 17));
    expect(nextUtcDayStartMs("2026-12-31")).toBe(Date.UTC(2027, 0, 1));
    expect(Number.isNaN(nextUtcDayStartMs("not a day"))).toBe(true);
  });

  test("searches left stay between 0 and the limit", () => {
    expect(searchesLeft(3, 10)).toBe(7);
    expect(searchesLeft(0, 10)).toBe(10);
    expect(searchesLeft(12, 10)).toBe(0);
    expect(searchesLeft(-1, 10)).toBe(10);
  });
});

describe("strings", () => {
  const KEYS: MessageKey[] = [
    "coachWeb.section",
    "coachWeb.label",
    "coachWeb.note",
    "coachWeb.left",
    "coachWeb.notSetUp",
    "coachSources.kind",
    "coachSources.title",
    "coachSources.newTab",
  ];

  test("every string has English and its own Hebrew", () => {
    for (const key of KEYS) {
      expect(MESSAGES.en[key].length).toBeGreaterThan(0);
      expect(MESSAGES.he[key].length).toBeGreaterThan(0);
      expect(MESSAGES.he[key]).not.toBe(MESSAGES.en[key]);
    }
  });

  test("the count takes the number left and the limit in both languages; the note names Mistral", () => {
    for (const lang of ["en", "he"] as const) {
      expect(MESSAGES[lang]["coachWeb.left"]).toContain("{n}");
      expect(MESSAGES[lang]["coachWeb.left"]).toContain("{limit}");
      expect(MESSAGES[lang]["coachWeb.note"]).toContain("Mistral");
    }
    expect(translate("en", "coachWeb.left").replace("{n}", "7").replace("{limit}", "10")).toBe("7 of 10 searches left today");
  });
});
