import { describe, expect, test } from "bun:test";
import { buildRecordingPage, extractActions, formatClock, safeClock, transcriptLines } from "./index";

describe("extractActions (English)", () => {
  const transcript = [
    "Thanks everyone for coming.",
    "Okay, so I'll send the deck to Dana by Friday.",
    "We need to book the room for the demo.",
    "Let's review the draft on Tuesday.",
    "TODO: fix the login bug",
    "The budget looked fine overall.",
    "Report goes out by end of week.",
    "we need to book the room for the demo",
  ].join("\n");

  test("finds commitments, keeps the source line, and drops the lead phrase", () => {
    const found = extractActions(transcript, "en");
    expect(found.map((s) => s.title)).toEqual([
      "Send the deck to Dana by Friday",
      "Book the room for the demo",
      "Review the draft on Tuesday",
      "Fix the login bug",
      "Report goes out by end of week",
    ]);
    expect(found[0]?.source).toBe("Okay, so I'll send the deck to Dana by Friday.");
    expect(found[0]?.line).toBe(1);
  });

  test("plain talk gives nothing", () => {
    expect(extractActions("It was a good talk. The slides were clear.", "en")).toEqual([]);
    expect(extractActions("", "en")).toEqual([]);
  });

  test("long lines are cut to a short title and the list is capped", () => {
    const long = `I'll ${"write a very long and detailed plan ".repeat(10)}`;
    const [first] = extractActions(long, "en");
    expect((first?.title.length ?? 0) <= 121).toBe(true);
    const many = Array.from({ length: 30 }, (_, i) => `We need to do thing ${i}.`).join("\n");
    expect(extractActions(many, "en")).toHaveLength(20);
  });
});

describe("extractActions (Hebrew)", () => {
  test("צריך ל, אני אעשה, בואו, עד יום", () => {
    const transcript = [
      "תודה שבאתם.",
      "צריך לשלוח את המצגת לדנה.",
      "אני אעשה את הסיכום עד יום חמישי.",
      "בואו נקבע פגישה נוספת.",
      "הדוח יוגש עד מחר",
      "היה דיון טוב.",
    ].join("\n");
    const found = extractActions(transcript, "he");
    expect(found.map((s) => s.title)).toEqual(["לשלוח את המצגת לדנה", "הסיכום עד יום חמישי", "נקבע פגישה נוספת", "הדוח יוגש עד מחר"]);
    expect(found[1]?.source).toBe("אני אעשה את הסיכום עד יום חמישי.");
  });
});

describe("transcriptLines", () => {
  test("splits lines and sentences, drops list marks and time stamps", () => {
    expect(transcriptLines("- One. Two?\n\n[01:02] Three")).toEqual(["One.", "Two?", "Three"]);
  });
});

describe("buildRecordingPage", () => {
  test("header, pins with isolated mm:ss times, transcript under its heading", () => {
    const body = buildRecordingPage({
      title: "Standup",
      startedAt: Date.UTC(2026, 9, 16, 9, 30),
      transcript: "We met. I'll send the deck.",
      pins: [
        { atMs: 125_000, note: "Deck owner" },
        { atMs: 5_000 },
      ],
      lang: "en",
      timeZone: "UTC",
      summary: "A short standup.",
    });
    expect(body).toContain("Recorded ⁦16 Oct 2026, 09:30⁩. Audio was not stored.");
    expect(body).toContain("## Summary\n\nA short standup.");
    expect(body).toContain("## Pinned moments\n\n- ⁦00:05⁩ Pinned\n- ⁦02:05⁩ Deck owner");
    expect(body).toContain("## Transcript\n\nWe met. I'll send the deck.");
    expect(body.indexOf("Pinned moments")).toBeLessThan(body.indexOf("## Transcript"));
  });

  test("Hebrew headings, no pins section without pins, an empty transcript says so", () => {
    const body = buildRecordingPage({ title: "x", startedAt: 0, transcript: "  ", pins: [], lang: "he", timeZone: "UTC" });
    expect(body).toContain("## תמלול\n\nלא נקלטו מילים.");
    expect(body).not.toContain("רגעים מסומנים");
  });

  test("a pin note can't start a Markdown block", () => {
    const body = buildRecordingPage({ title: "x", startedAt: 0, transcript: "t", pins: [{ atMs: 0, note: "# not a heading\nsecond" }], lang: "en", timeZone: "UTC" });
    expect(body).toContain("\\# not a heading second");
  });

  test("clock format", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(61_999)).toBe("01:01");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("00:00");
    expect(safeClock(1000)).toBe("⁦00:01⁩");
  });
});
