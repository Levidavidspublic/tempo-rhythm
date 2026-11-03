import { describe, expect, test } from "bun:test";
import { SEARCH_RESULT } from "./fakeExecutor.testkit";
import { LOOKUP_LIMITS, cleanAppName, lookupQuery, lookupReplyText, summarizeSearchResult } from "./lookup";

const text = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value) }] });

describe("reading Executor's search answer (shape UNKNOWN, read defensively)", () => {
  test("items with an app give app names and per-app counts", () => {
    expect(summarizeSearchResult(SEARCH_RESULT)).toEqual({
      apps: [
        { name: "Google Calendar", toolCount: 3 },
        { name: "Gmail", toolCount: 1 },
      ],
      total: 4,
    });
  });

  test("structured content is preferred; app may be a string or under another key", () => {
    expect(
      summarizeSearchResult({
        structuredContent: { results: [{ appName: "Slack" }, { integration: { title: "Slack" } }, { source: "Notion" }] },
        content: [{ type: "text", text: "ignored" }],
      }),
    ).toEqual({ apps: [{ name: "Slack", toolCount: 2 }, { name: "Notion", toolCount: 1 }], total: 3 });
  });

  test("an answer grouped by app is read as it is", () => {
    expect(
      summarizeSearchResult(text({ apps: [{ name: "Gmail", toolCount: 5 }, { name: "Drive", tools: [1, 2] }], total: 9 })),
    ).toEqual({ apps: [{ name: "Gmail", toolCount: 5 }, { name: "Drive", toolCount: 2 }], total: 9 });
  });

  test("items without an app give the total only; a stated total wins when larger", () => {
    expect(summarizeSearchResult(text([{ path: "a.b" }, { path: "c.d" }]))).toEqual({ apps: [], total: 2 });
    expect(summarizeSearchResult(text({ items: [{ path: "a" }], total: 12 }))).toEqual({ apps: [], total: 12 });
    expect(summarizeSearchResult(text({ totalCount: 3 }))).toEqual({ apps: [], total: 3 });
    expect(summarizeSearchResult(text({ items: [] }))).toEqual({ apps: [], total: 0 });
  });

  test("an answer Tempo cannot read gives null, not a guess", () => {
    expect(summarizeSearchResult({ content: [{ type: "text", text: "Here are some tools: a, b" }] })).toBeNull();
    expect(summarizeSearchResult({ content: [] })).toBeNull();
    expect(summarizeSearchResult({})).toBeNull();
    expect(summarizeSearchResult(text({ unexpected: true }))).toBeNull();
  });

  test("app names are cut to plain words, and at most 10 apps are kept", () => {
    expect(cleanAppName("  Google\nCalendar  ")).toBe("Google Calendar");
    // Markup and link syntax lose their brackets, angle brackets and colons.
    expect(cleanAppName("[click](https://evil.test) <b>x</b>")).toBe("click(https//evil.test) bx/b");
    expect(cleanAppName("יומן גוגל")).toBe("יומן גוגל");
    expect(cleanAppName("x".repeat(100))).toHaveLength(LOOKUP_LIMITS.appNameChars);
    const many = Array.from({ length: 15 }, (_, i) => ({ app: `App ${String(i).padStart(2, "0")}` }));
    const summary = summarizeSearchResult(text({ items: many }));
    expect(summary?.apps).toHaveLength(LOOKUP_LIMITS.maxApps);
    expect(summary?.total).toBe(15);
    // Nothing but names and counts is kept.
    expect(JSON.stringify(summarizeSearchResult(SEARCH_RESULT))).not.toContain("events.list");
  });
});

describe("the lookup query and the templated reply", () => {
  test("the query is one line, at most 200 characters", () => {
    expect(lookupQuery("  my\n calendar ")).toBe("my calendar");
    expect(lookupQuery("   ")).toBeNull();
    expect(lookupQuery(42)).toBeNull();
    expect(lookupQuery("a".repeat(300))).toHaveLength(LOOKUP_LIMITS.queryChars);
  });

  test("English: apps with counts, a total only, or nothing found", () => {
    expect(
      lookupReplyText({ apps: [{ name: "Google Calendar", toolCount: 3 }, { name: "Gmail", toolCount: 1 }], total: 4 }, "en"),
    ).toBe("Through Executor I can reach Google Calendar (3 tools) and Gmail (1 tool). I'll ask before I use any of them.");
    expect(
      lookupReplyText(
        { apps: [{ name: "A", toolCount: 2 }, { name: "B", toolCount: 2 }, { name: "C", toolCount: 1 }], total: 5 },
        "en",
      ),
    ).toBe("Through Executor I can reach A (2 tools), B (2 tools) and C (1 tool). I'll ask before I use any of them.");
    expect(lookupReplyText({ apps: [], total: 1 }, "en")).toBe(
      "Executor found 1 matching tool. I'll ask before I use any of them.",
    );
    expect(lookupReplyText({ apps: [], total: 0 }, "en")).toContain("didn't find anything");
  });

  test("Hebrew has its own wording", () => {
    expect(lookupReplyText({ apps: [{ name: "Gmail", toolCount: 1 }, { name: "Drive", toolCount: 4 }], total: 5 }, "he")).toBe(
      "דרך Executor יש לי גישה אל Gmail (כלי אחד) ו-Drive (4 כלים). אבקש אישור לפני כל שימוש בהם.",
    );
    expect(lookupReplyText({ apps: [], total: 3 }, "he")).toBe("Executor מצא 3 כלים מתאימים. אבקש אישור לפני כל שימוש בהם.");
    expect(lookupReplyText({ apps: [], total: 0 }, "he")).toContain("לא מצא");
  });
});
