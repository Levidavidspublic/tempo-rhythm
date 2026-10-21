import type { Locator } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fixturePhase, requireFixtureSuccess, runIsolatedFixture } from "./kitchen-fixture";

export type BrowserBuild = {
  cwd: string;
  entrypoints: string[];
  outdir: string;
  resolveFrom: string;
  aliases?: Record<string, string>;
  define?: Record<string, string>;
  timeoutMs: number;
  cleanupMs: number;
};

/** Plugins are created only in the fresh process, never serialized from a mocked parent. */
export async function isolatedBrowserBuild(config: BrowserBuild): Promise<void> {
  const result = await runIsolatedFixture({
    command: [process.execPath, import.meta.path, "build", JSON.stringify(config)],
    cwd: config.cwd, timeoutMs: config.timeoutMs, cleanupMs: config.cleanupMs,
  });
  requireFixtureSuccess(result);
}

/** Pass the existing assertion timeout; visibility is not a focus receipt. */
export async function waitForCommittedFocus(locator: Locator, timeoutMs: number): Promise<void> {
  const { expect } = await import("@playwright/test");
  await expect(locator).toBeFocused({ timeout: timeoutMs });
}

/** The caller first awaits its real onReady/state-commit signal, then the browser's transition state. */
export async function waitForSettledTransition(locator: Locator, committed: Promise<unknown>, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([committed, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Committed transition signal timed out")), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
  const { expect } = await import("@playwright/test");
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Committed transition signal timed out");
  await expect.poll(() => locator.evaluate((element) => {
    // Force style resolution so a committed class change creates its CSS transitions before inspection.
    void getComputedStyle(element).transform;
    return element.getAnimations({ subtree: true }).every((animation) =>
      animation.playState === "finished" || animation.playState === "idle");
  }), { timeout: remaining }).toBe(true);
}

if (import.meta.main && process.argv[2] === "build") {
  const config = JSON.parse(process.argv[3]) as BrowserBuild;
  fixturePhase("build start");
  const result = await Bun.build({
    entrypoints: config.entrypoints, outdir: config.outdir, target: "browser",
    define: config.define, plugins: [{ name: "kitchen-isolated-resolver", setup(build) {
      build.onResolve({ filter: /.*/ }, ({ path, importer }) => {
        if (config.aliases?.[path]) return { path: config.aliases[path] };
        if (path.startsWith("@/")) return { path: Bun.resolveSync(resolve(config.resolveFrom, path.slice(2)), config.resolveFrom) };
        if (/^scheduler(\/|$)/.test(path)) return { path: Bun.resolveSync(path, dirname(importer)) };
        if (/^(react|react-dom)(\/|$)/.test(path)) return { path: Bun.resolveSync(path, config.resolveFrom) };
        return undefined;
      });
    } }],
  });
  if (!result.success) {
    console.error(result.logs.map(String).join("\n"));
    process.exitCode = 1;
  } else fixturePhase(`build complete outputs=${result.outputs.length}`);
}
