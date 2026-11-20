import { describe, expect, test } from "bun:test";
import type { DayPlanDoc } from "../firestore-docs/day-plan-doc";
import { planDayPlanCommit, planDayPlanSave } from "./day-plan-save";

const now = 1_800_000_000_000;
const existing = (overrides: Partial<DayPlanDoc> = {}): DayPlanDoc => ({
  localDate: "2026-11-20",
  status: "draft",
  createdAt: now - 1_000,
  updatedAt: now - 1_000,
  ...overrides,
});

describe("day plan save planning", () => {
  test("creates a draft with defaults", () => {
    expect(planDayPlanSave(null, { localDate: "2026-11-20" }, now)).toEqual({
      ok: true,
      kind: "create",
      doc: {
        localDate: "2026-11-20",
        status: "draft",
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  test("an update holds only the edited fields", () => {
    expect(
      planDayPlanSave(existing(), { localDate: "2026-11-20", intention: "  Focus  " }, now)
    ).toEqual({
      ok: true,
      kind: "update",
      patch: { intention: "Focus", updatedAt: now },
      changedFields: ["intention"],
    });
  });

  test("updating a committed plan does not touch its status", () => {
    const result = planDayPlanSave(
      existing({ status: "committed", committedAt: now - 500 }),
      { localDate: "2026-11-20", energy: "high" },
      now
    );
    expect(result).toEqual({
      ok: true,
      kind: "update",
      patch: { energy: "high", updatedAt: now },
      changedFields: ["energy"],
    });
    expect(result.ok && result.kind === "update" && "status" in result.patch).toBe(false);
  });

  test("refuses four top tasks", () => {
    expect(
      planDayPlanSave(
        null,
        { localDate: "2026-11-20", topTaskIds: ["one", "two", "three", "four"] },
        now
      )
    ).toEqual({ ok: false, reason: "too-many-tasks" });
  });

  test("refuses a nonexistent calendar date", () => {
    expect(planDayPlanSave(null, { localDate: "2026-02-30" }, now)).toEqual({
      ok: false,
      reason: "bad-date",
    });
  });

  test("commit with no plan creates a committed plan", () => {
    expect(planDayPlanCommit(null, "2026-11-20", now)).toEqual({
      ok: true,
      kind: "create",
      doc: {
        localDate: "2026-11-20",
        status: "committed",
        committedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  test("commit of an already committed plan keeps the first committedAt", () => {
    expect(
      planDayPlanCommit(
        existing({ status: "committed", committedAt: now - 500 }),
        "2026-11-20",
        now
      )
    ).toEqual({ ok: true, kind: "none", committedAt: now - 500 });
  });

  test("no output contains undefined values", () => {
    const outputs = [
      planDayPlanSave(null, { localDate: "2026-11-20", intention: undefined }, now),
      planDayPlanSave(existing(), { localDate: "2026-11-20", timezone: undefined }, now),
      planDayPlanCommit(null, "2026-11-20", now),
    ];
    expect(outputs.some((output) => JSON.stringify(output).includes("undefined"))).toBe(false);
    for (const output of outputs) {
      expect(Object.values(output).includes(undefined)).toBe(false);
      if (output.ok && output.kind !== "none") {
        const write = output.kind === "create" ? output.doc : output.patch;
        expect((Object.values(write) as unknown[]).includes(undefined)).toBe(false);
      }
    }
  });
});
