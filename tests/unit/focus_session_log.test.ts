import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendSessionLogEntry,
  parseSessionLogEntries,
  serializeSessionLogEntries,
  sessionLogsToTrackingSessions,
} from "../../apps/mobile/lib/focus-session-log";
import type { SessionLogEntry } from "../../apps/mobile/lib/session-player";

const finished: SessionLogEntry = {
  id: "seed-morning-reset:5000",
  routineId: "seed-morning-reset",
  startedAt: 1000,
  completedAt: 5000,
  elapsedMs: 3000,
  stepCount: 3,
};

describe("focus session log leftover from #212", () => {
  test("empty or invalid storage stays empty", () => {
    expect(parseSessionLogEntries(null)).toEqual([]);
    expect(parseSessionLogEntries("")).toEqual([]);
    expect(parseSessionLogEntries("{")).toEqual([]);
    expect(parseSessionLogEntries("{\"oops\":true}")).toEqual([]);
  });

  test("round-trips a finished session and skips a duplicate id", () => {
    const stored = serializeSessionLogEntries([finished]);
    const loaded = parseSessionLogEntries(stored);
    expect(loaded).toEqual([finished]);
    expect(appendSessionLogEntry(loaded, finished)).toEqual([finished]);
  });

  test("maps elapsedMs onto tracking chart minutes without inventing a 25-minute block", () => {
    const [point] = sessionLogsToTrackingSessions([finished]);
    expect(point).toEqual({
      id: finished.id,
      loggedAt: 5000,
      focusMinutes: 3000 / 60_000,
    });
  });
});

describe("session log leftover wiring", () => {
  const root = join(import.meta.dir, "../..");

  test("player persists, tracking reads, today stays empty", () => {
    const player = readFileSync(
      join(root, "apps/mobile/components/session-player/SessionPlayer.tsx"),
      "utf8",
    );
    const tracking = readFileSync(
      join(root, "apps/mobile/app/(tempo)/tracking.tsx"),
      "utf8",
    );
    const today = readFileSync(
      join(root, "apps/mobile/app/(tempo)/(tabs)/today.tsx"),
      "utf8",
    );

    expect(player).toContain("sessionLogStorageKey");
    expect(player).toContain("appendSessionLogEntry");
    expect(tracking).toContain("sessionLogsToTrackingSessions");
    expect(tracking).toContain("sessionLogStorageKey");
    expect(tracking).not.toContain("sessions={[]}");
    // Today is the v3 screen now; the leftover must still not move onto it.
    expect(today).toContain("docs/design/v3/screens/mobile/today.html");
    expect(today).not.toContain("sessionLogStorageKey");
  });
});
