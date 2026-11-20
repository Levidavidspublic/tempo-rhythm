import { expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseToggleNotePin } from "./use-toggle-note-pin";

const markerMutation = Object.assign(async () => ({ pinned: true }), {
  withOptimisticUpdate: () => markerMutation,
});

test("passes notes.togglePin to useMutation", () => {
  const useToggleNotePin = makeUseToggleNotePin((reference) => {
    expect(getFunctionName(reference)).toBe("notes:togglePin");
    return markerMutation;
  });

  useToggleNotePin();
});

test("returns the mutation from useMutation unchanged", () => {
  const useToggleNotePin = makeUseToggleNotePin(() => markerMutation);

  expect(useToggleNotePin()).toBe(markerMutation);
});
