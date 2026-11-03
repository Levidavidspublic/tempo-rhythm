import { describe, expect, test } from "bun:test";
import type { Doc } from "@/convex/_generated/dataModel";
import { getNoteLoadState } from "./NotesScreen";
import { isUndoActive } from "./UndoDeleteToast";

describe("note detail state", () => {
  test("maps unresolved and absent notes without inspecting the URL id", () => {
    expect(getNoteLoadState(undefined)).toBe("loading");
    expect(getNoteLoadState(null)).toBe("not-found");
    expect(getNoteLoadState({ _id: "note" } as Doc<"notes">)).toBe("ready");
  });

  test("keeps undo active only before the backend deadline", () => {
    expect(isUndoActive(1_001, 1_000)).toBe(true);
    expect(isUndoActive(1_000, 1_000)).toBe(false);
    expect(isUndoActive(999, 1_000)).toBe(false);
  });
});
