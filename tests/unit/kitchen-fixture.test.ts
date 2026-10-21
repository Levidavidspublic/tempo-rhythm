import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cleanupFixture, requireFixtureSuccess, runIsolatedFixture } from "../helpers/kitchen-fixture";
import { isolatedBrowserBuild, waitForCommittedFocus, waitForSettledTransition } from "../helpers/kitchen-browser";

const root = join(import.meta.dir, "../..");
const helper = join(root, "tests/helpers/kitchen-fixture.ts");
const run = (source: string, extra: Partial<Parameters<typeof runIsolatedFixture>[0]> = {}) =>
  runIsolatedFixture({ command: [process.execPath, "-e", source], cwd: root, timeoutMs: 5_000, cleanupMs: 1_000, ...extra });

describe.serial("shared kitchen fixture lifecycle", () => {
  test("OS failure wins over printed successful assertions", async () => {
    const result = await run('console.log("all cases passed"); process.exitCode = 7');
    expect(result.code).toBe(7);
    expect(result.out).toContain("all cases passed");
    expect(() => requireFixtureSuccess(result)).toThrow("exit=7");
  });

  test("phase output is delivered while the child is still alive", async () => {
    const controller = new AbortController();
    let received = false;
    const result = await run('console.error("phase: browser ready"); setInterval(() => {}, 1000)', {
      signal: controller.signal,
      onOutput(_stream, text) {
        if (text.includes("phase: browser ready")) { received = true; controller.abort(); }
      },
    });
    expect(received).toBe(true);
    expect(result.cancelled).toBe(true);
    expect(result.code !== null || result.signal !== null).toBe(true);
    expect(() => requireFixtureSuccess(result)).toThrow("cancelled=true");
  });

  test("deadline bounds a child ignoring cancellation and reaps its real exit", async () => {
    const result = await run('process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)', { timeoutMs: 150, cleanupMs: 300 });
    expect(result.timedOut).toBe(true);
    expect(result.signal).toBe("SIGKILL");
    expect(() => process.kill(result.pid, 0)).toThrow();
    expect(() => requireFixtureSuccess(result)).toThrow("timeout=true");
  });

  test("pipe EOF alone cannot report a successful process exit", async () => {
    const result = await run('process.stdout.end(); process.stderr.end(); setInterval(() => {}, 1000)', { timeoutMs: 150, cleanupMs: 300 });
    expect(result.timedOut).toBe(true);
    expect(result.code).not.toBe(0);
    expect(() => requireFixtureSuccess(result)).toThrow();
  });

  test("retained evidence is bounded and truncated results cannot pass", async () => {
    const result = await run('console.log("x".repeat(4000))', { maxOutputBytes: 100 });
    expect(Buffer.byteLength(result.out)).toBeLessThanOrEqual(100);
    expect(result.outputTruncated).toBe(true);
    expect(() => requireFixtureSuccess(result)).toThrow();
  });

  test("an already cancelled invocation starts no fixture", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(run('process.exit(0)', { signal: controller.signal })).rejects.toThrow();
  });

  test("cleanup starts independently and preserves both rejections plus a stalled resource", async () => {
    const seen: string[] = [];
    let failure: AggregateError | undefined;
    try {
      await cleanupFixture({
        browser: () => { seen.push("browser"); return new Promise(() => {}); },
        server: () => { seen.push("server"); throw Error("server failed"); },
        directory: () => { seen.push("directory"); throw Error("directory failed"); },
      }, 40);
    } catch (error) { failure = error as AggregateError; }
    expect(seen).toEqual(["browser", "server", "directory"]);
    expect(failure?.errors).toHaveLength(3);
    expect(failure?.errors.map(String).join(" ")).toContain("cleanup browser");
    expect(failure?.errors.map(String).join(" ")).toContain("server failed");
    expect(failure?.errors.map(String).join(" ")).toContain("directory failed");
  });

  test("cancellation closes a real server and reaps an owned subprocess before child exit", async () => {
    const controller = new AbortController();
    let address = "";
    let descendantPid = 0;
    const source = `
      import { fixtureCleanup } from ${JSON.stringify(helper)};
      const subprocess = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdout: "ignore", stderr: "ignore" });
      const server = Bun.serve({hostname:"127.0.0.1",port:0,fetch:()=>new Response("ready")});
      fixtureCleanup({ server:()=>server.stop(true), browser:async()=>{subprocess.kill();await subprocess.exited;} }, 500);
      console.log("READY=" + JSON.stringify({address:server.url.href,pid:subprocess.pid}));
    `;
    const result = await run(source, {
      signal: controller.signal,
      onOutput(_stream, text) {
        const record = text.match(/READY=(\{[^\n]+\})/);
        if (record) {
          ({ address, pid: descendantPid } = JSON.parse(record[1]));
          controller.abort();
        }
      },
    });
    expect(result.cancelled).toBe(true);
    expect(result.code).toBe(1);
    expect(result.cleanupErrors).toEqual([]);
    expect(descendantPid).toBeGreaterThan(0);
    expect(() => process.kill(descendantPid, 0)).toThrow();
    await expect(fetch(address)).rejects.toThrow();
  });

  test("normal fixture exit reaps detached descendants that hold output pipes open", async () => {
    const result = await run(`
      import { spawn } from "node:child_process";
      const descendant = spawn(process.execPath, ["-e", "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"], { detached:true, stdio:"inherit" });
      descendant.unref();
      console.log("DESCENDANT=" + descendant.pid);
    `);
    requireFixtureSuccess(result);
    const pid = Number(result.out.match(/DESCENDANT=(\d+)/)?.[1]);
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
    expect(result.err).toContain("supervisor reaped all descendants");
  });

  test("a missing committed signal consumes the same bounded transition deadline", async () => {
    await expect(waitForSettledTransition({} as Parameters<typeof waitForSettledTransition>[0], new Promise(() => {}), 30))
      .rejects.toThrow("Committed transition signal timed out");
  });

  test("fresh browser builds resolve React scheduler from its actual importing package", async () => {
    const directory = await mkdtemp(join(tmpdir(), "kitchen-build-"));
    try {
      const entry = join(directory, "entry.tsx");
      await writeFile(entry, 'import React from "react"; import {createRoot} from "react-dom/client"; createRoot(document.getElementById("app")!).render(<button>Ready</button>);');
      await isolatedBrowserBuild({ cwd: root, resolveFrom: join(root, "apps/web"), entrypoints: [entry], outdir: join(directory, "out"), timeoutMs: 30_000, cleanupMs: 1_000 });
      const code = await readFile(join(directory, "out/entry.js"), "utf8");
      expect(code).toContain("Ready");
      expect(code).toContain("scheduler");
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 35_000);

  test("committed focus and settled transition use browser signals", async () => {
    const { chromium } = await import("@playwright/test");
    const executablePath = [chromium.executablePath(), "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].find(existsSync);
    if (!executablePath) throw new Error("No installed Chromium or Google Chrome is available for the shared fixture proof");
    const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setContent('<button id="target">Ready</button>');
      const target = page.locator("#target");
      await page.evaluate(() => requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("button")!.focus()));
      await waitForCommittedFocus(target, 5_000);
      let committed = false;
      await waitForSettledTransition(target, page.evaluate(() => {
        document.querySelector("button")!.animate([{ transform: "translateX(10px)" }, { transform: "translateX(0px)" }], { duration: 100, fill: "forwards" });
      }).then(() => { committed = true; }), 5_000);
      expect(committed).toBe(true);
      expect(await target.evaluate((element) => element.getAnimations().every((animation) => animation.playState === "finished"))).toBe(true);
    } finally { await browser.close(); }
  }, 10_000);
});
