import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cleanupFixture, requireFixtureSuccess, runIsolatedFixture } from "../helpers/kitchen-fixture";
import { isolatedBrowserBuild, waitForCommittedFocus, waitForSettledTransition } from "../helpers/kitchen-browser";

const root = join(import.meta.dir, "../..");
const helper = join(root, "tests/helpers/kitchen-fixture.ts");
/** Run every controlled fault in its own process so module mocks cannot leak to the suite. */
const run = (source: string, extra: Partial<Parameters<typeof runIsolatedFixture>[0]> = {}) =>
  runIsolatedFixture({ command: [process.execPath, "-e", source], cwd: root, timeoutMs: 5_000, cleanupMs: 1_000, ...extra });

/** Non-Linux runtimes have no waitpid recovery: absent OS notifications must fail closed. */
const nativeMissingExitProof = `
  import { mock } from "bun:test";
  import { spawn as realSpawn } from "node:child_process";
  const nativeSpawn = realSpawn;
  mock.module("node:child_process", () => ({ spawn(...args) {
    const child = nativeSpawn(...args);
    const once = child.once.bind(child);
    child.once = (name, listener) => name === "exit" ? child : once(name, listener);
    return child;
  } }));
  const { runIsolatedFixture, requireFixtureSuccess } = await import(${JSON.stringify(helper)});
  const result = await runIsolatedFixture({command:[process.execPath,"-e","process.stdout.write('stdout drained'); process.stderr.write('tail without newline'); process.exitCode=23"],cwd:${JSON.stringify(root)},timeoutMs:1000,cleanupMs:500});
  if (!result.out.includes("stdout drained") || !result.err.includes("tail without newline")) throw Error("Output evidence was lost");
  if (result.code !== null || !result.timedOut || result.cleanupErrors.length === 0) throw Error("Missing exit notification was accepted");
  let rejected = false; try { requireFixtureSuccess(result); } catch { rejected = true; }
  if (!rejected) throw Error("Unknown exit was accepted");
  let alive = true; try { process.kill(result.pid,0); } catch { alive = false; }
  if (alive) throw Error("Native child was not reaped");
  console.log("missing native exit fails after both streams drain");
`;

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
      // This caller deliberately owns code-1 termination; the default signal path is proved separately.
      process.on("SIGTERM", () => { process.exitCode = 1; });
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
      const descendant = spawn(process.execPath, ["-e", "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"], { detached:process.platform === "linux", stdio:"inherit" });
      descendant.unref();
      console.log("DESCENDANT=" + descendant.pid);
    `);
    requireFixtureSuccess(result);
    const pid = Number(result.out.match(/DESCENDANT=(\d+)/)?.[1]);
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
    if (process.platform === "linux") expect(result.err).toContain("supervisor reaped all descendants");
    else expect(result.code).toBe(0);
  });

  test("a missing committed signal consumes the same bounded transition deadline", async () => {
    await expect(waitForSettledTransition({} as Parameters<typeof waitForSettledTransition>[0], new Promise(() => {}), 30))
      .rejects.toThrow("Committed transition signal timed out");
  });

  test("nested isolated builds retain separate authoritative child exits", async () => {
    for (const code of [0, 17]) {
      const result = await run(`
        import { runIsolatedFixture, requireFixtureSuccess } from ${JSON.stringify(helper)};
        const nested = await runIsolatedFixture({ command:[process.execPath,"-e","process.exit(${code})"], cwd:${JSON.stringify(root)}, timeoutMs:1000, cleanupMs:500 });
        requireFixtureSuccess(nested);
      `);
      if (code === 0) requireFixtureSuccess(result);
      else {
        expect(result.code).not.toBe(0);
        expect(() => requireFixtureSuccess(result)).toThrow();
      }
      expect(result.cleanupErrors).toEqual([]);
      if (process.platform === "linux") expect(result.err.match(/KITCHEN_CHILD_EXIT=/g)?.length).toBe(2);
      else expect(result.supervisorCode).toBeUndefined();
    }
  });

  test("child exit receipt is checked after stderr drains even when OS exit arrives first", async () => {
    const result = await run(`
      import { mock } from "bun:test";
      import { spawn as realSpawn } from "node:child_process";
      const nativeSpawn = realSpawn;
      mock.module("node:child_process", () => ({ spawn(...args) {
        const child = nativeSpawn(...args);
        child.stderr.pause();
        child.once("exit", () => queueMicrotask(() => child.stderr.resume()));
        return child;
      } }));
      const { runIsolatedFixture, requireFixtureSuccess } = await import(${JSON.stringify(helper)});
      const delayed = await runIsolatedFixture({command:[process.execPath,"-e","process.exit(0)"],cwd:${JSON.stringify(root)},timeoutMs:1000,cleanupMs:500});
      requireFixtureSuccess(delayed);
      console.log("delayed receipt accepted after close");
    `);
    requireFixtureSuccess(result);
    expect(result.out).toContain("delayed receipt accepted after close");
  });

  test("spawn failure reports the error without signaling PID zero or the caller group", async () => {
    const result = await run(`
      import { runIsolatedFixture, requireFixtureSuccess } from ${JSON.stringify(helper)};
      const missing = await runIsolatedFixture({command:["/missing-kitchen-fixture-bin/bun"],cwd:${JSON.stringify(root)},env:{PATH:"/missing-kitchen-fixture-bin"},timeoutMs:1000,cleanupMs:500});
      if (missing.pid !== 0 || missing.cleanupErrors.length === 0) throw Error("Expected missing executable evidence");
      let rejected = false;
      try { requireFixtureSuccess(missing); } catch { rejected = true; }
      if (!rejected) throw Error("Spawn failure was accepted");
      console.log("caller survives spawn failure");
    `);
    requireFixtureSuccess(result);
    expect(result.out).toContain("caller survives spawn failure");
  });

  test("owned OS wait status recovers a missing runtime exit event after both pipes drain", async () => {
    if (process.platform !== "linux") {
      const result = await run(nativeMissingExitProof);
      requireFixtureSuccess(result);
      expect(result.out).toContain("missing native exit fails after both streams drain");
      expect(result.err).not.toContain("waitpid reaped owned supervisor");
      return;
    }
    const result = await run(`
      import { mock } from "bun:test";
      import { dlopen, ptr } from "bun:ffi";
      import { createReadStream } from "node:fs";
      import { EventEmitter } from "node:events";
      const libc = dlopen("libc.so.6", {
        pipe:{args:["ptr"],returns:"i32"}, close:{args:["i32"],returns:"i32"},
        posix_spawn_file_actions_init:{args:["ptr"],returns:"i32"},
        posix_spawn_file_actions_adddup2:{args:["ptr","i32","i32"],returns:"i32"},
        posix_spawn_file_actions_addclose:{args:["ptr","i32"],returns:"i32"},
        posix_spawn_file_actions_destroy:{args:["ptr"],returns:"i32"},
        posix_spawnp:{args:["ptr","ptr","ptr","ptr","ptr","ptr"],returns:"i32"},
      });
      const check = (code) => { if (code !== 0) throw Error("Native spawn failed: " + code); };
      // This real child is deliberately absent from Bun's process watcher: no
      // synthetic exit/close event is emitted. Only OS waitpid can reap it.
      mock.module("node:child_process", () => ({ spawn(command, args, options) {
        const strings = [command,...args].map(value => Buffer.from(value + "\\0"));
        const argv = new BigUint64Array([...strings.map(value => BigInt(ptr(value))),0n]);
        const environment = Object.entries(options.env).map(([key,value]) => Buffer.from(key + "=" + value + "\\0"));
        const envp = new BigUint64Array([...environment.map(value => BigInt(ptr(value))),0n]);
        const actions = new Uint8Array(512);
        const pid = new Int32Array(1);
        const stdout = new Int32Array(2), stderr = new Int32Array(2);
        check(libc.symbols.posix_spawn_file_actions_init(ptr(actions)));
        for (const [fds, target] of [[stdout,1],[stderr,2]]) {
          check(libc.symbols.pipe(ptr(fds)));
          check(libc.symbols.posix_spawn_file_actions_adddup2(ptr(actions),fds[1],target));
          check(libc.symbols.posix_spawn_file_actions_addclose(ptr(actions),fds[0]));
          check(libc.symbols.posix_spawn_file_actions_addclose(ptr(actions),fds[1]));
        }
        check(libc.symbols.posix_spawnp(ptr(pid),ptr(strings[0]),ptr(actions),null,ptr(argv),ptr(envp)));
        check(libc.symbols.posix_spawn_file_actions_destroy(ptr(actions)));
        libc.symbols.close(stdout[1]); libc.symbols.close(stderr[1]);
        return Object.assign(new EventEmitter(), {
          pid:pid[0], stdout:createReadStream("",{fd:stdout[0],autoClose:true}),
          stderr:createReadStream("",{fd:stderr[0],autoClose:true}), unref() {},
        });
      } }));
      const { runIsolatedFixture, requireFixtureSuccess } = await import(${JSON.stringify(helper)});
      const recovered = await runIsolatedFixture({command:[process.execPath,"-e","process.stderr.write('tail without newline'); process.exitCode=23"],cwd:${JSON.stringify(root)},timeoutMs:1000,cleanupMs:500});
      if (recovered.code !== 23 || recovered.supervisorCode !== 0 || recovered.cleanupErrors.length || recovered.timedOut) throw Error("Lost authoritative OS status");
      let alive = true; try { process.kill(recovered.pid,0); } catch { alive = false; }
      if (alive) throw Error("Owned supervisor was not reaped");
      if (!recovered.err.includes("tail without newline") || !recovered.err.includes("supervisor reaped all descendants")) throw Error("Both streams did not drain");
      let rejected = false; try { requireFixtureSuccess(recovered); } catch { rejected = true; }
      if (!rejected) throw Error("Actual fixture failure was masked");
      libc.close();
      console.log("owned OS status recovered and reaped after drain");
    `);
    requireFixtureSuccess(result);
    expect(result.out).toContain("owned OS status recovered and reaped after drain");
    expect(result.err).toContain("waitpid reaped owned supervisor");
  });

  test("stderr without a final newline cannot hide the authoritative receipt", async () => {
    const result = await run('process.stderr.write("no trailing newline")');
    requireFixtureSuccess(result);
    if (process.platform === "linux") expect(result.err).toContain("no trailing newline\nKITCHEN_CHILD_EXIT=");
    else {
      expect(result.err).toBe("no trailing newline");
      expect(result.code).toBe(0);
      expect(result.supervisorCode).toBeUndefined();
    }
  });

  test("native fallback does not accept drained output without an exit notification", async () => {
    const result = await run(`
      // Exercise the native POSIX path on Linux too, inside this isolated child only.
      if (process.platform === "linux") Object.defineProperty(process,"platform",{value:"darwin"});
      ${nativeMissingExitProof}
    `);
    requireFixtureSuccess(result);
    expect(result.out).toContain("missing native exit fails after both streams drain");
  });

  test("child cleanup preserves the original termination signal after success or failure", async () => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      for (const failCleanup of [false, true]) {
        let signalled = false;
        const result = await run(`
          import { fixtureCleanup } from ${JSON.stringify(helper)};
          const keepAlive = setInterval(()=>{},1000);
          fixtureCleanup({resource:async()=>{
            await Promise.resolve();
            clearInterval(keepAlive);
            console.log("CHILD_CLEANED");
            ${failCleanup ? 'throw Error("controlled cleanup rejection");' : ""}
          }},500);
          console.log("SIGNAL_CHILD=" + process.pid);
        `, { onOutput(_stream, chunk) {
          const match = chunk.match(/SIGNAL_CHILD=(\d+)/);
          if (match && !signalled) { signalled = true; process.kill(Number(match[1]), signal); }
        } });
        expect(signalled).toBe(true);
        expect(result.out).toContain("CHILD_CLEANED");
        expect(result.signal).toBe(signal);
        expect(result.code).toBeNull();
        expect(result.cleanupErrors).toEqual([]);
        if (failCleanup) expect(result.err).toContain("controlled cleanup rejection");
      }
    }
  });

  test("parent termination is restored after owned cleanup unless another listener owns it", async () => {
    for (const otherOwner of [false, true]) {
      let signalled = false;
      const result = await run(`
        import { runIsolatedFixture } from ${JSON.stringify(helper)};
        ${otherOwner ? 'process.on("SIGTERM", () => console.log("other listener owns termination"));' : ""}
        const pending = runIsolatedFixture({command:[process.execPath,"-e","setInterval(()=>{},1000)"],cwd:${JSON.stringify(root)},timeoutMs:1000,cleanupMs:500});
        console.log("SIGNAL_PARENT=" + process.pid);
        const result = await pending;
        if (!result.cancelled) throw Error("Cancellation was lost");
        console.log("caller retained by other listener");
      `, { onOutput(_stream, chunk) {
        const match = chunk.match(/SIGNAL_PARENT=(\d+)/);
        if (match && !signalled) { signalled = true; process.kill(Number(match[1]), "SIGTERM"); }
      } });
      expect(signalled).toBe(true);
      if (otherOwner) {
        requireFixtureSuccess(result);
        expect(result.out).toContain("caller retained by other listener");
      } else {
        expect(result.signal).toBe("SIGTERM");
        expect(result.out).not.toContain("caller retained by other listener");
      }
    }
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
