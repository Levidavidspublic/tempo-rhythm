import { expect, test } from "bun:test";
import { checkTimeBlockDoc, type TimeBlockDoc } from "../firestore-docs/time-block-doc";
import { planTimeBlockMove } from "./time-block-move";

const block: TimeBlockDoc = {
  localDate: "2026-11-20",
  dayPlanId: "plan-1",
  title: "Write the outline",
  startMinute: 540,
  durationMinutes: 30,
  startsAtMs: 1_795_168_800_000,
  endsAtMs: 1_795_170_600_000,
  kind: "focus",
  taskId: "task-1",
  status: "planned",
  source: "user",
  createdAt: 1_795_160_000_000,
  updatedAt: 1_795_160_000_000,
};

const unchangedInput = {
  startMinute: block.startMinute,
  durationMinutes: block.durationMinutes,
  startsAtMs: block.startsAtMs,
  endsAtMs: block.endsAtMs,
};

test("plans a start-only move and produces a valid patched time block", () => {
  const result = planTimeBlockMove(
    block,
    {
      ...unchangedInput,
      startMinute: 600,
      startsAtMs: 1_795_172_400_000,
      endsAtMs: 1_795_174_200_000,
    },
    1_795_161_000_000
  );

  expect(result).toEqual({
    ok: true,
    unchanged: false,
    patch: {
      startMinute: 600,
      startsAtMs: 1_795_172_400_000,
      endsAtMs: 1_795_174_200_000,
      updatedAt: 1_795_161_000_000,
    },
    changedFields: ["startMinute", "startsAtMs", "endsAtMs", "updatedAt"],
  });
  if (result.ok && !result.unchanged) {
    expect(checkTimeBlockDoc({ ...block, ...result.patch })).toMatchObject({ ok: true });
  }
});

test("plans a resize", () => {
  expect(
    planTimeBlockMove(
      block,
      { ...unchangedInput, durationMinutes: 60, endsAtMs: block.startsAtMs + 60 * 60_000 },
      1_795_162_000_000
    )
  ).toEqual({
    ok: true,
    unchanged: false,
    patch: {
      durationMinutes: 60,
      endsAtMs: block.startsAtMs + 60 * 60_000,
      updatedAt: 1_795_162_000_000,
    },
    changedFields: ["durationMinutes", "endsAtMs", "updatedAt"],
  });
});

test("returns unchanged without a patch", () => {
  expect(planTimeBlockMove(block, unchangedInput, 1_795_163_000_000)).toEqual({
    ok: true,
    unchanged: true,
  });
});

test("refuses a deleted block", () => {
  expect(
    planTimeBlockMove({ ...block, deletedAt: 1_795_160_500_000 }, unchangedInput, 1_795_163_000_000)
  ).toEqual({ ok: false, reason: "deleted" });
});

test("refuses a bad start minute", () => {
  expect(
    planTimeBlockMove(block, { ...unchangedInput, startMinute: 1440 }, 1_795_163_000_000)
  ).toEqual({ ok: false, reason: "bad-start" });
});

test("refuses a bad duration", () => {
  expect(
    planTimeBlockMove(block, { ...unchangedInput, durationMinutes: 4 }, 1_795_163_000_000)
  ).toEqual({ ok: false, reason: "bad-length" });
});

test("refuses bad ranges and non-finite times", () => {
  expect(
    planTimeBlockMove(
      block,
      { ...unchangedInput, endsAtMs: unchangedInput.startsAtMs },
      1_795_163_000_000
    )
  ).toEqual({ ok: false, reason: "bad-range" });
  expect(planTimeBlockMove(block, unchangedInput, Number.NaN)).toEqual({
    ok: false,
    reason: "bad-time",
  });
});
