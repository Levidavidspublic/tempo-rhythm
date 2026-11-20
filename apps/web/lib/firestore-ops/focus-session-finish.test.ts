import { describe, expect, test } from "bun:test";
import { focusMinutesInRange, planFocusSessionFinish } from "./focus-session-finish";

const NOW = 2_000_000_000;

describe("planFocusSessionFinish", () => {
  test("plans a 25-minute session with trimmed optional fields", () => {
    expect(
      planFocusSessionFinish(
        { startedAtMs: NOW - 25 * 60_000, label: "  Deep work  ", taskId: "task-1" },
        NOW
      )
    ).toEqual({
      ok: true,
      doc: {
        startedAtMs: NOW - 25 * 60_000,
        durationMs: 25 * 60_000,
        label: "Deep work",
        taskId: "task-1",
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
  });

  test("refuses a 30-second session", () => {
    expect(planFocusSessionFinish({ startedAtMs: NOW - 30_000 }, NOW)).toEqual({
      ok: false,
      reason: "too_short",
    });
  });

  test("caps a 30-hour session at 24 hours", () => {
    const result = planFocusSessionFinish({ startedAtMs: NOW - 30 * 60 * 60_000 }, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.durationMs).toBe(24 * 60 * 60_000);
  });

  test("refuses a start after now", () => {
    expect(planFocusSessionFinish({ startedAtMs: NOW + 1 }, NOW)).toEqual({
      ok: false,
      reason: "bad_start",
    });
  });

  test("drops an empty label and leaves no undefined values", () => {
    const result = planFocusSessionFinish(
      { startedAtMs: NOW - 60_000, label: "   ", taskId: undefined },
      NOW
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.doc).not.toHaveProperty("label");
    expect(result.doc).not.toHaveProperty("taskId");
    expect(Object.values(result.doc)).not.toContain(undefined);
  });

  test("shortens a long label to 120 characters", () => {
    const result = planFocusSessionFinish(
      { startedAtMs: NOW - 60_000, label: `  ${"a".repeat(121)}  ` },
      NOW
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.label).toBe("a".repeat(120));
  });

  test("refuses a task id containing a slash", () => {
    expect(planFocusSessionFinish({ startedAtMs: NOW - 60_000, taskId: "tasks/one" }, NOW)).toEqual(
      { ok: false, reason: "bad_task" }
    );
  });
});

describe("focusMinutesInRange", () => {
  test("counts only the part inside a half-open day and leaves out deleted blocks", () => {
    const dayStart = 24 * 60 * 60_000;
    expect(
      focusMinutesInRange(
        [
          { startedAtMs: dayStart - 30 * 60_000, durationMs: 60 * 60_000 },
          { startedAtMs: dayStart + 60 * 60_000, durationMs: 25 * 60_000, deletedAt: 1 },
        ],
        dayStart,
        dayStart + 24 * 60 * 60_000
      )
    ).toBe(30);
  });

  test("returns zero for a bad window", () => {
    expect(focusMinutesInRange([], NOW, NOW)).toBe(0);
  });
});
