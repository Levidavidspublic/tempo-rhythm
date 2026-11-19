import { describe, expect, test } from "bun:test";
import { checkTimeBlockDoc } from "./time-block-doc";

const validBlock = {
  localDate: "2026-11-19",
  title: "Deep work",
  startMinute: 540,
  durationMinutes: 60,
  startsAtMs: 1_795_078_800_000,
  endsAtMs: 1_795_082_400_000,
  kind: "focus",
  status: "planned",
  source: "user",
  createdAt: 1_795_000_000_000,
  updatedAt: 1_795_000_000_000,
} as const;

describe("checkTimeBlockDoc", () => {
  test("accepts a valid block", () => {
    expect(checkTimeBlockDoc(validBlock)).toEqual({
      ok: true,
      doc: validBlock,
    });
  });

  test("refuses a userId field because ownership comes from the path", () => {
    expect(checkTimeBlockDoc({ ...validBlock, userId: "user-1" }).ok).toBe(
      false,
    );
  });

  test("refuses a calendar date that does not exist", () => {
    expect(
      checkTimeBlockDoc({ ...validBlock, localDate: "2026-02-30" }).ok,
    ).toBe(false);
  });

  test("refuses startMinute 1440", () => {
    expect(checkTimeBlockDoc({ ...validBlock, startMinute: 1440 }).ok).toBe(
      false,
    );
  });

  test("refuses a duration shorter than five minutes", () => {
    expect(checkTimeBlockDoc({ ...validBlock, durationMinutes: 4 }).ok).toBe(
      false,
    );
  });

  test("refuses an end time that does not match the duration", () => {
    expect(
      checkTimeBlockDoc({ ...validBlock, endsAtMs: validBlock.endsAtMs + 1 })
        .ok,
    ).toBe(false);
  });

  test("accepts and preserves a soft-deletion timestamp", () => {
    const deletedAt = 1_795_100_000_000;
    const result = checkTimeBlockDoc({ ...validBlock, deletedAt });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.deletedAt).toBe(deletedAt);
  });
});
