import { describe, expect, test } from "bun:test";
import {
  type BusySpan,
  type ReplanInput,
  type ReplanSession,
  replanRest,
  replanWaysOut,
} from "./replan";

const clock = (text: string) => {
  const [h, m] = text.split(":").map(Number);
  return h! * 60 + m!;
};

const session = (
  id: string,
  date: string,
  start: string,
  minutes = 45,
  status: ReplanSession["status"] = "todo"
): ReplanSession => ({ id, date, startMinute: clock(start), minutes, status });

const busy = (date: string, start: string, durationMinutes = 60): BusySpan => ({
  date,
  startMinute: clock(start),
  durationMinutes,
});

/** Tuesday 20 Oct 2026, 18:00; the exam is on Friday 30 Oct. */
const input = (over: Partial<ReplanInput> = {}): ReplanInput => ({
  sessions: [],
  now: { date: "2026-10-20", minute: clock("18:00") },
  deadline: "2026-10-30",
  busy: [],
  window: { startMinute: clock("07:00"), endMinute: clock("22:00") },
  ...over,
});

const slots = (result: ReturnType<typeof replanRest>) =>
  result.moves.map((m) => [m.id, m.to.date, m.to.startMinute]);

describe("replanRest: which sessions move", () => {
  test("nothing to do when every session is still ahead and clear", () => {
    const result = replanRest(
      input({
        sessions: [session("a", "2026-10-21", "17:00"), session("b", "2026-10-22", "17:00")],
      })
    );
    expect(result).toEqual({ moves: [], unplaced: [], missed: 0, clashing: 0 });
  });

  test("done and in-progress sessions stay, even in the past; only ones still to do move", () => {
    const result = replanRest(
      input({
        sessions: [
          session("done", "2026-10-19", "17:00", 45, "done"),
          session("doing", "2026-10-20", "17:30", 45, "doing"),
          session("todo", "2026-10-19", "17:45"),
        ],
      })
    );
    expect(result.missed).toBe(1);
    expect(result.moves.map((m) => m.id)).toEqual(["todo"]);
    expect(result.moves[0]?.reason).toBe("missed");
  });

  test("a session that now overlaps busy time moves; touching ends don't count", () => {
    const result = replanRest(
      input({
        sessions: [
          session("clash", "2026-10-22", "17:00"),
          session("touch", "2026-10-23", "17:00"),
        ],
        busy: [busy("2026-10-22", "17:30"), busy("2026-10-23", "16:00")],
      })
    );
    expect(result).toMatchObject({ missed: 0, clashing: 1, unplaced: [] });
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0]).toMatchObject({
      id: "clash",
      reason: "clash",
      from: { date: "2026-10-22", startMinute: clock("17:00") },
    });
  });

  test("a session counts as missed only once it has ended; one under way stays where it is", () => {
    const during = replanRest(
      input({
        sessions: [session("a", "2026-10-20", "17:30")],
        now: { date: "2026-10-20", minute: clock("17:40") },
      })
    );
    expect(during).toEqual({ moves: [], unplaced: [], missed: 0, clashing: 0 });
    const ended = replanRest(
      input({
        sessions: [session("a", "2026-10-20", "17:30")],
        now: { date: "2026-10-20", minute: clock("18:15") },
      })
    );
    expect(ended.missed).toBe(1);
    expect(ended.moves.map((m) => m.id)).toEqual(["a"]);
  });

  test("a session under way that overlaps busy time isn't moved mid-session, and keeps its time", () => {
    const result = replanRest(
      input({
        sessions: [session("now", "2026-10-20", "17:30"), session("old", "2026-10-19", "17:45")],
        now: { date: "2026-10-20", minute: clock("17:40") },
        busy: [busy("2026-10-20", "18:00", 60)],
      })
    );
    expect(result).toMatchObject({ missed: 1, clashing: 0 });
    // The missed one can't start at 17:45 (the session under way runs to 18:15, then busy to 19:00).
    expect(slots(result)).toEqual([["old", "2026-10-20", clock("19:00")]]);
  });
});

describe("replanRest: where they go", () => {
  test("the next free start near its own time, today when today still has one", () => {
    // 18:00 now; the session was at 17:00 yesterday. 18:00 today is within 2 h of 17:00.
    const result = replanRest(input({ sessions: [session("a", "2026-10-19", "17:00")] }));
    expect(slots(result)).toEqual([["a", "2026-10-20", clock("18:00")]]);
  });

  test("keeps its time of day on a later day rather than a far-off hour today", () => {
    const result = replanRest(
      input({
        sessions: [session("a", "2026-10-19", "17:00")],
        now: { date: "2026-10-20", minute: clock("20:00") },
      })
    );
    expect(slots(result)).toEqual([["a", "2026-10-21", clock("17:00")]]);
  });

  test("busy time and the sessions that stay are worked around, nearest to its own time", () => {
    const result = replanRest(
      input({
        sessions: [session("a", "2026-10-19", "17:00"), session("stay", "2026-10-21", "17:45")],
        now: { date: "2026-10-20", minute: clock("21:00") },
        busy: [busy("2026-10-21", "16:30", 60)],
      })
    );
    // 16:30–17:30 is busy and 17:45–18:30 is the other session: 17:00 can't hold 45 minutes, so
    // the nearest free start is 15:45 (75 away), ahead of 18:30 (90 away).
    expect(slots(result)).toEqual([["a", "2026-10-21", clock("15:45")]]);
  });

  test("two moved sessions never share a slot", () => {
    const result = replanRest(
      input({
        sessions: [session("a", "2026-10-19", "17:00"), session("b", "2026-10-19", "17:45")],
        now: { date: "2026-10-20", minute: clock("21:30") },
      })
    );
    expect(slots(result)).toEqual([
      ["a", "2026-10-21", clock("17:00")],
      ["b", "2026-10-21", clock("17:45")],
    ]);
  });

  test("minutesPerDay caps a day's plan time, the sessions that stay included", () => {
    const result = replanRest(
      input({
        sessions: [
          session("a", "2026-10-19", "17:00"),
          session("b", "2026-10-19", "17:45"),
          session("stay", "2026-10-22", "17:00"),
        ],
        now: { date: "2026-10-20", minute: clock("21:30") },
        minutesPerDay: 90,
      })
    );
    // The 21st takes both (90 min); the 22nd already has 45, so nothing more goes there.
    expect(slots(result)).toEqual([
      ["a", "2026-10-21", clock("17:00")],
      ["b", "2026-10-21", clock("17:45")],
    ]);
    const tighter = replanRest(
      input({
        sessions: [session("a", "2026-10-19", "17:00"), session("b", "2026-10-19", "17:45")],
        now: { date: "2026-10-20", minute: clock("21:30") },
        minutesPerDay: 45,
      })
    );
    expect(slots(tighter)).toEqual([
      ["a", "2026-10-21", clock("17:00")],
      ["b", "2026-10-22", clock("17:45")],
    ]);
  });

  test("never on or after the deadline: what doesn't fit comes back unplaced", () => {
    const result = replanRest(
      input({
        sessions: [session("a", "2026-10-19", "17:00"), session("b", "2026-10-19", "17:45")],
        // 21:30 on the last day: no 45 minutes left before the window closes at 22:00.
        now: { date: "2026-10-29", minute: clock("21:30") },
      })
    );
    expect(result.moves).toEqual([]);
    expect(result.unplaced.map((u) => [u.id, u.reason, u.minutes])).toEqual([
      ["a", "missed", 45],
      ["b", "missed", 45],
    ]);
    // The day before the deadline is the last one used.
    const lastDay = replanRest(
      input({
        sessions: [session("a", "2026-10-19", "17:00")],
        now: { date: "2026-10-29", minute: clock("08:00") },
      })
    );
    expect(slots(lastDay)).toEqual([["a", "2026-10-29", clock("17:00")]]);
  });

  test("never past midnight, and never before now on today", () => {
    const result = replanRest(
      input({
        sessions: [session("late", "2026-10-19", "23:30", 60)],
        now: { date: "2026-10-20", minute: clock("22:10") },
        window: { startMinute: clock("07:00"), endMinute: 1440 },
        deadline: "2026-10-21",
      })
    );
    // 23:30 + 60 would run into the 21st, so the latest start is 23:00; 22:15 is the first after now.
    expect(slots(result)).toEqual([["late", "2026-10-20", clock("23:00")]]);
    for (const move of result.moves) {
      expect(move.to.startMinute + move.minutes).toBeLessThanOrEqual(1440);
    }
  });

  test("busy time across midnight blocks the early hours of the next day", () => {
    const result = replanRest(
      input({
        sessions: [session("a", "2026-10-19", "00:30", 30)],
        now: { date: "2026-10-20", minute: clock("23:50") },
        window: { startMinute: 0, endMinute: 1440 },
        busy: [busy("2026-10-20", "23:30", 120)],
      })
    );
    expect(slots(result)).toEqual([["a", "2026-10-21", clock("01:30")]]);
  });

  test("each session keeps its local clock time across a daylight-saving change", () => {
    // Israel leaves summer time on Sunday 25 Oct 2026. The plan works in local clock minutes, so
    // the 17:00 session stays at 17:00 on the other side; the browser makes the Unix ms per date.
    const result = replanRest(
      input({
        sessions: [session("a", "2026-10-24", "17:00")],
        now: { date: "2026-10-24", minute: clock("20:30") },
      })
    );
    expect(slots(result)).toEqual([["a", "2026-10-25", clock("17:00")]]);
  });

  test("deterministic: the same input gives the same plan and isn't changed", () => {
    const sessions = [session("b", "2026-10-19", "17:00"), session("a", "2026-10-19", "17:00")];
    const frozen = JSON.stringify(sessions);
    const first = replanRest(
      input({ sessions, now: { date: "2026-10-20", minute: clock("21:00") } })
    );
    const second = replanRest(
      input({ sessions, now: { date: "2026-10-20", minute: clock("21:00") } })
    );
    expect(second).toEqual(first);
    expect(JSON.stringify(sessions)).toBe(frozen);
    // Same start: ids break the tie.
    expect(first.moves.map((m) => m.id)).toEqual(["a", "b"]);
  });

  test("a day window or deadline that makes no sense is refused", () => {
    expect(() => replanRest(input({ window: { startMinute: 600, endMinute: 1500 } }))).toThrow(
      RangeError
    );
    expect(() => replanRest(input({ window: { startMinute: 600, endMinute: 600 } }))).toThrow(
      RangeError
    );
    expect(() => replanRest(input({ deadline: "30-10-2026" }))).toThrow(RangeError);
    expect(() => replanRest(input({ minutesPerDay: 0 }))).toThrow(RangeError);
  });
});

describe("replanWaysOut", () => {
  const short = input({
    sessions: [
      session("a", "2026-10-19", "17:00"),
      session("b", "2026-10-19", "17:45"),
      session("c", "2026-10-20", "17:00"),
      session("stay1", "2026-10-21", "17:00", 90),
      session("stay2", "2026-10-22", "17:00", 90),
    ],
    now: { date: "2026-10-20", minute: clock("21:30") },
    deadline: "2026-10-23",
    minutesPerDay: 90,
  });

  test("longer days and a later date that would hold every session", () => {
    expect(replanRest(short).unplaced.map((u) => u.id)).toEqual(["a", "b", "c"]);
    const ways = replanWaysOut(short);
    // 3 × 45 more over two days: 165 is not enough for the second day's 90 + 45 + 45 = 180.
    expect(ways.longerMinutes).toBe(180);
    expect(replanRest({ ...short, minutesPerDay: 180 }).unplaced).toEqual([]);
    expect(replanRest({ ...short, minutesPerDay: 165 }).unplaced).not.toEqual([]);
    // 3 more sessions need 2 more days at 90 a day (the 23rd and 24th; the 25th is the new deadline).
    expect(ways.laterDate).toBe("2026-10-25");
    expect(replanRest({ ...short, deadline: "2026-10-25" }).unplaced).toEqual([]);
    expect(replanRest({ ...short, deadline: "2026-10-24" }).unplaced).not.toEqual([]);
  });

  test("nothing to offer when everything fits, and no longer days without a cap", () => {
    expect(replanWaysOut(input({ sessions: [session("a", "2026-10-19", "17:00")] }))).toEqual({
      longerMinutes: null,
      laterDate: null,
    });
    const uncapped = replanWaysOut({
      ...short,
      minutesPerDay: undefined,
      window: { startMinute: clock("17:00"), endMinute: clock("17:45") },
    });
    expect(uncapped.longerMinutes).toBeNull();
    expect(uncapped.laterDate).toBe("2026-10-26");
  });

  test("limits: no day longer than allowed, no date further than allowed", () => {
    const ways = replanWaysOut(short, { maxMinutesPerDay: 120, maxDays: 1 });
    expect(ways).toEqual({ longerMinutes: null, laterDate: null });
  });
});
