import { describe, expect, test } from "bun:test";
import { charsLeft, composerHeight, isNearBottom, messageTime } from "./coach-thread";

describe("coach thread rules", () => {
  test("the thread follows new messages only while the reader is at the bottom", () => {
    expect(isNearBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(isNearBottom({ scrollTop: 560, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 })).toBe(false);
    // A thread shorter than its box is always "at the bottom".
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 200, clientHeight: 400 })).toBe(true);
  });

  test("the counter shows only near the limit, and never below zero", () => {
    expect(charsLeft(10, 4000)).toBeNull();
    expect(charsLeft(3600, 4000)).toBeNull();
    expect(charsLeft(3601, 4000)).toBe(399);
    expect(charsLeft(4000, 4000)).toBe(0);
    expect(charsLeft(4100, 4000)).toBe(0);
  });

  test("the composer grows with its text between its smallest and largest height", () => {
    expect(composerHeight(20)).toBe(48);
    expect(composerHeight(96)).toBe(96);
    expect(composerHeight(900)).toBe(160);
  });

  test("a message time reads as hours and minutes in either language", () => {
    const ms = new Date(2026, 9, 16, 14, 5).getTime();
    expect(messageTime(ms, "en")).toBe("14:05");
    expect(messageTime(ms, "he")).toContain("14:05");
  });
});
