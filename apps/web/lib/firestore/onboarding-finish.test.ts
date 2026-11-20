import { expect, test } from "bun:test";
import { GATE_FIELDS } from "../firestore-docs/profile-doc";
import { planOnboardingFinish, PROFILE_NAME_MAX } from "./onboarding-finish";

test("new person with a name gets name, fullName and onboardedAt", () => {
  expect(planOnboardingFinish(null, "  Ada   Lovelace  ", 100)).toEqual({
    ok: true,
    patch: { name: "Ada Lovelace", fullName: "Ada Lovelace", onboardedAt: 100 },
    changedFields: ["name", "fullName", "onboardedAt"],
  });
});

test("new person with no name gets only onboardedAt", () => {
  expect(planOnboardingFinish(null, " \n\t ", 101)).toEqual({
    ok: true,
    patch: { onboardedAt: 101 },
    changedFields: ["onboardedAt"],
  });
});

test("already onboarded with the same name gives no-change", () => {
  expect(
    planOnboardingFinish({ name: "Ada", fullName: "Ada", onboardedAt: 10 }, "Ada", 102),
  ).toEqual({ ok: true, kind: "no-change" });
});

test("already onboarded with a new name patches only name", () => {
  expect(
    planOnboardingFinish({ name: "Ada", fullName: "Ada", onboardedAt: 10 }, "Grace", 103),
  ).toEqual({ ok: true, patch: { name: "Grace" }, changedFields: ["name"] });
});

test("long name is cut to 80 characters without splitting a surrogate pair and Hebrew is intact", () => {
  const longName = `${"a".repeat(PROFILE_NAME_MAX - 1)}😀tail`;
  const longPlan = planOnboardingFinish(null, longName, 104);
  expect(longPlan).toEqual({
    ok: true,
    patch: {
      name: "a".repeat(PROFILE_NAME_MAX - 1),
      fullName: "a".repeat(PROFILE_NAME_MAX - 1),
      onboardedAt: 104,
    },
    changedFields: ["name", "fullName", "onboardedAt"],
  });
  expect(planOnboardingFinish(null, "  שלום   עולם  ", 105)).toEqual({
    ok: true,
    patch: { name: "שלום עולם", fullName: "שלום עולם", onboardedAt: 105 },
    changedFields: ["name", "fullName", "onboardedAt"],
  });
});

test("invalid now is refused", () => {
  expect(planOnboardingFinish(null, "Ada", Number.NaN)).toEqual({
    ok: false,
    reason: "invalid-now",
  });
  expect(planOnboardingFinish(null, "Ada", 0)).toEqual({ ok: false, reason: "invalid-now" });
});

test("patch excludes gate fields and does not mutate the input", () => {
  const stored = { name: "Old" };
  const snapshot = { ...stored };
  const result = planOnboardingFinish(stored, "New", 106);

  expect(stored).toEqual(snapshot);
  expect(result.ok && "patch" in result).toBe(true);
  if (result.ok && "patch" in result) {
    for (const field of GATE_FIELDS) expect(field in result.patch).toBe(false);
    expect(Object.values(result.patch).every((value) => value !== undefined)).toBe(true);
  }
});
