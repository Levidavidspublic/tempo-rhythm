import { describe, expect, test } from "bun:test";
import { parseTempoBlocks } from "@tempo/utils";
import {
  addDays,
  isIsoDate,
  localIsoDate,
  mondayOf,
  mondayOfWeekKey,
  periodPageDraft,
  weekKey,
  weekTokens,
} from "./period-pages";

describe("date math", () => {
  test("local date keeps the local calendar day", () => {
    expect(localIsoDate(new Date(2026, 9, 12, 23, 59))).toBe("2026-10-12");
  });

  test("real dates only", () => {
    expect(isIsoDate("2026-10-12")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-10-12T00:00")).toBe(false);
  });

  test("Monday of a week and the ISO week key, across year ends", () => {
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekKey("2026-10-14")).toBe("2026-W42");
    // 1 January 2027 is a Friday: it belongs to the last week of 2026.
    expect(weekKey("2027-01-01")).toBe("2026-W53");
    expect(weekKey("2024-12-30")).toBe("2025-W01");
  });

  test("week keys round-trip and nonexistent weeks are rejected", () => {
    expect(mondayOfWeekKey("2026-W42")).toBe("2026-10-12");
    expect(mondayOfWeekKey("2025-W01")).toBe("2024-12-30");
    expect(mondayOfWeekKey("2026-W53")).toBe("2026-12-28");
    expect(mondayOfWeekKey("2025-W53")).toBeNull();
    // Years 1-99 (which Date.UTC would read as 1901-1999) never throw; year 0 is rejected.
    for (const key of ["0001-W01", "0050-W26", "0099-W10"]) {
      expect(() => mondayOfWeekKey(key)).not.toThrow();
    }
    expect(mondayOfWeekKey("0000-W01")).toBeNull();
    // Week keys round-trip at both ends of the four-digit years, and never throw past them.
    for (const key of ["0099-W10", "0001-W02", "9999-W52", "2026-W01", "2020-W53"]) {
      const monday = mondayOfWeekKey(key);
      expect(monday).not.toBeNull();
      expect(weekKey(monday as string)).toBe(key);
    }
    expect(() => mondayOfWeekKey("9999-W53")).not.toThrow();
    expect(mondayOfWeekKey("9999-W53")).toBeNull();
    expect(isIsoDate("0099-03-02")).toBe(true);
    expect(addDays("0099-12-31", 1)).toBe("0100-01-01");
    expect(mondayOfWeekKey("2026-W00")).toBeNull();
    expect(mondayOfWeekKey("2026-42")).toBeNull();
  });
});

describe("periodPageDraft", () => {
  const template = "# Today\n\n## Intention\nFor {{weekday}} {{date}}: {{mood}}\n";
  /** The draft body after its leading page-meta fence (checked separately below). */
  const prose = (body: string) => {
    const [meta, ...rest] = parseTempoBlocks(body);
    expect(meta?.kind).toBe("valid");
    return rest.map((s) => s.source).join("");
  };

  test("daily: the title from the date, the top heading dropped, known tokens filled", () => {
    const draft = periodPageDraft("daily", "2026-10-12", template);
    expect(draft.title).toBe("Monday, 12 October");
    expect(prose(draft.body)).toBe("## Intention\nFor Monday 2026-10-12: {{mood}}\n");
  });

  test("the body opens with a valid page-meta block holding the page's type and date (NT-07)", () => {
    for (const [kind, iso] of [
      ["daily", "2026-10-12"],
      ["weekly", "2026-10-12"],
    ] as const) {
      const segments = parseTempoBlocks(periodPageDraft(kind, iso, template).body);
      const first = segments[0];
      expect(first?.kind).toBe("valid");
      if (first?.kind !== "valid") continue;
      expect(first.start).toBe(0);
      expect(first.block).toMatchObject({ type: "page-meta", v: 1, data: { pageType: kind, date: iso, tags: [] } });
      expect(segments.filter((s) => s.kind !== "markdown")).toHaveLength(1);
    }
  });

  test("the template's own page-meta and template blocks are not copied", () => {
    const own = [
      '```json tempo\n{"id":"blk_01JAAAAAAAAAAAAAAAAAAAAAAA","v":1,"type":"page-meta","data":{"pageType":"template","tags":["t"]}}\n```\n',
      '```json tempo\n{"id":"blk_01JBBBBBBBBBBBBBBBBBBBBBBB","v":1,"type":"template","data":{"name":"Day","forPageType":"daily","isDefault":true,"tokens":[],"origin":"user","status":"live","enabled":true}}\n```\n',
    ].join("");
    const draft = periodPageDraft("daily", "2026-10-12", `${own}# Today\n\n## Plan\n`);
    expect(prose(draft.body)).toBe("## Plan\n");
    const blocks = parseTempoBlocks(draft.body).filter((s) => s.kind !== "markdown");
    expect(blocks).toHaveLength(1);
  });

  test("Hebrew titles", () => {
    expect(periodPageDraft("daily", "2026-10-12", "", "he").title).toBe("יום שני, 12 באוקטובר");
    expect(periodPageDraft("weekly", "2026-10-12", "", "he").title).toBe("שבוע 42");
  });

  test("weekly tokens", () => {
    const tokens = weekTokens("2026-10-12");
    expect(tokens).toMatchObject({ date: "2026-10-12", week: "42", year: "2026", title: "Week 42" });
    expect(tokens.range).toContain("12");
    expect(tokens.range).toContain("18");
    expect(prose(periodPageDraft("weekly", "2026-10-12", "# This week\n\n{{range}}").body)).toBe(tokens.range);
  });

  test("a template without a top heading is kept whole", () => {
    expect(prose(periodPageDraft("daily", "2026-10-12", "## Plan\n- [ ] One").body)).toBe("## Plan\n- [ ] One");
  });
});
