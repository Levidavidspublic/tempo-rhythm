import { expect, test } from "bun:test";

import type { CoachSettingsDoc } from "../firestore-docs/coach-settings-doc";
import { planCoachSettingsSave } from "./coach-settings-save";

const stored: CoachSettingsDoc = {
  dial: 5,
  taskLoad: 2,
  acceptedStreak: 3,
  updatedAt: 100,
  panicUntil: 500,
};

test("no stored document creates one from the defaults with the edited dial", () => {
  expect(planCoachSettingsSave(null, { dial: 7 }, 200)).toEqual({
    ok: true,
    kind: "create",
    doc: { dial: 7, taskLoad: 2, acceptedStreak: 0, updatedAt: 200 },
  });
});

test("stored document gets a patch with only the dial", () => {
  expect(planCoachSettingsSave(stored, { dial: 7 }, 200)).toEqual({
    ok: true,
    kind: "update",
    patch: { dial: 7, updatedAt: 200 },
    changed: ["dial", "updatedAt"],
  });
});

test("same values give no-change", () => {
  expect(planCoachSettingsSave(stored, { dial: 5, taskLoad: 2 }, 200)).toEqual({
    ok: false,
    reason: "no-change",
  });
});

test("dial 11 is refused", () => {
  expect(planCoachSettingsSave(stored, { dial: 11 }, 200)).toEqual({
    ok: false,
    reason: "invalid",
  });
});

test("task load 1 is refused", () => {
  expect(planCoachSettingsSave(stored, { taskLoad: 1 }, 200)).toEqual({
    ok: false,
    reason: "invalid",
  });
});

test("unknown key is refused", () => {
  expect(planCoachSettingsSave(stored, { dial: 7, surprise: true } as never, 200)).toEqual({
    ok: false,
    reason: "unknown-setting",
  });
});

test("update patch never carries acceptedStreak or panicUntil", () => {
  const result = planCoachSettingsSave(stored, { taskLoad: 4 }, 200);
  expect(result).toEqual({
    ok: true,
    kind: "update",
    patch: { taskLoad: 4, updatedAt: 200 },
    changed: ["taskLoad", "updatedAt"],
  });
  if (result.ok) {
    expect(result.patch).not.toHaveProperty("acceptedStreak");
    expect(result.patch).not.toHaveProperty("panicUntil");
  }
});
