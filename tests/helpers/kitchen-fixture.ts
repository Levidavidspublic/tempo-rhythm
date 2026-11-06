import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { constants } from "node:os";

// Linux CI supplies Python 3. A subreaper owns Chromium descendants even if they
// start separate sessions or their fixture parent exits before its pipes close.
const linuxSupervisor = String.raw`
import ctypes, json, os, signal, subprocess, sys
if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
    raise OSError(ctypes.get_errno(), "PR_SET_CHILD_SUBREAPER")
grace = float(sys.argv[1]) / 1000
token = sys.argv[2]
main_status = None
stopping = None

def children(pid):
    # Follow only this process's owned child links. A full /proc scan for each
    # descendant can spend the whole cleanup allowance on unrelated processes.
    result = set()
    try: tasks = os.listdir(f"/proc/{pid}/task")
    except (FileNotFoundError, ProcessLookupError): return []
    for task in tasks:
        try:
            with open(f"/proc/{pid}/task/{task}/children") as f:
                result.update(int(value) for value in f.read().split())
        except (FileNotFoundError, ProcessLookupError): pass
    return result

def terminate_tree(pid, signum):
    for descendant in children(pid):
        terminate_tree(descendant, signum)
        try: os.kill(descendant, signum)
        except ProcessLookupError: pass

def cancel(signum, frame):
    global stopping
    if stopping is None:
        stopping = True
        signal.setitimer(signal.ITIMER_REAL, grace / 2)
    terminate_tree(os.getpid(), signal.SIGTERM)

signal.signal(signal.SIGALRM, lambda signum, frame: terminate_tree(os.getpid(), signal.SIGKILL))
signal.signal(signal.SIGTERM, cancel)
signal.signal(signal.SIGINT, cancel)
child = subprocess.Popen(sys.argv[3:])
# A cancellation may arrive while Popen is establishing the child. Apply it to
# the newly owned process too, without restarting the existing cleanup timer.
if stopping: cancel(signal.SIGTERM, None)
while True:
    try:
        pid, status = os.waitpid(-1, 0)
    except ChildProcessError:
        break
    if pid:
        if pid == child.pid:
            main_status = os.waitstatus_to_exitcode(status)
            print("\nKITCHEN_CHILD_EXIT=" + json.dumps({"token":token,"code":main_status}), file=sys.stderr, flush=True)
            cancel(signal.SIGTERM, None)
        continue
signal.setitimer(signal.ITIMER_REAL, 0)
if main_status is None:
    raise RuntimeError("fixture child exit was not reaped")
print("[kitchen-fixture] supervisor reaped all descendants", file=sys.stderr, flush=True)
`;

export type FixtureRun = {
  pid: number;
  code: number | null;
  signal: NodeJS.Signals | null;
  out: string;
  err: string;
  timedOut: boolean;
  cancelled: boolean;
  cleanupErrors: unknown[];
  outputTruncated: boolean;
  supervisorCode?: number | null;
};
export type FixtureOptions = {
  command: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Execution deadline; retain the calling fixture's existing deadline. */
  timeoutMs: number;
  /** Existing cleanup allowance, separate from the execution deadline. */
  cleanupMs: number;
  signal?: AbortSignal;
  maxOutputBytes?: number;
  onOutput?: (stream: "stdout" | "stderr", chunk: string) => void;
};

/** Stream an execution milestone without waiting for buffered child completion. */
export function fixturePhase(name: string): void {
  process.stderr.write(`[kitchen-fixture] ${name}\n`);
}

/** Bound one operation while leaving its caller responsible for resource cancellation. */
function bounded<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Start every cleanup even if another throws or never settles; retain every failure. */
export async function cleanupFixture(
  resources: Record<string, () => unknown>, timeoutMs: number,
): Promise<void> {
  const outcomes = await Promise.allSettled(Object.entries(resources).map(([name, release]) =>
    bounded(Promise.resolve().then(release), timeoutMs, `cleanup ${name}`),
  ));
  const errors = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : []);
  if (errors.length) throw new AggregateError(errors, "Fixture cleanup failed");
}

/** Install in the child after allocating resources; the same cleanup owns normal and cancelled exit. */
export function fixtureCleanup(resources: Record<string, () => unknown>, timeoutMs: number): () => Promise<void> {
  let pending: Promise<void> | undefined;
  let interruptedSignal: "SIGINT" | "SIGTERM" | undefined;
  const cleanup = () => pending ??= cleanupFixture(resources, timeoutMs).finally(() => {
    process.off("SIGTERM", onTerminate);
    process.off("SIGINT", onInterrupt);
  });
  const onSignal = (signal: "SIGINT" | "SIGTERM") => {
    if (interruptedSignal) return;
    interruptedSignal = signal;
    process.exitCode = 1;
    void cleanup().catch((error) => { console.error(error); }).finally(() => {
      if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
    });
  };
  const onInterrupt = () => onSignal("SIGINT");
  const onTerminate = () => onSignal("SIGTERM");
  process.on("SIGTERM", onTerminate);
  process.on("SIGINT", onInterrupt);
  return cleanup;
}

type ProcessIdentity = { pid: number; start: string };
/** Read identity and ownership before recovering a direct Linux child's OS wait status. */
function linuxIdentity(pid: number): (ProcessIdentity & { state: string; parent: number }) | null {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
    return { pid, start: fields[19], state: fields[0], parent: Number(fields[1]) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
/** Capture Linux start time so cleanup never mistakes a reused PID for an owned child. */
async function identity(pid: number): Promise<ProcessIdentity | null> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    return { pid, start: stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
/** Enumerate tracked Linux descendants before cancellation; other platforms use the process group. */
async function descendants(pid: number): Promise<ProcessIdentity[]> {
  if (process.platform !== "linux") return [];
  let children: string;
  try { children = await readFile(`/proc/${pid}/task/${pid}/children`, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const result: ProcessIdentity[] = [];
  for (const child of children.trim().split(/\s+/).filter(Boolean).map(Number)) {
    result.push(...await descendants(child));
    const owned = await identity(child);
    if (owned) result.push(owned);
  }
  return result;
}
/** Signal an explicitly owned process or group, rejecting the caller's implicit PID-zero group. */
function signalProcess(pid: number, signal: NodeJS.Signals): void {
  if (!Number.isInteger(pid) || pid === 0) throw new Error("Refusing to signal an unowned process group");
  try { process.kill(pid, signal); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
}

/** OS exit events or an owned waitpid result are authoritative; EOF and printed passes never are. */
export async function runIsolatedFixture(options: FixtureOptions): Promise<FixtureRun> {
  if (!(options.timeoutMs > 0) || !(options.cleanupMs > 0)) throw new Error("Fixture deadlines must be positive");
  options.signal?.throwIfAborted();
  const supervised = process.platform === "linux";
  const token = crypto.randomUUID();
  const command = supervised ? ["python3", "-c", linuxSupervisor, String(options.cleanupMs), token, ...options.command] : options.command;
  const child = spawn(command[0], command.slice(1), {
    cwd: options.cwd, env: { ...process.env, ...options.env },
    detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
  });
  const result: FixtureRun = { pid: child.pid ?? 0, code: null, signal: null, out: "", err: "", timedOut: false, cancelled: false, cleanupErrors: [], outputTruncated: false };
  const spawnedIdentity = supervised && result.pid > 0 ? linuxIdentity(result.pid) : null;
  let exited = false;
  let checkingExit = false;
  let interruptedSignal: "SIGINT" | "SIGTERM" | undefined;
  const drained = new Set<string>();
  let supervisorSignal: NodeJS.Signals | null = null;
  let receipt = "";
  let receiptCount = 0;
  let stopping: Promise<void> | undefined;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const owned: ProcessIdentity[] = [];
  const recordError = (error: unknown) => result.cleanupErrors.push(error);
  let resolveExit!: () => void;
  let resolveClosed!: () => void;
  const finishDrain = () => { if (exited && drained.size === 2) resolveClosed(); };
  const recordExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (exited) return;
      exited = true;
      if (supervised) {
        result.supervisorCode = code;
        supervisorSignal = signal;
      } else {
        result.code = code;
        result.signal = signal;
      }
      fixturePhase(`exit pid=${result.pid} code=${code} signal=${signal ?? "none"}`);
      resolveExit();
      finishDrain();
  };
  const exit = new Promise<void>((resolve, reject) => {
    resolveExit = resolve;
    child.once("error", reject);
    child.once("exit", recordExit);
  });
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
    child.once("close", () => resolve());
  });
  // Bun can leave an owned zombie without delivering its ChildProcess exit event.
  // EOF/SIGCHLD trigger an OS wait; neither EOF, /proc nor the fixture receipt is
  // accepted as exit evidence. A matching waitpid return both proves and reaps it.
  const observeOsExit = async () => {
    if (!spawnedIdentity || exited || checkingExit) return;
    checkingExit = true;
    const stillOwnedZombie = () => {
      const current = linuxIdentity(result.pid);
      return current?.parent === process.pid && current.start === spawnedIdentity.start && current.state === "Z";
    };
    try {
      if (!stillOwnedZombie()) return;
      const { dlopen, ptr } = await import("bun:ffi");
      if (exited || !stillOwnedZombie()) return;
      const libc = dlopen("libc.so.6", { waitpid: { args: ["i32", "ptr", "i32"], returns: "i32" } });
      try {
        const status = new Int32Array(1);
        const reaped = libc.symbols.waitpid(result.pid, ptr(status), 1);
        if (reaped === result.pid) {
          const signum = status[0] & 0x7f;
          const signal = signum ? Object.entries(constants.signals).find(([, value]) => value === signum)?.[0] as NodeJS.Signals : null;
          fixturePhase(`waitpid reaped owned supervisor pid=${reaped} status=${status[0]}`);
          recordExit(signum ? null : (status[0] >>> 8) & 0xff, signal);
          child.unref();
        }
        // Zero means still running; ECHILD can mean Bun won the reap race. In
        // either case its event or another real signal must supply the status.
      } finally { libc.close(); }
    } catch (error) { recordError(error); }
    finally { checkingExit = false; }
  };
  for (const [name, stream] of [["stdout", child.stdout], ["stderr", child.stderr]] as const) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      const key = name === "stdout" ? "out" : "err";
      const retained = result[key] + chunk;
      const limit = options.maxOutputBytes ?? 1024 * 1024;
      if (Buffer.byteLength(retained) > limit) {
        result.outputTruncated = true;
        result[key] = Buffer.from(retained).subarray(-limit).toString("utf8");
      } else result[key] = retained;
      if (supervised && name === "stderr") {
        receipt += chunk;
        let newline: number;
        while ((newline = receipt.indexOf("\n")) !== -1) {
          const line = receipt.slice(0, newline);
          receipt = receipt.slice(newline + 1);
          if (line.startsWith("KITCHEN_CHILD_EXIT=")) {
            try {
              const record = JSON.parse(line.slice("KITCHEN_CHILD_EXIT=".length));
              // Nested isolated builds stream their own receipts through this pipe.
              if (record.token !== token) continue;
              if (!Number.isInteger(record.code)) throw new Error("Invalid child exit receipt");
              receiptCount++;
              if (record.code < 0) {
                result.signal = Object.entries(constants.signals).find(([, value]) => value === -record.code)?.[0] as NodeJS.Signals ?? null;
              } else result.code = record.code;
            } catch (error) { recordError(error); }
          }
        }
        if (receipt.length > 4096) receipt = receipt.slice(-4096);
      }
      // Stream immediately, while preserving bounded output for existing result protocols.
      process[name].write(chunk);
      try { options.onOutput?.(name, chunk); } catch (error) { recordError(error); void stop(); }
    });
    stream.on("end", () => {
      drained.add(name);
      fixturePhase(`${name} EOF pid=${result.pid} exit-observed=${exited}`);
      finishDrain();
      void observeOsExit();
      if (!exited && process.platform === "linux") {
        void Promise.all([readFile(`/proc/${result.pid}/stat`, "utf8"), readFile(`/proc/${result.pid}/wchan`, "utf8")])
          .then(([stat, wchan]) => fixturePhase(`EOF OS pid=${result.pid} stat=${stat.trim()} wchan=${wchan.trim()}`))
          .catch((error) => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") recordError(error); });
      }
    });
  }
  const killOwned = async () => {
    for (const candidate of owned) {
      try {
        if ((await identity(candidate.pid))?.start === candidate.start) signalProcess(candidate.pid, "SIGKILL");
      } catch (error) { recordError(error); }
    }
    try { if (result.pid) signalProcess(process.platform === "win32" ? result.pid : -result.pid, "SIGKILL"); }
    catch (error) { recordError(error); }
  };
  const stop = () => stopping ??= (async () => {
    // Spawn errors have no owned PID; zero would signal our entire process group.
    if (!Number.isInteger(result.pid) || result.pid <= 0) return;
    fixturePhase(`cancel pid=${result.pid} timeout=${result.timedOut}`);
    // Keep the parent alive briefly so its signal handler can close/reap browser children.
    forceTimer = setTimeout(() => { void killOwned(); }, options.cleanupMs * 0.75);
    try { if (!supervised) owned.push(...await descendants(result.pid)); } catch (error) { recordError(error); }
    try { if (!exited) signalProcess(result.pid, "SIGTERM"); } catch (error) { recordError(error); }
    try { await bounded(exit, options.cleanupMs, "child exit after cancellation"); }
    catch (error) { recordError(error); }
    await killOwned();
  })();
  const abort = () => { result.cancelled = true; void stop(); };
  const parentSignal = (signal: "SIGINT" | "SIGTERM") => {
    interruptedSignal ??= signal;
    result.cancelled = true;
    void stop();
  };
  const onInterrupt = () => parentSignal("SIGINT");
  const onTerminate = () => parentSignal("SIGTERM");
  const onChildSignal = () => { void observeOsExit(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  if (supervised) process.on("SIGCHLD", onChildSignal);
  const timer = setTimeout(() => { result.timedOut = true; void stop(); }, options.timeoutMs);
  fixturePhase(`start pid=${result.pid}`);
  try {
    await bounded(exit, options.timeoutMs + options.cleanupMs, "fixture lifecycle");
    if (stopping) await stopping;
    // A descendant holding inherited pipes must not hang result delivery after parent exit.
    await bounded(closed, options.cleanupMs, "fixture output close");
    // OS exit can arrive before the stderr receipt drains. Validate only after close.
    if (supervised && (supervisorSignal || result.supervisorCode !== 0 || receiptCount !== 1)) {
      recordError(new Error(`Supervisor exit=${result.supervisorCode} signal=${supervisorSignal} child receipts=${receiptCount}`));
    }
  } catch (error) {
    recordError(error);
    await stop();
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    options.signal?.removeEventListener("abort", abort);
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    if (supervised) process.off("SIGCHLD", onChildSignal);
    // Kill any owned process group even after a successful direct child exit.
    await killOwned();
    child.stdout.destroy();
    child.stderr.destroy();
    if (interruptedSignal && process.listenerCount(interruptedSignal) === 0) process.kill(process.pid, interruptedSignal);
  }
  return result;
}

/** Reject nonzero exits, incomplete evidence, cancellation and every retained cleanup failure. */
export function requireFixtureSuccess(result: FixtureRun): void {
  if (result.code !== 0 || result.signal || result.timedOut || result.cancelled || result.outputTruncated || result.cleanupErrors.length) {
    throw new AggregateError(result.cleanupErrors,
      `Fixture failed: exit=${result.code} signal=${result.signal ?? "none"} timeout=${result.timedOut} cancelled=${result.cancelled}\n${result.err.slice(-12000)}`);
  }
}
