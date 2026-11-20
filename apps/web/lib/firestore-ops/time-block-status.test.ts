import { expect, test } from "bun:test";
import type { TimeBlockDoc } from "../firestore-docs/time-block-doc";
import { planTimeBlockStatus } from "./time-block-status";

const block: TimeBlockDoc = {
  localDate: "2026-11-20",
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

test("plans a planned block as done", () => {
  expect(planTimeBlockStatus(block, "done", 1_795_161_000_000)).toEqual({
    ok: true,
    changed: true,
    status: "done",
    patch: { status: "done", updatedAt: 1_795_161_000_000 },
    changedFields: ["status", "updatedAt"],
  });
});

test("plans a done block back to planned", () => {
  expect(planTimeBlockStatus({ ...block, status: "done" }, "planned", 1_795_162_000_000)).toEqual({
    ok: true,
    changed: true,
    status: "planned",
    patch: { status: "planned", updatedAt: 1_795_162_000_000 },
    changedFields: ["status", "updatedAt"],
  });
});

test("plans a planned block as skipped", () => {
  expect(planTimeBlockStatus(block, "skipped", 1_795_163_000_000)).toEqual({
    ok: true,
    changed: true,
    status: "skipped",
    patch: { status: "skipped", updatedAt: 1_795_163_000_000 },
    changedFields: ["status", "updatedAt"],
  });
});

test("returns no change with an empty patch when the status is already set", () => {
  expect(planTimeBlockStatus(block, "planned", 1_795_164_000_000)).toEqual({
    ok: true,
    changed: false,
    status: "planned",
    patch: {},
    changedFields: [],
  });
});

test("refuses a deleted block", () => {
  expect(
    planTimeBlockStatus({ ...block, deletedAt: 1_795_160_500_000 }, "done", 1_795_165_000_000)
  ).toEqual({ ok: false, reason: "deleted" });
});

test("refuses a bad time and an unknown status", () => {
  expect(planTimeBlockStatus(block, "done", Number.NaN)).toEqual({
    ok: false,
    reason: "bad-time",
  });
  expect(
    planTimeBlockStatus(block, "unknown" as TimeBlockDoc["status"], 1_795_165_000_000)
  ).toEqual({ ok: false, reason: "bad-status" });
});
