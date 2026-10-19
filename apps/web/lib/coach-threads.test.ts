import { describe, expect, test } from "bun:test";
import {
  COACH_FOLLOW_UPS,
  COACH_STARTERS,
  coachThreads,
  dayDividerLabel,
  dayKeyOf,
  followUpTarget,
  groupSearchHits,
  isEmptyThread,
  matchSnippet,
  nextAfterDelete,
  previousDayKey,
  SEARCH_MAX_CHARS,
  searchQueryOf,
  threadDateLabel,
  threadTitle,
  withDayDividers,
} from "./coach-threads";
import { MESSAGES } from "./i18n";

const JERUSALEM = "Asia/Jerusalem";
const UTC = "UTC";
/** 19 Oct 2026, 09:30 in Jerusalem (UTC+3 until 25 Oct). */
const NOW = Date.UTC(2026, 9, 19, 6, 30);
const HOUR = 3_600_000;

describe("coachThreads", () => {
  const row = (id: string, updatedAt: number, extra: { chatMode?: "legacy" | "agent"; deletedAt?: number } = {}) => ({
    _id: id,
    title: "New Conversation",
    createdAt: 1,
    updatedAt,
    chatMode: extra.chatMode ?? ("legacy" as const),
    ...(extra.deletedAt === undefined ? {} : { deletedAt: extra.deletedAt }),
  });

  test("lists live legacy chats, newest activity first", () => {
    const list = coachThreads([row("a", 10), row("b", 30), row("c", 20, { chatMode: "agent" }), row("d", 40, { deletedAt: 41 }), row("e", 25)]);
    expect(list.map((r) => r._id)).toEqual(["b", "e", "a"]);
  });

  test("keeps the server's order for ties and handles a list that is still loading", () => {
    expect(coachThreads([row("x", 5), row("y", 5)]).map((r) => r._id)).toEqual(["x", "y"]);
    expect(coachThreads(undefined)).toEqual([]);
  });
});

describe("threadTitle", () => {
  test("the server's default title and empty titles show the fallback", () => {
    expect(threadTitle("New Conversation", "New chat")).toBe("New chat");
    expect(threadTitle("   ", "New chat")).toBe("New chat");
    expect(threadTitle(undefined, "New chat")).toBe("New chat");
  });
  test("a real title is shown on one line", () => {
    expect(threadTitle("Morning\n plan", "New chat")).toBe("Morning plan");
  });
});

describe("isEmptyThread", () => {
  test("a chat whose times still match holds no message", () => {
    expect(isEmptyThread({ createdAt: 100, updatedAt: 100 })).toBe(true);
    expect(isEmptyThread({ createdAt: 100, updatedAt: 101 })).toBe(false);
  });
});

describe("nextAfterDelete", () => {
  const threads = [{ _id: "c3" }, { _id: "c2" }, { _id: "c1" }];
  test("deleting another chat keeps the open one", () => {
    expect(nextAfterDelete(threads, "c2", "c1")).toBe("c1");
  });
  test("deleting the open chat opens the newest of the rest", () => {
    expect(nextAfterDelete(threads, "c3", "c3")).toBe("c2");
    expect(nextAfterDelete(threads, "c2", "c2")).toBe("c3");
  });
  test("deleting the last chat leaves nothing selected", () => {
    expect(nextAfterDelete([{ _id: "c1" }], "c1", "c1")).toBeNull();
    expect(nextAfterDelete([], "c1", null)).toBeNull();
  });
});

describe("searchQueryOf", () => {
  test("searches from 2 characters, trimmed", () => {
    expect(searchQueryOf("")).toBeNull();
    expect(searchQueryOf(" a ")).toBeNull();
    expect(searchQueryOf(" ab ")).toBe("ab");
    expect(searchQueryOf("two   words")).toBe("two words");
  });
  test("never sends more than the server reads", () => {
    expect(searchQueryOf("x".repeat(500))?.length).toBe(SEARCH_MAX_CHARS);
  });
});

describe("groupSearchHits", () => {
  const threads = [{ _id: "c3" }, { _id: "c2" }, { _id: "c1" }];
  test("one row per listed chat, in the column's order, with the newest match and no count", () => {
    const results = groupSearchHits(
      [
        { conversationId: "c1", messageId: "m1", content: "old", createdAt: 1 },
        { conversationId: "c3", messageId: "m2", content: "first", createdAt: 5 },
        { conversationId: "c3", messageId: "m3", content: "newer", createdAt: 9 },
        { conversationId: "gone", messageId: "m4", content: "deleted chat", createdAt: 7 },
      ],
      threads,
    );
    expect(results.map((r) => [r.conversationId, r.content])).toEqual([
      ["c3", "newer"],
      ["c1", "old"],
    ]);
    expect(results.every((r) => !("matches" in r))).toBe(true);
  });
  test("no hits, no rows", () => {
    expect(groupSearchHits(undefined, threads)).toEqual([]);
    expect(groupSearchHits([], threads)).toEqual([]);
  });
});

describe("matchSnippet", () => {
  test("shows the text around the match with cut marks", () => {
    const content = `${"a".repeat(80)} the needle is here ${"b".repeat(80)}`;
    const snippet = matchSnippet(content, "NEEDLE", 10);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("needle");
  });
  test("short text comes back whole, on one line", () => {
    expect(matchSnippet("Plan\nmy day", "my", 48)).toBe("Plan my day");
  });
  test("no match shows the start", () => {
    expect(matchSnippet("x".repeat(200), "zz", 10)).toBe(`${"x".repeat(20)}…`);
  });
});

describe("day keys", () => {
  test("a day is the viewer's calendar day, not UTC's", () => {
    // 22:30 UTC on the 18th is already the 19th in Jerusalem.
    const lateUtc = Date.UTC(2026, 9, 18, 22, 30);
    expect(dayKeyOf(lateUtc, UTC)).toBe("2026-10-18");
    expect(dayKeyOf(lateUtc, JERUSALEM)).toBe("2026-10-19");
  });
  test("the day before crosses months, years and leap days", () => {
    expect(previousDayKey("2026-10-01")).toBe("2026-09-30");
    expect(previousDayKey("2027-01-01")).toBe("2026-12-31");
    expect(previousDayKey("2028-03-01")).toBe("2028-02-29");
  });
});

describe("withDayDividers", () => {
  test("a divider before the first message of each day: Today, Yesterday, else a date", () => {
    const messages = [
      { _id: "m1", createdAt: NOW - 72 * HOUR },
      { _id: "m2", createdAt: NOW - 71 * HOUR },
      { _id: "m3", createdAt: NOW - 24 * HOUR },
      { _id: "m4", createdAt: NOW - HOUR },
      { _id: "m5", createdAt: NOW },
    ];
    const items = withDayDividers(messages, NOW, JERUSALEM);
    expect(items.map((item) => (item.type === "day" ? `day:${item.kind}:${item.key}` : item.message._id))).toEqual([
      "day:date:2026-10-16",
      "m1",
      "m2",
      "day:yesterday:2026-10-18",
      "m3",
      "day:today:2026-10-19",
      "m4",
      "m5",
    ]);
  });
  test("an empty thread has no dividers", () => {
    expect(withDayDividers([], NOW, JERUSALEM)).toEqual([]);
  });
});

describe("dayDividerLabel", () => {
  const labels = { today: "Today", yesterday: "Yesterday" };
  test("Today and Yesterday use the given words", () => {
    expect(dayDividerLabel({ kind: "today", at: NOW }, "en-GB", labels, NOW, JERUSALEM)).toBe("Today");
    expect(dayDividerLabel({ kind: "yesterday", at: NOW - 24 * HOUR }, "en-GB", labels, NOW, JERUSALEM)).toBe("Yesterday");
  });
  test("other days are a date in the viewer's language, with the year only when it differs", () => {
    const friday = NOW - 72 * HOUR;
    expect(dayDividerLabel({ kind: "date", at: friday }, "en-GB", labels, NOW, JERUSALEM)).toBe("Friday 16 October");
    const lastYear = Date.UTC(2025, 11, 31, 12);
    expect(dayDividerLabel({ kind: "date", at: lastYear }, "en-GB", labels, NOW, JERUSALEM)).toContain("2025");
    const hebrew = dayDividerLabel({ kind: "date", at: friday }, "he-IL", labels, NOW, JERUSALEM);
    expect(hebrew).toContain("16");
    expect(hebrew).toContain("אוקטובר");
  });
});

describe("threadDateLabel", () => {
  const labels = { yesterday: "Yesterday" };
  test("today shows the time, yesterday the word, this week the weekday, else the date", () => {
    expect(threadDateLabel(NOW - HOUR, NOW, "en-GB", labels, JERUSALEM)).toBe("08:30");
    expect(threadDateLabel(NOW - 24 * HOUR, NOW, "en-GB", labels, JERUSALEM)).toBe("Yesterday");
    expect(threadDateLabel(NOW - 72 * HOUR, NOW, "en-GB", labels, JERUSALEM)).toBe("Friday");
    expect(threadDateLabel(NOW - 10 * 24 * HOUR, NOW, "en-GB", labels, JERUSALEM)).toBe("9 Oct");
    expect(threadDateLabel(Date.UTC(2025, 5, 1, 12), NOW, "en-GB", labels, JERUSALEM)).toBe("1 Jun 2025");
  });
});

describe("followUpTarget", () => {
  const idle = { busy: false, crisisHold: false };
  const user = { _id: "u1", role: "user" as const };
  const reply = { _id: "a1", role: "assistant" as const, modelUsed: "mistral-small" };

  test("only the newest message, when it is a coach reply", () => {
    expect(followUpTarget([user, reply], idle)).toBe("a1");
    expect(followUpTarget([reply, { ...user, _id: "u2" }], idle)).toBeNull();
    expect(followUpTarget([], idle)).toBeNull();
    expect(followUpTarget(undefined, idle)).toBeNull();
  });
  test("hidden while a reply is on its way or the crisis resources show", () => {
    expect(followUpTarget([user, reply], { busy: true, crisisHold: false })).toBeNull();
    expect(followUpTarget([user, reply], { busy: false, crisisHold: true })).toBeNull();
  });
  test("never under a crisis card or a lookup answer", () => {
    expect(followUpTarget([user, { ...reply, modelUsed: "crisis-card" }], idle)).toBeNull();
    expect(followUpTarget([user, { ...reply, modelUsed: "executor-lookup" }], idle)).toBeNull();
  });
});

describe("starters and follow-ups", () => {
  test("four starters and three follow-ups, each with English and Hebrew text", () => {
    expect(COACH_STARTERS).toHaveLength(4);
    expect(COACH_FOLLOW_UPS).toHaveLength(3);
    for (const key of [...COACH_STARTERS.flatMap((s) => [s.label, s.hint]), ...COACH_FOLLOW_UPS]) {
      expect(MESSAGES.en[key].trim().length).toBeGreaterThan(0);
      expect(MESSAGES.he[key].trim().length).toBeGreaterThan(0);
      expect(MESSAGES.he[key]).not.toBe(MESSAGES.en[key]);
    }
  });
  test("the starters say what the owner asked for", () => {
    expect(COACH_STARTERS.map((s) => MESSAGES.en[s.label])).toEqual([
      "Plan my day",
      "Untangle my brain dump",
      "I can't get started",
      "Just vent",
    ]);
    expect(COACH_FOLLOW_UPS.map((key) => MESSAGES.en[key])).toEqual([
      "Break it into smaller steps",
      "What should I do first?",
      "Move this to tomorrow",
    ]);
  });
});
