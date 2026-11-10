import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MESSAGES, type MessageKey } from "./i18n";
import {
  buildTrackingDashboard,
  completeTrackingSession,
  formatBlockCount,
  formatSessionMinutes,
  formatTrackingDay,
  parseTrackingLogs,
  type TrackingSessionLog,
  trackingLogsStorageKey,
} from "./trackingDashboard";

describe("tracking dashboard data contract", () => {
  test("completing sessions creates real logs, increments streaks, and charts from those logs", () => {
    const first = completeTrackingSession([], {
      completedAt: Date.UTC(2026, 6, 14, 9),
      durationMinutes: 25,
      intention: "settle into the first focus block",
    });
    const second = completeTrackingSession(first.logs, {
      completedAt: Date.UTC(2026, 6, 15, 10),
      durationMinutes: 30,
      intention: "continue the routine gently",
    });

    const dashboard = buildTrackingDashboard(second.logs);

    expect(second.createdLog.intention).toBe("continue the routine gently");
    expect(second.streakCount).toBe(2);
    expect(dashboard.enso.value).toBe(2);
    expect(dashboard.enso.label).toBe("2-day streak");
    expect(dashboard.chart.dataSource).toBe("session-logs");
    expect(dashboard.chart.points).toEqual([
      { day: "2026-07-14", sessions: 1, minutes: 25 },
      { day: "2026-07-15", sessions: 1, minutes: 30 },
    ]);
  });

  test("dashboard refuses placeholder or mock-only chart data", () => {
    const logs: TrackingSessionLog[] = [];
    const dashboard = buildTrackingDashboard(logs);

    expect(dashboard.chart.dataSource).toBe("session-logs");
    expect(dashboard.chart.points).toEqual([]);
    expect(dashboard.chart.placeholderDetected).toBe(false);
  });

  test("same-day sessions stack minutes without breaking the streak", () => {
    const first = completeTrackingSession([], {
      completedAt: Date.UTC(2026, 6, 14, 9),
      durationMinutes: 15,
      intention: "first block",
    });
    const second = completeTrackingSession(first.logs, {
      completedAt: Date.UTC(2026, 6, 14, 16),
      durationMinutes: 20,
      intention: "second block",
    });

    const dashboard = buildTrackingDashboard(second.logs);
    expect(second.streakCount).toBe(1);
    expect(dashboard.chart.points).toEqual([{ day: "2026-07-14", sessions: 2, minutes: 35 }]);
  });

  test("formats session minutes without shame", () => {
    expect(formatSessionMinutes(1)).toBe("1 minute");
    expect(formatSessionMinutes(25)).toBe("25 minutes");
  });
});

describe("tracking copy follows the page language", () => {
  test("English minutes and block counts read as before", () => {
    expect(formatSessionMinutes(1, "en")).toBe("1 minute");
    expect(formatSessionMinutes(0, "en")).toBe("0 minutes");
    expect(formatSessionMinutes(45, "en")).toBe("45 minutes");
    expect(formatBlockCount(1, "en")).toBe("1 block");
    expect(formatBlockCount(0, "en")).toBe("0 blocks");
    expect(formatBlockCount(3, "en")).toBe("3 blocks");
    expect(formatBlockCount(3)).toBe("3 blocks");
  });

  test("Hebrew minutes: one is spelled out, the rest are digits with the plural", () => {
    expect(formatSessionMinutes(1, "he")).toBe("דקה אחת");
    expect(formatSessionMinutes(2, "he")).toBe("2 דקות");
    expect(formatSessionMinutes(5, "he")).toBe("5 דקות");
    expect(formatSessionMinutes(60, "he")).toBe("60 דקות");
    expect(formatSessionMinutes(0, "he")).toBe("0 דקות");
  });

  test("Hebrew block counts", () => {
    expect(formatBlockCount(1, "he")).toBe("בלוק אחד");
    expect(formatBlockCount(2, "he")).toBe("2 בלוקים");
    expect(formatBlockCount(0, "he")).toBe("0 בלוקים");
  });

  test("day labels are words in the page language, not YYYY-MM-DD", () => {
    // ICU builds differ on the comma after the English weekday ("Fri 16 Oct" / "Fri, 16 Oct").
    expect(formatTrackingDay("2026-10-16", "en")).toMatch(/^Fri,? 16 Oct$/);
    expect(formatTrackingDay("2026-11-01", "en")).toMatch(/^Sun,? 1 Nov$/);
    expect(formatTrackingDay("2026-10-16")).toMatch(/^Fri,? 16 Oct$/);
    expect(formatTrackingDay("2026-10-16", "he")).toBe("יום ו׳, 16 באוק׳");
    expect(formatTrackingDay("2026-11-01", "he")).toBe("יום א׳, 1 בנוב׳");
  });

  test("an unreadable day key is shown as written", () => {
    expect(formatTrackingDay("someday", "en")).toBe("someday");
    expect(formatTrackingDay("", "he")).toBe("");
  });

  test("every track. key has English and Hebrew copy, and the Hebrew is not English", () => {
    const keys = (Object.keys(MESSAGES.en) as MessageKey[]).filter((key) => key.startsWith("track."));
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      expect(MESSAGES.en[key].trim().length).toBeGreaterThan(0);
      expect(MESSAGES.he[key]?.trim().length ?? 0).toBeGreaterThan(0);
      expect(MESSAGES.he[key]).not.toBe(MESSAGES.en[key]);
      expect(MESSAGES.he[key]).toMatch(/[֐-׿]/);
    }
  });
});

describe("parseTrackingLogs", () => {
  test("keeps valid rows and drops corrupt storage", () => {
    expect(trackingLogsStorageKey("user-1")).toBe("tempo.tracking.logs:v1:user-1");
    expect(parseTrackingLogs(null)).toEqual([]);
    expect(parseTrackingLogs("{")).toEqual([]);
    expect(parseTrackingLogs('{"id":"x"}')).toEqual([]);
    expect(
      parseTrackingLogs(
        JSON.stringify([
          { id: "a", completedAt: 10, durationMinutes: 25, intention: "read" },
          { id: 1, completedAt: 10, durationMinutes: 25, intention: "nope" },
        ])
      )
    ).toEqual([{ id: "a", completedAt: 10, durationMinutes: 25, intention: "read" }]);
  });
});

describe("TrackingDashboard leftover wiring", () => {
  test("uses landed streaks.getCurrent and the session-log helper", () => {
    const source = readFileSync(
      join(import.meta.dir, "../components/tracking/TrackingDashboard.tsx"),
      "utf8"
    );
    expect(source).toContain("api.streaks.getCurrent");
    expect(source).toContain("completeTrackingSession");
    expect(source).toContain("buildTrackingDashboard");
    expect(source).toContain("parseTrackingLogs");
    expect(source).toContain("localStorage");
    expect(source).not.toContain("convex.query");
    expect(source).not.toContain("NEXT_PUBLIC_TRACKING");
  });

  test("reads every word from i18n and leaves the one main landmark to the app shell", () => {
    const source = readFileSync(
      join(import.meta.dir, "../components/tracking/TrackingDashboard.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/<main[\s>]/);
    for (const english of [
      "Session tracking",
      "Habit streak",
      "Focus blocks today",
      "Log this block",
      "No focus blocks logged yet.",
      "Focus block removed.",
      "That block did not save.",
    ]) {
      expect(source).not.toContain(english);
    }
    const used = Array.from(source.matchAll(/"(track\.[\w.]+)"/g), (match) => match[1] as string);
    expect(used.length).toBeGreaterThan(20);
    for (const key of used) {
      expect(key in MESSAGES.en).toBe(true);
      expect(key in MESSAGES.he).toBe(true);
    }
  });
});
