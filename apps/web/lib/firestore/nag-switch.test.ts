import { describe, expect, test } from "bun:test";

import type { NagDoc } from "../firestore-docs/nag-doc";
import { planNagSwitch } from "./nag-switch";

function nag(enabled: boolean): NagDoc {
  return {
    label: "Take a breath",
    enabled,
    phrases: [
      {
        id: "phrase-1",
        text: "Pause before answering",
        source: "user",
        status: "accepted",
      },
    ],
    createdAt: 10,
    updatedAt: 20,
  };
}

describe("planNagSwitch", () => {
  test("plans switching an enabled nag off", () => {
    expect(planNagSwitch(nag(true), false, 30)).toEqual({
      kind: "patch",
      patch: { enabled: false, updatedAt: 30 },
      fields: ["enabled", "updatedAt"],
    });
  });

  test("plans switching a disabled nag on", () => {
    const result = planNagSwitch(nag(false), true, 30);

    expect(result).toEqual({
      kind: "patch",
      patch: { enabled: true, updatedAt: 30 },
      fields: ["enabled", "updatedAt"],
    });
    if (result.kind === "patch") {
      expect(Object.keys(result.patch).sort()).toEqual([
        "enabled",
        "updatedAt",
      ]);
    }
  });

  test("returns unchanged when the nag is already on", () => {
    expect(planNagSwitch(nag(true), true, 30)).toEqual({ kind: "unchanged" });
  });

  test("returns unchanged when the nag is already off", () => {
    expect(planNagSwitch(nag(false), false, 30)).toEqual({ kind: "unchanged" });
  });

  test("refuses a deleted nag", () => {
    expect(planNagSwitch({ ...nag(false), deletedAt: 25 }, true, 30)).toEqual({
      kind: "refused",
      reason: "nag is deleted",
    });
  });

  test("refuses a non-boolean enabled value", () => {
    expect(planNagSwitch(nag(false), "true", 30)).toEqual({
      kind: "refused",
      reason: "enabled must be a boolean",
    });
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "refuses a non-finite time: %s",
    (now) => {
      expect(planNagSwitch(nag(false), true, now)).toEqual({
        kind: "refused",
        reason: "now must be finite",
      });
    },
  );

  test("does not change the stored nag or its phrases", () => {
    const stored = nag(false);
    const before = structuredClone(stored);
    const phrases = stored.phrases;

    planNagSwitch(stored, true, 30);

    expect(stored).toEqual(before);
    expect(stored.phrases).toBe(phrases);
    expect(stored.phrases).toEqual(before.phrases);
  });

  test("refuses rather than throwing when the resulting nag is invalid", () => {
    const stored = { ...nag(false), label: "" };

    expect(() => planNagSwitch(stored, true, 30)).not.toThrow();
    expect(planNagSwitch(stored, true, 30)).toEqual({
      kind: "refused",
      reason: "nag could not be checked",
    });
  });
});
