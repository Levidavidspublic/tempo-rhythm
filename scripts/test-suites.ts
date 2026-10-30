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
const TEST_FILE = /(?:\.test|\.spec|_test|_spec)\.(?:ts|tsx|js|jsx)$/;
const BROWSER_SUITE = /^tests\/unit\/kb-[^/]*\.test\.tsx$/;

// `bun run test --timeout=120000` forwards the option to this script. Those are bun-test flags,
// not suite names, so they are split out here and passed on to every `bun test` subprocess
// instead of being consumed as a group selector.
const argv = process.argv.slice(2);
const runnerFlags = argv.filter((arg) => arg.startsWith("-"));
const positional = argv.filter((arg) => !arg.startsWith("-"));

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
const browserSuites = unitTestFiles.filter((path) => BROWSER_SUITE.test(path));
const unitFiles = unitTestFiles.filter((path) => !BROWSER_SUITE.test(path));

if (browserSuites.length === 0) {
  console.error("no browser suite matched tests/unit/kb-*.test.tsx");
  process.exit(2);
}

async function run(args: string[], label: string): Promise<void> {
  console.log(`\n=== ${label}\n$ bun ${args.join(" ")}`);
  const proc = Bun.spawn({
    cmd: [process.execPath, ...args],
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    console.error(`\n${label} failed (exit ${code})`);
    process.exit(1);
  }
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
  for (const suite of selected) await run(["test", suite, ...runnerFlags, "--max-concurrency=1"], suite);
}

if (mode === "all" || mode === "unit") {
  await run(
    ["test", "convex", "apps/web/lib", "apps/web/components", "packages", ...unitFiles, ...runnerFlags],
    `unit tests (${unitFiles.length} files in tests/unit, browser suites excluded)`
  );
}
