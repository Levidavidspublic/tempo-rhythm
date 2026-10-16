import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

/**
 * `createOnce` lives in HabitsScreen.tsx, whose imports reach `useConvexAuth`. In the shared
 * `bun run test` process, tests/unit/releaseOnboardingGate.test.tsx keeps a convex/react mock
 * without it registered for every file, so importing the screen there fails to link. The checks
 * below therefore run in a fresh bun process (this same file, with CHILD set), where the screen
 * imports the real modules.
 */
const CHILD = "TEMPO_CREATE_ONCE_CHILD";

if (process.env[CHILD] === "1") {
  const { createOnce } = await import("@/components/habits/HabitsScreen");

  /** A run that stays open until the test settles it. */
  const gate = () => {
    let open = () => {};
    let fail = (_error: Error) => {};
    const done = new Promise<void>((resolve, reject) => {
      open = resolve;
      fail = reject;
    });
    return { done, open, fail };
  };

  describe("createOnce", () => {
    test("two calls in a row run the create once", async () => {
      const flag = { current: false };
      const step = gate();
      let runs = 0;
      const run = () => {
        runs += 1;
        return step.done;
      };
      const first = createOnce(flag, run);
      const second = createOnce(flag, run);
      expect(runs).toBe(1);
      expect(flag.current).toBe(true);
      expect(await second).toBe(false);
      step.open();
      expect(await first).toBe(true);
      expect(runs).toBe(1);
      expect(flag.current).toBe(false);
    });

    test("a call after the first settles runs again", async () => {
      const flag = { current: false };
      let runs = 0;
      const run = async () => {
        runs += 1;
      };
      expect(await createOnce(flag, run)).toBe(true);
      expect(await createOnce(flag, run)).toBe(true);
      expect(runs).toBe(2);
    });

    test("a failed create frees the guard and passes the error on", async () => {
      const flag = { current: false };
      const step = gate();
      const first = createOnce(flag, () => step.done);
      step.fail(new Error("offline"));
      await expect(first).rejects.toThrow("offline");
      expect(flag.current).toBe(false);
      let runs = 0;
      const again = await createOnce(flag, async () => {
        runs += 1;
      });
      expect(again).toBe(true);
      expect(runs).toBe(1);
    });
  });
} else {
  test("createOnce: a double create runs once, and runs again once settled", () => {
    const child = spawnSync(process.execPath, ["test", import.meta.path], {
      env: { ...process.env, [CHILD]: "1" },
      encoding: "utf8",
    });
    const output = `${child.stdout}${child.stderr}`;
    if (child.status !== 0) throw new Error(`createOnce checks failed:\n${output}`);
    expect(output).toContain("3 pass");
    expect(output).toContain("0 fail");
  }, 30_000);
}
