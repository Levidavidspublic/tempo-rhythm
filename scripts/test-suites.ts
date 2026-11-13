// Test entry point (`bun run test`, `bun run test:unit`, `bun run test:browser`).
//
// Ten suites in tests/unit boot their own Chromium and fixture server (tests/unit/kb-*.test.tsx).
// Bun runs test files one after another in a single process, so on a 4-core CI runner those suites
// inherit everything the earlier ~200 files left behind, and one starved suite takes the rest of the
// run down with it: the 2026-10-28 merge-queue Test job failed 23 KB-64 tests at 30s each plus a
// beforeEach hook timeout, and the whole run took 962s instead of 279s.
//
// So the two groups run apart:
//   browser  one suite at a time, each in its own bun process, --max-concurrency=1
//   unit     everything else, in one `bun test` with the same targets as before
//   all      browser, then unit (`bun run test`; unit runs last because it is the cheap group)
//
// No test is skipped or moved: every file bun discovers under tests/unit still runs exactly once.

const root = `${import.meta.dir}/..`;
// Every suffix and extension bun test discovers: .test/.spec/_test/_spec with js/jsx/ts/tsx/mjs/cjs/mts/cts.
const TEST_FILE = /(?:\.test|\.spec|_test|_spec)\.(?:[mc]?[jt]s|[jt]sx)$/i;
// Anything that looks like a test file; used to fail loudly if TEST_FILE ever misses one.
const TEST_LIKE = /(?:\.test|\.spec|_test|_spec)\.[^/.]+$/i;
const BROWSER_SUITE = /^tests\/unit\/kb-[^/]*\.test\.tsx$/;

// `bun run test --timeout=120000` forwards the option to this script. Those are bun-test flags,
// not suite names, so they are split out here and passed on to every `bun test` subprocess
// instead of being consumed as a group selector.
// Bun takes a flag's value from the next token too (`--timeout 120000`), so a value-taking flag
// keeps the token after it; otherwise the value would be read as a browser-suite name and `all`
// would exit 2 without running a test.
const VALUE_FLAGS = new Set([
  "-t",
  "--test-name-pattern",
  "--timeout",
  "--rerun-each",
  "--retry",
  "--seed",
  "--bail",
  "--reporter",
  "--reporter-outfile",
  "--max-concurrency",
  "--path-ignore-patterns",
  "--changed",
  "--parallel",
  "--parallel-delay",
  "--shard",
  "--timings",
  "--coverage-reporter",
  "--coverage-dir",
]);

// A name filter applies inside every subprocess, and bun exits 1 when one process contains no
// matching test, which would otherwise stop the run at the first suite that has none. That exit is
// recognised from bun's own "matched 0 tests" report and the run continues; the filter is judged
// once for the whole run at the end, so an empty match still fails.
const NAME_FILTER = /^(?:-t|--test-name-pattern)(?:=|$)/;
const MATCHED_NOTHING = /error: regex "[^"]*" matched 0 tests\./;

const argv = process.argv.slice(2);
const runnerFlags: string[] = [];
const positional: string[] = [];
let i = 0;
while (i < argv.length) {
  const arg = argv[i] ?? "";
  i += 1;
  if (!arg.startsWith("-")) {
    positional.push(arg);
    continue;
  }
  runnerFlags.push(arg);
  const value = VALUE_FLAGS.has(arg) ? argv[i] : undefined;
  if (value !== undefined) {
    runnerFlags.push(value);
    i += 1;
  }
}

const mode = positional[0] ?? "all";
// Optional: name browser suites to run (debugging one suite serially).
const only = positional.slice(1);
if (!["all", "unit", "browser"].includes(mode)) {
  console.error(
    `usage: bun scripts/test-suites.ts [all|unit|browser] [tests/unit/kb-*.test.tsx...] [--bun-test-flags] (got "${mode}")`
  );
  process.exit(2);
}

// Bun's own discovery suffixes for tests/unit, so the split cannot drop a file bun would run.
const unitTestFiles = [...new Bun.Glob("tests/unit/**/*").scanSync({ cwd: root, onlyFiles: true })]
  .filter((path) => TEST_FILE.test(path))
  .sort();
const missed = [...new Bun.Glob("tests/unit/**/*").scanSync({ cwd: root, onlyFiles: true })].filter(
  (path) => TEST_LIKE.test(path) && !TEST_FILE.test(path)
);
if (missed.length > 0) {
  console.error(`test-like files TEST_FILE does not match, so they would not run:\n${missed.join("\n")}`);
  process.exit(2);
}
const browserSuites = unitTestFiles.filter((path) => BROWSER_SUITE.test(path));
const unitFiles = unitTestFiles.filter((path) => !BROWSER_SUITE.test(path));

if (browserSuites.length === 0) {
  console.error("no browser suite matched tests/unit/kb-*.test.tsx");
  process.exit(2);
}

const nameFiltered = runnerFlags.some((arg) => NAME_FILTER.test(arg));
// Groups whose subprocess exited 0, so some test matched the filter there.
let matchedGroups = 0;

// Split runs start several bun processes, which changes what two kinds of flag mean. Both are
// rejected instead of misbehaving silently; both are fine in `unit` mode, which is one process.
const watched = runnerFlags.includes("--watch") || runnerFlags.includes("-w");
// bun writes report files at the end of each run, so a forwarded output path would be rewritten by
// every group and keep only the last group's results.
const fileOutputFlag = runnerFlags.find(
  (arg) =>
    /^--reporter-outfile(?:=|$)/.test(arg) ||
    /^--coverage-dir(?:=|$)/.test(arg) ||
    /^--coverage-reporter=.*lcov/.test(arg)
);

function rejectFlagsThatNeedOneProcess(runs: number): void {
  if (runs < 2) return;
  if (watched) {
    console.error(
      `--watch would open a watcher on the first of ${runs} bun processes, so the rest would never start.\n` +
        `Run the file you are editing directly instead: bun test <path> --watch`
    );
    process.exit(2);
  }
  if (fileOutputFlag !== undefined) {
    console.error(
      `${fileOutputFlag} would be written by each of ${runs} bun processes, keeping only the last group's results.\n` +
        `Run the group you need directly instead, or drop the flag.`
    );
    process.exit(2);
  }
}

async function run(args: string[], label: string): Promise<void> {
  console.log(`\n=== ${label}\n$ bun ${args.join(" ")}`);
  // A filtered run reads its own output, to tell "this group matched nothing" from a real failure;
  // an unfiltered run streams straight through.
  const proc = Bun.spawn({
    cmd: [process.execPath, ...args],
    cwd: root,
    stdout: nameFiltered ? "pipe" : "inherit",
    stderr: nameFiltered ? "pipe" : "inherit",
  });
  let output = "";
  if (nameFiltered && proc.stdout && proc.stderr) {
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    process.stdout.write(out);
    process.stderr.write(err);
    output = `${out}${err}`;
  }
  const code = await proc.exited;
  if (code === 0) {
    matchedGroups += 1;
    return;
  }
  // A suite that found no test for the filter is not a failure of the run; the whole-run check
  // below still fails when no suite matched one.
  if (nameFiltered && MATCHED_NOTHING.test(output)) return;
  console.error(`\n${label} failed (exit ${code})`);
  process.exit(1);
}

if (mode === "all" || mode === "browser") {
  // One suite at a time: one Chromium, one fixture server, the whole runner to itself.
  const selected = only.length
    ? browserSuites.filter((suite) =>
        only.some((name) => suite === name || suite.endsWith(`/${name}`))
      )
    : browserSuites;
  if (selected.length === 0) {
    console.error(`no browser suite matched ${only.join(", ")}`);
    process.exit(2);
  }
  // --max-concurrency=1 last, so a forwarded --max-concurrency cannot re-parallelise the group.
  rejectFlagsThatNeedOneProcess(mode === "all" ? selected.length + 1 : selected.length);
  for (const suite of selected) await run(["test", suite, ...runnerFlags, "--max-concurrency=1"], suite);
}

if (mode === "all" || mode === "unit") {
  await run(
    [
      "test",
      "convex",
      "apps/web/lib",
      "apps/web/components",
      "packages",
      ...unitFiles,
      ...runnerFlags,
    ],
    `unit tests (${unitFiles.length} files in tests/unit, browser suites excluded)`
  );
}

if (nameFiltered && matchedGroups === 0) {
  console.error(
    `no test matched the name filter in any suite (${runnerFlags.join(" ")}).\n` +
      `Every selected suite filtered its tests out, so nothing ran.`
  );
  process.exit(1);
}
