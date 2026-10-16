import { describe, expect, test } from "bun:test";
import { buildRecordingPage, extractActions, formatClock, safeClock, transcriptLines } from "./index";

describe("extractActions (English)", () => {
  const transcript = [
    "Thanks everyone for coming.",
    "Okay, so I'll send the deck to Dana by Friday.",
    "We need to book the room for the demo by Monday.",
    "Let's review the draft before Tuesday.",
    "TODO: fix the login bug",
    "The budget looked fine overall.",
    "Report goes out by end of week.",
    "we need to book the room for the demo by Monday",
    "Remember to water the plants.",
    "Don't forget to sign the form.",
  ].join("\n");

  test("finds commitments, keeps the source line, and drops the lead phrase", () => {
    const found = extractActions(transcript, "en");
    expect(found.map((s) => s.title)).toEqual([
      "Send the deck to Dana by Friday",
      "Book the room for the demo by Monday",
      "Review the draft before Tuesday",
      "Fix the login bug",
      "Report goes out by end of week",
      "Water the plants",
      "Sign the form",
    ]);
    expect(found[0]?.source).toBe("Okay, so I'll send the deck to Dana by Friday.");
    expect(found[0]?.line).toBe(1);
  });

  test("a lecture's we / you sentences are not tasks: at most one from a 7-sentence talk", () => {
    const lecture = [
      "Today we will look at how cells divide.",
      "We are going to start with mitosis.",
      "You have to remember that the cell copies its DNA first.",
      "You need to picture the chromosomes lining up in the middle.",
      "We should also compare it with meiosis.",
      "Let us look at the diagram on the next slide.",
      "Let's move on to the checkpoints.",
    ].join(" ");
    expect(transcriptLines(lecture)).toHaveLength(7);
    expect(extractActions(lecture, "en").length).toBeLessThanOrEqual(1);
  });

  test("we / you forms count when the same sentence has a deadline; I'll counts on its own", () => {
    const found = extractActions(
      [
        "You need to hand in the essay by Friday.",
        "We should finish chapter four before the 12th.",
        "You will read chapter five.",
        "I will email the slides.",
        "The war lasted until the 5th century.",
      ].join("\n"),
      "en",
    );
    expect(found.map((s) => s.title)).toEqual([
      "Hand in the essay by Friday",
      "Finish chapter four before the 12th",
      "Email the slides",
    ]);
  });

  test("plain talk gives nothing", () => {
    expect(extractActions("It was a good talk. The slides were clear.", "en")).toEqual([]);
    expect(extractActions("", "en")).toEqual([]);
  });

  test("long lines are cut to a short title and the list is capped", () => {
    const long = `I'll ${"write a very long and detailed plan ".repeat(10)}`;
    const [first] = extractActions(long, "en");
    expect((first?.title.length ?? 0) <= 121).toBe(true);
    const many = Array.from({ length: 30 }, (_, i) => `We need to do thing ${i} by Friday.`).join("\n");
    expect(extractActions(many, "en")).toHaveLength(20);
  });
});

describe("extractActions (Hebrew)", () => {
  test("צריך ל, אני אעשה, בואו, עד יום", () => {
    const transcript = [
      "תודה שבאתם.",
      "צריך לשלוח את המצגת לדנה עד יום ראשון.",
      "אני אעשה את הסיכום עד יום חמישי.",
      "בואו נקבע פגישה נוספת עד סוף השבוע.",
      "הדוח יוגש עד מחר",
      "היה דיון טוב.",
    ].join("\n");
    const found = extractActions(transcript, "he");
    expect(found.map((s) => s.title)).toEqual([
      "לשלוח את המצגת לדנה עד יום ראשון",
      "הסיכום עד יום חמישי",
      "נקבע פגישה נוספת עד סוף השבוע",
      "הדוח יוגש עד מחר",
    ]);
    expect(found[1]?.source).toBe("אני אעשה את הסיכום עד יום חמישי.");
  });

  test("a Hebrew lecture's we / you sentences without a deadline are not tasks", () => {
    const lecture = [
      "היום אנחנו נלמד על חלוקת תאים.",
      "צריך לזכור שהתא מעתיק את הדנ\"א קודם.",
      "בואו נסתכל על התרשים.",
      "אתם צריכים להבין את השלבים.",
      "כדאי להשוות את זה למיוזה.",
      "המלחמה נמשכה עד 1945.",
      "זה קרה לפני 200 שנה.",
      "לא לשכוח להביא מחשבון.",
    ].join("\n");
    const found = extractActions(lecture, "he");
    expect(found.map((s) => s.title)).toEqual(["להביא מחשבון"]);
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
