/**
 * Kitchen T8 fix: the calendar keeps the last loaded results while the next month loads, so the
 * grid isn't replaced by a skeleton (which would drop keyboard focus) after the first load.
 */
import { describe, expect, test } from "bun:test";
import { lastLoaded } from "../../apps/web/lib/calendar/last-loaded";

describe("lastLoaded", () => {
  test("undefined only until the first result arrives", () => {
    expect(lastLoaded<number[]>(undefined, undefined, true)).toBeUndefined();
    expect(lastLoaded(undefined, [1], true)).toEqual([1]);
  });

  test("while the next month loads, the previous results stay on screen", () => {
    const october = [{ id: "a" }];
    // New args: useQuery gives undefined until the November results arrive.
    expect(lastLoaded(october, undefined, true)).toBe(october);
    const november = [{ id: "b" }];
    expect(lastLoaded(october, november, true)).toBe(november);
    // An empty month is a real result, not "still loading".
    expect(lastLoaded(october, [], true)).toEqual([]);
  });

  test("a skipped query (signed out) forgets what it had", () => {
    expect(lastLoaded([{ id: "a" }], undefined, false)).toBeUndefined();
  });
});
