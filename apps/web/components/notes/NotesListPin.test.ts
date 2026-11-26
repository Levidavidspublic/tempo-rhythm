import { describe, expect, test } from "bun:test";
import { runPinToggle, sortPinnedFirst } from "./NotesScreen";

describe("notes list pin", () => {
  test("signed-out does not fire the mutation", async () => {
    let calls = 0;
    const outcome = await runPinToggle(false, async () => {
      calls += 1;
    });
    expect(outcome).toBe("signed-out");
    expect(calls).toBe(0);
  });

  test("awaits the mutation and reports toggled", async () => {
    let done = false;
    const outcome = await runPinToggle(true, async () => {
      await Promise.resolve();
      done = true;
    });
    expect(outcome).toBe("toggled");
    expect(done).toBe(true);
  });

  test("a failing mutation becomes an error outcome, not a throw", async () => {
    const outcome = await runPinToggle(true, async () => {
      throw new Error("[CONVEX M(notes:togglePin)] Server Error");
    });
    expect(outcome).toBe("error");
  });

  test("pinned notes sort first", () => {
    const notes = [
      { _id: "a", pinned: false },
      { _id: "b", pinned: true },
    ] as unknown as Parameters<typeof sortPinnedFirst>[0];
    expect(sortPinnedFirst(notes).map((n) => String(n._id))).toEqual(["b", "a"]);
  });
});
