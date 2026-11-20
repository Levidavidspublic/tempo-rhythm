import { describe, expect, test } from "bun:test";

import { findChangedFields } from "./changed-fields";

describe("findChangedFields", () => {
  test("returns empty collections when nothing changed", () => {
    expect(findChangedFields({ title: "Plan", priority: 2 }, { title: "Plan", priority: 2 })).toEqual({
      set: {},
      removed: [],
      names: [],
    });
  });

  test("returns one changed primitive without changing either input", () => {
    const before = { title: "Plan", priority: 2 };
    const after = { title: "New plan", priority: 2 };

    expect(findChangedFields(before, after)).toEqual({
      set: { title: "New plan" },
      removed: [],
      names: ["title"],
    });
    expect(before).toEqual({ title: "Plan", priority: 2 });
    expect(after).toEqual({ title: "New plan", priority: 2 });
  });

  test("returns a newly added field", () => {
    expect(findChangedFields({ title: "Plan" }, { title: "Plan", status: "todo" })).toEqual({
      set: { status: "todo" },
      removed: [],
      names: ["status"],
    });
  });

  test("returns a removed field", () => {
    expect(findChangedFields({ title: "Plan", status: "todo" }, { title: "Plan" })).toEqual({
      set: {},
      removed: ["status"],
      names: ["status"],
    });
  });

  test("counts an array order change", () => {
    expect(findChangedFields({ tags: ["a", "b"] }, { tags: ["b", "a"] })).toEqual({
      set: { tags: ["b", "a"] },
      removed: [],
      names: ["tags"],
    });
  });

  test("treats nested maps with equal values as unchanged", () => {
    const before = { details: { schedule: { day: "Monday", slots: [1, 2] } } };
    const after = { details: { schedule: { slots: [1, 2], day: "Monday" } } };

    expect(findChangedFields(before, after)).toEqual({ set: {}, removed: [], names: [] });
  });

  test("never includes undefined in set", () => {
    expect(findChangedFields({ keep: true, old: "value" }, { keep: true, old: undefined, new: undefined })).toEqual({
      set: {},
      removed: ["old"],
      names: ["old"],
    });
  });

  test("throws for non-plain inputs and bad values at any depth", () => {
    const badValues = [() => undefined, Symbol("bad"), Number.NaN, new Date()];

    expect(() => findChangedFields([], {})).toThrow(TypeError);
    expect(() => findChangedFields({}, null)).toThrow(TypeError);
    for (const value of badValues) {
      expect(() => findChangedFields({ unchanged: { value } }, { unchanged: { value } })).toThrow(
        TypeError
      );
    }
  });
});
