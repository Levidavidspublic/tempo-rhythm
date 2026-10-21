import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { constants } from "node:os";

// Linux CI supplies Python 3. A subreaper owns Chromium descendants even if they
// start separate sessions or their fixture parent exits before its pipes close.
const linuxSupervisor = String.raw`
import ctypes, json, os, signal, subprocess, sys, time
if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
    raise OSError(ctypes.get_errno(), "PR_SET_CHILD_SUBREAPER")
grace = float(sys.argv[1]) / 1000
token = sys.argv[2]
child = subprocess.Popen(sys.argv[3:])
main_status = None
stopping = None

def children(pid):
    result = []
    for name in os.listdir("/proc"):
        if not name.isdigit(): continue
        try:
            with open(f"/proc/{name}/stat") as f: stat = f.read()
            fields = stat[stat.rfind(")") + 2:].split()
            if int(fields[1]) == pid: result.append(int(name))
        except (FileNotFoundError, ProcessLookupError): pass
    return result

def terminate_tree(pid, signum):
    for descendant in children(pid):
        terminate_tree(descendant, signum)
        try: os.kill(descendant, signum)
        except ProcessLookupError: pass

def cancel(signum, frame):
    global stopping
    if stopping is None: stopping = time.monotonic()
    terminate_tree(os.getpid(), signal.SIGTERM)

signal.signal(signal.SIGTERM, cancel)
signal.signal(signal.SIGINT, cancel)
while True:
    try:
        pid, status = os.waitpid(-1, os.WNOHANG)
    except ChildProcessError:
        break
    if pid:
        if pid == child.pid:
            main_status = os.waitstatus_to_exitcode(status)
            print("KITCHEN_CHILD_EXIT=" + json.dumps({"token":token,"code":main_status}), file=sys.stderr, flush=True)
            if stopping is None: stopping = time.monotonic()
            terminate_tree(os.getpid(), signal.SIGTERM)
        continue
    if stopping is not None and time.monotonic() - stopping >= grace / 2:
        terminate_tree(os.getpid(), signal.SIGKILL)
    # This is an OS reap loop, not a browser/readiness sleep. It never advances an assertion.
    time.sleep(0.005)
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

export function fixturePhase(name: string): void {
  process.stderr.write(`[kitchen-fixture] ${name}\n`);
}

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
  const cleanup = () => pending ??= cleanupFixture(resources, timeoutMs).finally(() => {
    process.off("SIGTERM", onSignal);
    process.off("SIGINT", onSignal);
  });
  const onSignal = () => {
    process.exitCode = 1;
    void cleanup().catch((error) => { console.error(error); });
  };
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
  return cleanup;
}

type ProcessIdentity = { pid: number; start: string };
async function identity(pid: number): Promise<ProcessIdentity | null> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    return { pid, start: stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
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
function signalProcess(pid: number, signal: NodeJS.Signals): void {
  try { process.kill(pid, signal); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
}

/** Node's OS exit event is authoritative; pipe EOF and printed pass records never imply success. */
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
  let exited = false;
  let receipt = "";
  let receiptCount = 0;
  let stopping: Promise<void> | undefined;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const owned: ProcessIdentity[] = [];
  const recordError = (error: unknown) => result.cleanupErrors.push(error);
  const exit = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      exited = true;
      if (supervised) {
        result.supervisorCode = code;
        if (signal || code !== 0 || receiptCount !== 1) recordError(new Error(`Supervisor exit=${code} signal=${signal} child receipts=${receiptCount}`));
      } else {
        result.code = code;
        result.signal = signal;
      }
      fixturePhase(`exit pid=${result.pid} code=${code} signal=${signal ?? "none"}`);
      resolve();
    });
  });
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
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
              if (record.token !== token || !Number.isInteger(record.code)) throw new Error("Invalid child exit receipt");
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
      fixturePhase(`${name} EOF pid=${result.pid} exit-observed=${exited}`);
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
    fixturePhase(`cancel pid=${result.pid} timeout=${result.timedOut}`);
    // Keep the parent alive briefly so its signal handler can close/reap browser children.
    forceTimer = setTimeout(() => { void killOwned(); }, options.cleanupMs);
    try { if (!supervised) owned.push(...await descendants(result.pid)); } catch (error) { recordError(error); }
    try { if (!exited) signalProcess(result.pid, "SIGTERM"); } catch (error) { recordError(error); }
    try { await bounded(exit, options.cleanupMs, "child exit after cancellation"); }
    catch (error) { recordError(error); }
    await killOwned();
  })();
  const abort = () => { result.cancelled = true; void stop(); };
  const parentSignal = () => { result.cancelled = true; void stop(); };
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  process.on("SIGINT", parentSignal);
  process.on("SIGTERM", parentSignal);
  const timer = setTimeout(() => { result.timedOut = true; void stop(); }, options.timeoutMs);
  fixturePhase(`start pid=${result.pid}`);
  try {
    await bounded(exit, options.timeoutMs + options.cleanupMs, "fixture lifecycle");
    if (stopping) await stopping;
    // A descendant holding inherited pipes must not hang result delivery after parent exit.
    await bounded(closed, options.cleanupMs, "fixture output close");
  } catch (error) {
    recordError(error);
    await stop();
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    options.signal?.removeEventListener("abort", abort);
    process.off("SIGINT", parentSignal);
    process.off("SIGTERM", parentSignal);
    // Kill any owned process group even after a successful direct child exit.
    await killOwned();
    child.stdout.destroy();
    child.stderr.destroy();
  }
  return result;
}

export function requireFixtureSuccess(result: FixtureRun): void {
  if (result.code !== 0 || result.signal || result.timedOut || result.cancelled || result.outputTruncated || result.cleanupErrors.length) {
    throw new AggregateError(result.cleanupErrors,
      `Fixture failed: exit=${result.code} signal=${result.signal ?? "none"} timeout=${result.timedOut} cancelled=${result.cancelled}\n${result.err.slice(-12000)}`);
  }
}
