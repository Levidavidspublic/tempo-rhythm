import { expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseToggleNotePin } from "./use-toggle-note-pin";

const markerMutation = Object.assign(async () => ({ pinned: true }), {
  withOptimisticUpdate: () => markerMutation,
});

test("passes notes.togglePin to useMutation", () => {
  let receivedReference: Parameters<typeof getFunctionName>[0] | undefined;
  const useToggleNotePin = makeUseToggleNotePin((reference) => {
    receivedReference = reference;
    return markerMutation;
  });

  useToggleNotePin();

  if (receivedReference === undefined) {
    throw new Error("useMutation was not called");
  }
  expect(getFunctionName(receivedReference)).toBe("notes:togglePin");
});

test("returns the mutation from useMutation unchanged", () => {
  const useToggleNotePin = makeUseToggleNotePin(() => markerMutation);

  expect(useToggleNotePin()).toBe(markerMutation);
});
