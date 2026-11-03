// Runs loop scripts N times in a row and stops a loop at its first non-pass.
// Usage: node e2e/alpha/run.mjs [--times 5] [l1 l2 l3 l4 l5]
// A NETWORK attempt (the sandbox dropped a request and the run failed) neither passes nor breaks
// the streak: it is repeated, at most MAX_NETWORK_REPEATS times per loop, and counted in the summary.
// Exit: 0 when every loop passed N times in a row, otherwise the first non-pass code
// (1 FAIL, 2 BLOCKED_VERIFICATION, 3 NETWORK).
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = {
  l1: "l1-sign-in-today.mjs",
  l2: "l2-today-task.mjs",
  l3: "l3-template-slash.mjs",
  l4: "l4-coach-plan-undo.mjs",
  l5: "l5-decision-card.mjs",
};
const NAMES = { 0: "PASS", 1: "FAIL", 2: "BLOCKED_VERIFICATION", 3: "NETWORK" };
const NETWORK = 3;
const MAX_NETWORK_REPEATS = 5;

const args = process.argv.slice(2);
const timesAt = args.indexOf("--times");
const times = timesAt >= 0 ? Number(args[timesAt + 1]) : 5;
if (!Number.isInteger(times) || times < 1) {
  console.error("--times takes a whole number of at least 1");
  process.exit(1);
}
const picked = args.filter((_arg, i) => timesAt < 0 || (i !== timesAt && i !== timesAt + 1));
const loops = picked.length ? picked : Object.keys(SCRIPTS);
const unknown = loops.filter((l) => !SCRIPTS[l]);
if (unknown.length) {
  console.error(`unknown loop(s): ${unknown.join(", ")}`);
  process.exit(1);
}

const summary = [];
let worst = 0;
for (const loop of loops) {
  let inARow = 0;
  let networkRepeats = 0;
  let last = { code: 0, line: "" };
  for (let i = 1; i <= times; i += 1) {
    const run = spawnSync(process.execPath, [path.join(HERE, SCRIPTS[loop])], { encoding: "utf8", env: process.env });
    const line = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split("\n").at(-1) ?? "";
    last = { code: run.status ?? 1, line };
    console.log(`[${loop} ${i}/${times}] ${line}`);
    if (last.code === NETWORK && networkRepeats < MAX_NETWORK_REPEATS) {
      networkRepeats += 1;
      i -= 1;
      continue;
    }
    if (last.code !== 0) break;
    inARow += 1;
  }
  const result = inARow === times ? "PASS" : (NAMES[last.code] ?? "FAIL");
  summary.push({ loop, times, inARow, result, networkRepeats, last: last.line });
  if (last.code !== 0 && worst === 0) worst = last.code;
}

const outDir = process.env.ALPHA_OUT || path.join(HERE, "out");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify({ at: new Date().toISOString(), summary }, null, 2)}\n`);
console.log("\nloop | passes in a row | result");
for (const s of summary) {
  const repeats = s.networkRepeats ? ` (${s.networkRepeats} attempt(s) repeated after a sandbox network drop)` : "";
  console.log(`${s.loop} | ${s.inARow}/${s.times} | ${s.result}${repeats}`);
}
process.exit(worst);
