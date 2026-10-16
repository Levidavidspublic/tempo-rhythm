/**
 * Review finding (re-plan, HIGH): the plan screen asked `calendar_events.listInRange` for today up
 * to the plan's date in one go. The server refuses ranges over 32 days, so a plan (or a later
 * date picked for it) more than a month away sent /study/plan to the error page. Busy time is now
 * read in windows of whole local days, each one the server accepts, across daylight-saving changes.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { addDays } from "../../../packages/core/plan/calendar-math";
import { PlanPreview } from "../../../apps/web/components/calendar/plan/PlanParts";
import { ReplanPreview } from "../../../apps/web/components/calendar/plan/ReplanPanel";
import { buildPreview, DEFAULT_FORM } from "../../../apps/web/components/calendar/plan/planForm";
import {
  BUSY_WINDOW_DAYS,
  busyWindows,
  MAX_BUSY_WINDOWS,
} from "../../../apps/web/components/calendar/plan/busyWindows";
import { localSlotToMs } from "../../../apps/web/components/calendar/gridData";

/** `calendar_events.listInRange` refuses anything longer (convex/calendar_events.ts). */
const SERVER_MAX_MS = 32 * 24 * 60 * 60 * 1000;
const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const localMidnight = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() === 0 && d.getMinutes() === 0;
};

describe("busyWindows", () => {
  test("a range within a month is one window, the whole range", () => {
    const span = busyWindows("2026-10-20", "2026-10-30");
    expect(span).toEqual({
      range: { startMs: localSlotToMs("2026-10-20", 0), endMs: localSlotToMs("2026-10-30", 0) },
      windows: [{ startMs: localSlotToMs("2026-10-20", 0), endMs: localSlotToMs("2026-10-30", 0) }],
      checkedUntil: null,
    });
  });

  test("a plan three months away: back-to-back windows of 31 days that cover it exactly", () => {
    const span = busyWindows("2026-10-20", "2027-01-28");
    if (!span) throw new Error("expected windows");
    // 100 days: 31 + 31 + 31 + 7.
    expect(span.windows.map((w) => Math.round((w.endMs - w.startMs) / 86_400_000))).toEqual([31, 31, 31, 7]);
    expect(span.windows[0]?.startMs).toBe(span.range.startMs);
    expect(span.windows.at(-1)?.endMs).toBe(span.range.endMs);
    span.windows.slice(1).forEach((w, i) => expect(w.startMs).toBe(span.windows[i]?.endMs as number));
    expect(span.checkedUntil).toBeNull();
    for (const w of span.windows) expect(w.endMs - w.startMs).toBeLessThanOrEqual(SERVER_MAX_MS);
  });

  test("far-off dates stop after six windows and say the last day that is checked", () => {
    const span = busyWindows("2026-10-20", "2027-10-20");
    if (!span) throw new Error("expected windows");
    expect(span.windows).toHaveLength(MAX_BUSY_WINDOWS);
    const covered = MAX_BUSY_WINDOWS * BUSY_WINDOW_DAYS;
    expect(span.windows.at(-1)?.endMs).toBe(localSlotToMs(addDays("2026-10-20", covered), 0));
    expect(span.checkedUntil).toBe(addDays("2026-10-20", covered - 1));
    // Tasks have no limit: the whole range is still read for them.
    expect(span.range.endMs).toBe(localSlotToMs("2027-10-20", 0));
    // Exactly six windows' worth is not capped.
    expect(busyWindows("2026-10-20", addDays("2026-10-20", covered))?.checkedUntil).toBeNull();
  });

  test("every window stays under the server's limit across daylight-saving changes, in local days", () => {
    for (const tz of ["Asia/Jerusalem", "America/Los_Angeles", "Europe/London", "Australia/Sydney", "UTC"]) {
      process.env.TZ = tz;
      // Israel and Europe leave summer time in late October, the US on 1 November; Sydney starts it
      // on 4 October; spring changes come in March and April.
      for (const [from, to] of [
        ["2026-10-01", "2027-04-30"],
        ["2027-02-20", "2027-05-10"],
      ] as const) {
        const span = busyWindows(from, to);
        if (!span) throw new Error("expected windows");
        for (const w of span.windows) {
          expect(w.endMs - w.startMs).toBeLessThanOrEqual(SERVER_MAX_MS);
          expect(w.endMs).toBeGreaterThan(w.startMs);
          expect(localMidnight(w.startMs) && localMidnight(w.endMs)).toBe(true);
        }
        span.windows.slice(1).forEach((w, i) => expect(w.startMs).toBe(span.windows[i]?.endMs as number));
      }
    }
  });

  test("the old single range for the same plan was over the limit (what the server refused)", () => {
    process.env.TZ = "Asia/Jerusalem";
    const from = "2026-10-20";
    const to = addDays(from, 60);
    expect(localSlotToMs(to, 0) - localSlotToMs(from, 0)).toBeGreaterThan(SERVER_MAX_MS);
    expect(busyWindows(from, to)?.windows.every((w) => w.endMs - w.startMs <= SERVER_MAX_MS)).toBe(true);
  });

  test("nothing to read when the date is today, past or unreadable", () => {
    expect(busyWindows("2026-10-20", "2026-10-20")).toBeNull();
    expect(busyWindows("2026-10-20", "2026-10-19")).toBeNull();
    expect(busyWindows("2026-10-20", "")).toBeNull();
    expect(busyWindows("2026-10-20", "30-10-2026")).toBeNull();
    expect(busyWindows("2026-10-20", "2026-10-21")?.windows).toHaveLength(1);
  });
});

describe("when events after a day aren't read, the screen says so in words", () => {
  test("the re-plan preview and the plan preview", () => {
    const replan = renderToStaticMarkup(
      createElement(ReplanPreview, {
        lang: "en" as const,
        result: { moves: [], unplaced: [] },
        titles: new Map(),
        deadline: "2027-10-20",
        checkedUntil: "2027-04-23",
        leaveOut: false,
        onLeaveOut: () => {},
        onAccept: () => {},
        onCancel: () => {},
      })
    );
    expect(replan).toMatch(/Events on your calendar are checked up to Friday,? 23 April\. Later ones aren(&#x27;|')t checked yet\./);

    const state = buildPreview(
      { ...DEFAULT_FORM, title: "Biology", deadline: "2027-10-20", topicsText: "Cells" },
      "2026-10-20",
      "he"
    );
    const plan = renderToStaticMarkup(createElement(PlanPreview, { lang: "he" as const, state, checkedUntil: "2027-04-23" }));
    expect(plan).toContain("האירועים ביומן נבדקים עד");
    // Not said when every event up to the date is read.
    expect(renderToStaticMarkup(createElement(PlanPreview, { lang: "en" as const, state }))).not.toContain("checked up to");
  });
});
