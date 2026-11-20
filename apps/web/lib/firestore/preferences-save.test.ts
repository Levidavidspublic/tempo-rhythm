import { expect, test } from "bun:test";

import { defaultUserPreferences } from "../firestore-docs/user-preferences-doc";
import { planPreferencesSave } from "./preferences-save";

const NOW = 2_000;
const storedPreferences = () => defaultUserPreferences(1_000);

test("first save creates a full document with defaults plus the edit", () => {
  expect(planPreferencesSave(null, { theme: "dark" }, NOW)).toEqual({
    ok: true,
    kind: "create",
    doc: { ...defaultUserPreferences(NOW), theme: "dark" },
  });
});

test("switching locale to Hebrew patches only locale and updatedAt", () => {
  expect(planPreferencesSave(storedPreferences(), { locale: "he" }, NOW)).toEqual({
    ok: true,
    kind: "update",
    patch: { locale: "he", updatedAt: NOW },
    changedFields: ["locale", "updatedAt"],
  });
});

test("two edits patch only the setting that differs", () => {
  expect(
    planPreferencesSave(storedPreferences(), { theme: "system", weekStartsOn: 0 }, NOW)
  ).toEqual({
    ok: true,
    kind: "update",
    patch: { weekStartsOn: 0, updatedAt: NOW },
    changedFields: ["weekStartsOn", "updatedAt"],
  });
});

test("identical edits produce no change", () => {
  expect(planPreferencesSave(storedPreferences(), { locale: "en" }, NOW)).toEqual({
    ok: true,
    kind: "no-change",
  });
});

test("an unknown field is refused with its name", () => {
  expect(planPreferencesSave(null, { color: "blue" }, NOW)).toEqual({
    ok: false,
    reason: "unknown-field",
    field: "color",
  });
});

test("write stamps and owner fields in edits are refused", () => {
  expect(planPreferencesSave(null, { updatedAt: 10 }, NOW)).toEqual({
    ok: false,
    reason: "unknown-field",
    field: "updatedAt",
  });
  expect(planPreferencesSave(null, { userId: "user-1" }, NOW)).toEqual({
    ok: false,
    reason: "unknown-field",
    field: "userId",
  });
});

test("an invalid preference value is refused", () => {
  expect(planPreferencesSave(null, { locale: "fr" }, NOW)).toEqual({
    ok: false,
    reason: "invalid-value",
  });
});

test("a deleted stored document is refused without mutating inputs", () => {
  const stored = { ...storedPreferences(), deletedAt: 1_500 };
  const edits = { theme: "dark" };
  const storedSnapshot = structuredClone(stored);
  const editsSnapshot = structuredClone(edits);

  expect(planPreferencesSave(stored, edits, NOW)).toEqual({ ok: false, reason: "deleted" });
  expect(stored).toEqual(storedSnapshot);
  expect(edits).toEqual(editsSnapshot);
});
