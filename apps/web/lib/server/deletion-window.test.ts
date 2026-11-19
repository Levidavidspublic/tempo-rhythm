import { describe, expect, test } from "bun:test";
import {
  DELETION_GRACE_DAYS,
  DELETION_GRACE_MS,
  canRestoreAccount,
  readDeletionWindow,
} from "./deletion-window";

describe("deletion window", () => {
  test("missing and null deletion times are live", () => {
    expect(readDeletionWindow(undefined, 1_000)).toEqual({ state: "live" });
    expect(readDeletionWindow(null, 1_000)).toEqual({ state: "live" });
  });

  test("a just-deleted account has 30 days left", () => {
    expect(readDeletionWindow(1_000, 1_000)).toEqual({
      state: "restorable",
      daysLeft: DELETION_GRACE_DAYS,
      removeAt: 1_000 + DELETION_GRACE_MS,
    });
  });

  test("one millisecond before removal has one day left and can restore", () => {
    const deletedAt = 1_000;
    const now = deletedAt + DELETION_GRACE_MS - 1;

    expect(readDeletionWindow(deletedAt, now)).toEqual({
      state: "restorable",
      daysLeft: 1,
      removeAt: deletedAt + DELETION_GRACE_MS,
    });
    expect(canRestoreAccount(deletedAt, now)).toBe(true);
  });

  test("exactly at removal time is due and cannot restore", () => {
    const deletedAt = 1_000;
    const now = deletedAt + DELETION_GRACE_MS;

    expect(readDeletionWindow(deletedAt, now)).toEqual({
      state: "remove-due",
      removeAt: now,
    });
    expect(canRestoreAccount(deletedAt, now)).toBe(false);
  });

  test("invalid deletion times throw", () => {
    expect(() => readDeletionWindow(Number.NaN, 1_000)).toThrow(
      new RangeError("Invalid deletedAt")
    );
    expect(() => readDeletionWindow(-1, 1_000)).toThrow(new RangeError("Invalid deletedAt"));
    expect(() => readDeletionWindow(1_001, 1_000)).toThrow(new RangeError("Invalid deletedAt"));
  });

  test("removal time is deletion time plus the grace period", () => {
    const deletedAt = 123_456;
    const window = readDeletionWindow(deletedAt, deletedAt);

    expect(window).toEqual({
      state: "restorable",
      daysLeft: DELETION_GRACE_DAYS,
      removeAt: deletedAt + DELETION_GRACE_MS,
    });
  });
});
