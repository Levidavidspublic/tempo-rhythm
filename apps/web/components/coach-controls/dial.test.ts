import { describe, expect, test } from "bun:test";
import {
  clampDial,
  dialLabel,
  panicMinutesLeft,
  releaseDial,
  settleDialSave,
  type DialFlight,
} from "./dial";

const idle: DialFlight = { inFlight: null, pending: null };

describe("clampDial", () => {
  test("keeps integers from 0 to 10", () => {
    expect(clampDial(0)).toBe(0);
    expect(clampDial(5)).toBe(5);
    expect(clampDial(10)).toBe(10);
  });

  test("rounds to the nearest integer and clamps the ends", () => {
    expect(clampDial(2.4)).toBe(2);
    expect(clampDial(2.5)).toBe(3);
    expect(clampDial(-1)).toBe(0);
    expect(clampDial(-0.4)).toBe(0);
    expect(clampDial(11)).toBe(10);
    expect(clampDial(10.6)).toBe(10);
  });

  test("NaN and non-finite values become 5", () => {
    expect(clampDial(Number.NaN)).toBe(5);
    expect(clampDial(Number.POSITIVE_INFINITY)).toBe(5);
    expect(clampDial(Number.NEGATIVE_INFINITY)).toBe(5);
  });
});

describe("dialLabel", () => {
  test("names the three bands", () => {
    expect(dialLabel(0)).toBe("Gentle");
    expect(dialLabel(3)).toBe("Gentle");
    expect(dialLabel(4)).toBe("Steady");
    expect(dialLabel(6)).toBe("Steady");
    expect(dialLabel(7)).toBe("Firm");
    expect(dialLabel(10)).toBe("Firm");
  });

  test("labels the clamped value", () => {
    expect(dialLabel(Number.NaN)).toBe("Steady");
    expect(dialLabel(-4)).toBe("Gentle");
    expect(dialLabel(99)).toBe("Firm");
  });
});

describe("panicMinutesLeft", () => {
  const now = 1_700_000_000_000;

  test("is zero when there is no active panic", () => {
    expect(panicMinutesLeft(null, now)).toBe(0);
    expect(panicMinutesLeft(now, now)).toBe(0);
    expect(panicMinutesLeft(now - 1, now)).toBe(0);
    expect(panicMinutesLeft(Number.NaN, now)).toBe(0);
  });

  test("rounds partial minutes up and never goes negative", () => {
    expect(panicMinutesLeft(now + 1, now)).toBe(1);
    expect(panicMinutesLeft(now + 60_000, now)).toBe(1);
    expect(panicMinutesLeft(now + 60_001, now)).toBe(2);
    expect(panicMinutesLeft(now + 30 * 60_000, now)).toBe(30);
    expect(panicMinutesLeft(now - 90_000, now)).toBe(0);
  });
});

describe("releaseDial", () => {
  test("starts a save when the released value differs", () => {
    const result = releaseDial(idle, 8, 3);
    expect(result.release).toEqual({ action: "save", value: 8 });
    expect(result.flight).toEqual({ inFlight: 8, pending: null });
  });

  test("ignores a release that matches the saved dial", () => {
    const result = releaseDial(idle, 3, 3);
    expect(result.release).toEqual({ action: "ignore" });
    expect(result.flight).toEqual(idle);
  });

  test("queues a newer release instead of dropping it", () => {
    const started = releaseDial(idle, 4, 2);
    const queued = releaseDial(started.flight, 7, 2);
    expect(queued.release).toEqual({ action: "queue", value: 7 });
    expect(queued.flight).toEqual({ inFlight: 4, pending: 7 });
    const replaced = releaseDial(queued.flight, 9, 2);
    expect(replaced.flight.pending).toBe(9);
  });

  test("releasing the in-flight value clears a queued dial", () => {
    const queued = releaseDial({ inFlight: 4, pending: 7 }, 4, 2);
    expect(queued.release).toEqual({ action: "ignore" });
    expect(queued.flight).toEqual({ inFlight: 4, pending: null });
  });

  test("clamps the released value", () => {
    const result = releaseDial(idle, Number.NaN, 0);
    expect(result.release).toEqual({ action: "save", value: 5 });
  });
});

describe("settleDialSave", () => {
  test("flashes Saved only when the slider still shows that dial", () => {
    const settled = settleDialSave({ inFlight: 4, pending: null }, 4, true, 4);
    expect(settled.flashSaved).toBe(true);
    expect(settled.save).toBe(null);
    expect(settled.flight).toEqual(idle);
  });

  test("does not flash Saved for an earlier value when a newer draft is showing", () => {
    const settled = settleDialSave({ inFlight: 4, pending: null }, 4, true, 7);
    expect(settled.flashSaved).toBe(false);
    expect(settled.revertDraft).toBe(false);
    expect(settled.save).toBe(null);
  });

  test("saves the queued dial next and withholds Saved", () => {
    const settled = settleDialSave({ inFlight: 4, pending: 7 }, 4, true, 7);
    expect(settled.flashSaved).toBe(false);
    expect(settled.save).toBe(7);
    expect(settled.flight).toEqual({ inFlight: 7, pending: null });
  });

  test("a failed latest save reverts and does not flash Saved", () => {
    const settled = settleDialSave({ inFlight: 7, pending: null }, 7, false, 7);
    expect(settled.flashSaved).toBe(false);
    expect(settled.revertDraft).toBe(true);
    expect(settled.save).toBe(null);
  });

  test("a failed save still continues to a newer queued dial", () => {
    const settled = settleDialSave({ inFlight: 4, pending: 7 }, 4, false, 7);
    expect(settled.revertDraft).toBe(false);
    expect(settled.flashSaved).toBe(false);
    expect(settled.save).toBe(7);
  });
});
