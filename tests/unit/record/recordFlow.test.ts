import { describe, expect, test } from "bun:test";
import {
  acceptedTasks,
  addPin,
  anyDecided,
  clockElapsed,
  clockPause,
  clockStart,
  editRow,
  IDLE_CLOCK,
  isPinKey,
  joinTranscript,
  parseMinutes,
  recordCopy,
  rowsFromProposal,
  setRowStatus,
} from "../../../apps/web/components/study/record/recordFlow";
import { en, he } from "../../../apps/web/lib/i18n-groups/record";

describe("record copy", () => {
  test("every English key has Hebrew, and the copy is kind (no em dash, emoji or shaming words)", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(he[key]?.trim().length ?? 0).toBeGreaterThan(0);
    }
    const all = [...Object.values(en), ...Object.values(he)].join(" ");
    expect(all.includes("—")).toBe(false);
    expect(/\p{Extended_Pictographic}/u.test(all)).toBe(false);
    for (const word of ["failed", "overdue", "streak", "must"]) expect(all.toLowerCase().includes(word)).toBe(false);
  });

  test("fills placeholders", () => {
    expect(recordCopy("en")("rec.minutesLeft", { n: 7 })).toBe("7 minutes of live words left today");
    expect(recordCopy("he")("rec.minutesLeft", { n: 7 })).toContain("7");
  });
});

describe("clock", () => {
  test("stops while paused and resumes from where it was", () => {
    let clock = clockStart(IDLE_CLOCK, 1_000);
    expect(clockElapsed(clock, 4_000)).toBe(3_000);
    clock = clockPause(clock, 4_000);
    expect(clockElapsed(clock, 60_000)).toBe(3_000);
    clock = clockStart(clock, 60_000);
    expect(clockElapsed(clock, 62_000)).toBe(5_000);
  });
});

describe("pins and keys", () => {
  test("P pins unless typing in a field or with a modifier", () => {
    expect(isPinKey({ key: "p", target: { tagName: "BODY" } })).toBe(true);
    expect(isPinKey({ key: "P", target: null })).toBe(true);
    expect(isPinKey({ key: "p", target: { tagName: "TEXTAREA" } })).toBe(false);
    expect(isPinKey({ key: "p", target: { tagName: "input" } })).toBe(false);
    expect(isPinKey({ key: "p", ctrlKey: true })).toBe(false);
    expect(isPinKey({ key: "o" })).toBe(false);
  });

  test("pins keep whole, non-negative times", () => {
    expect(addPin([], -5.5, "a")).toEqual([{ id: "a", atMs: 0, note: "" }]);
  });
});

describe("review rows", () => {
  test("only accepted rows with a title are saved; minutes only when valid", () => {
    let rows = rowsFromProposal([{ title: "Send the deck", minutes: 15 }, { title: "Book the room" }, { title: "Skip me" }]);
    expect(anyDecided(rows)).toBe(false);
    rows = setRowStatus(rows, "m0", "accepted");
    rows = setRowStatus(rows, "m1", "accepted");
    rows = setRowStatus(rows, "m2", "rejected");
    rows = editRow(rows, "m1", { title: "  Book the big room ", minutes: parseMinutes("x") });
    expect(anyDecided(rows)).toBe(true);
    expect(acceptedTasks(rows)).toEqual([{ title: "Send the deck", minutes: 15 }, { title: "Book the big room" }]);
    expect(parseMinutes("9000")).toBe(600);
    expect(parseMinutes("")).toBeNull();
  });

  test("the review transcript joins live lines and typed notes", () => {
    expect(joinTranscript(["One.", "Two."], "  typed  ")).toBe("One.\nTwo.\n\ntyped");
    expect(joinTranscript([], "")).toBe("");
  });
});
