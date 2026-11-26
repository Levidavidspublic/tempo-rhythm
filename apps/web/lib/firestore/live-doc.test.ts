import { expect, test } from "bun:test";
import { applyLiveSnapshot, loadingLiveDoc } from "./live-doc";

type ExampleDoc = { name: string; deletedAt?: number };

test("starts in the loading state", () => {
  expect(loadingLiveDoc<ExampleDoc>()).toEqual({ state: "loading" });
});

test("reports a missing document without defaults", () => {
  expect(applyLiveSnapshot<ExampleDoc>({ id: "plan", exists: false, data: undefined })).toEqual({
    state: "missing",
    doc: null,
  });
});

test("copies defaults for a missing document", () => {
  const defaults = { name: "Untitled" };
  const result = applyLiveSnapshot<ExampleDoc>(
    { id: "preferences", exists: false, data: undefined },
    { defaults }
  );

  expect(result).toEqual({ state: "missing", doc: defaults });
  expect(result.state === "missing" && result.doc).not.toBe(defaults);
});

test("returns a ready document with snapshot flags", () => {
  const doc = { name: "Today" };

  expect(
    applyLiveSnapshot<ExampleDoc>({
      id: "day-plan",
      exists: true,
      data: doc,
      pendingWrite: true,
      fromCache: true,
    })
  ).toEqual({ state: "ready", id: "day-plan", doc, pendingWrite: true, fromCache: true });
});

test("treats a soft-deleted document as missing", () => {
  expect(
    applyLiveSnapshot<ExampleDoc>({ id: "note", exists: true, data: { name: "Old", deletedAt: 1 } })
  ).toEqual({ state: "missing", doc: null });
});

test("falls back to copied defaults when the check throws", () => {
  const defaults = { name: "Default" };
  const result = applyLiveSnapshot<ExampleDoc>(
    { id: "coach", exists: true, data: { name: "Invalid" } },
    {
      defaults,
      check: () => {
        throw new Error("invalid document");
      },
    }
  );

  expect(result).toEqual({ state: "missing", doc: defaults });
  expect(result.state === "missing" && result.doc).not.toBe(defaults);
});

test("throws for bad input", () => {
  expect(() =>
    applyLiveSnapshot<ExampleDoc>({ id: "note", exists: true, data: ["not", "an", "object"] })
  ).toThrow(TypeError);
  expect(() => applyLiveSnapshot<ExampleDoc>({ id: "  ", exists: false, data: undefined })).toThrow(
    TypeError
  );
});
