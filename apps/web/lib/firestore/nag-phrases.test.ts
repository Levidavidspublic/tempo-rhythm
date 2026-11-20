import { describe, expect, test } from "bun:test";

import type { NagDoc } from "../firestore-docs/nag-doc";
import { planAddNagPhrase, planDecideNagPhrase } from "./nag-phrases";

const storedNag = (): NagDoc => ({
  label: "Morning focus",
  enabled: true,
  phrases: [
    { id: "one", text: "Start small", source: "user", status: "accepted" },
    { id: "two", text: "What matters now?", source: "derived", status: "proposed" },
  ],
  createdAt: 10,
  updatedAt: 20,
});

describe("nag phrase plans", () => {
  test("adding a phrase appends it as user-authored and accepted", () => {
    const stored = storedNag();

    expect(planAddNagPhrase(stored, { id: "three", text: "Take the first step" }, 30)).toEqual({
      kind: "patch",
      patch: {
        phrases: [
          ...stored.phrases,
          { id: "three", text: "Take the first step", source: "user", status: "accepted" },
        ],
        updatedAt: 30,
      },
      fields: ["phrases", "updatedAt"],
    });
  });

  test("trims text and collapses whitespace", () => {
    const plan = planAddNagPhrase(
      storedNag(),
      { id: "three", text: "  Take\n\t the   first step  " },
      30
    );

    expect(plan.kind === "patch" ? plan.patch.phrases.at(-1)?.text : plan).toBe(
      "Take the first step"
    );
  });

  test("refuses a repeated phrase that differs only in case", () => {
    expect(planAddNagPhrase(storedNag(), { id: "three", text: "start SMALL" }, 30)).toEqual({
      kind: "refused",
      reason: "phrase already exists",
    });
  });

  test("refuses an empty phrase", () => {
    expect(planAddNagPhrase(storedNag(), { id: "three", text: " \n\t " }, 30)).toEqual({
      kind: "refused",
      reason: "phrase is empty",
    });
  });

  test("accepting a proposed phrase changes only that phrase", () => {
    const stored = storedNag();

    expect(planDecideNagPhrase(stored, "two", "accepted", 31)).toEqual({
      kind: "patch",
      patch: {
        phrases: [stored.phrases[0], { ...stored.phrases[1], status: "accepted" }],
        updatedAt: 31,
      },
      fields: ["phrases", "updatedAt"],
    });
  });

  test("deciding the status a phrase already has leaves it unchanged", () => {
    expect(planDecideNagPhrase(storedNag(), "one", "accepted", 31)).toEqual({
      kind: "unchanged",
    });
  });

  test("refuses deleted nags and unknown phrase ids without mutating frozen input", () => {
    const active = storedNag();
    Object.freeze(active.phrases);
    active.phrases.forEach(Object.freeze);
    Object.freeze(active);
    const deleted = Object.freeze({ ...active, deletedAt: 25 });

    expect(planAddNagPhrase(deleted, { id: "three", text: "Keep going" }, 30)).toEqual({
      kind: "refused",
      reason: "nag is deleted",
    });
    expect(planDecideNagPhrase(active, "missing", "rejected", 30)).toEqual({
      kind: "refused",
      reason: "phrase not found",
    });
    expect(active).toEqual(storedNag());
  });
});
