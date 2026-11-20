// Quiet hours (Amit, 6 Oct 2026). Between FACTORY_QUIET_START (default 22) and FACTORY_QUIET_END (default 9),
// Asia/Jerusalem wall-clock time, the factory starts NOTHING NEW: no tickets, no status:ready promotion, no lane
// dispatch (Claude / Cursor / Codex), no new batch loop, no scheduled builder, no new cloud agent.
// Work already running may finish: lane FIX runs for an in-flight PR (fix_note), the merge queue, merge/finalize
// of an in-flight batch, and the required PR checks (ci, e2e-preview, secret-scan, config-guard, scope-guard)
// and convex-deploy-test are never gated. Policy: factory/LOOP.md "Quiet hours"; docs/factory/QUIET-HOURS.md.
//
// Repo/org variables: FACTORY_QUIET_START=22, FACTORY_QUIET_END=9 (whole hours 0-23; start inclusive, end
// exclusive; start == end = no window). FACTORY_QUIET_HOURS=off disables the gate (override). DST-safe: the
// hour is computed in Asia/Jerusalem, not UTC.
//
// CLI (used by .github/workflows/factory-quiet-hours.yml and directly by scripts):
//   node scripts/factory/quiet-hours.mjs --what "<what would start>"
//   env QUIET_EXEMPT=true + QUIET_EXEMPT_REASON="..." -> never quiet (in-flight fix, read-only dry run).
//   Prints a notice, writes quiet=true|false to $GITHUB_OUTPUT and the step summary. Always exits 0.
import { appendFile } from "node:fs/promises";

export const TZ = "Asia/Jerusalem";
export const DEFAULT_START = 22;
export const DEFAULT_END = 9;

export function jerusalemHour(now = new Date()) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(h) % 24;
}

// Whole hour 0-23, or the default (with a warning) for an empty / invalid value. Never throws: a typo in a
// variable must not break every factory workflow.
export function parseHour(value, fallback, warnings = []) {
  const s = value === undefined || value === null ? "" : String(value).trim();
  if (s === "") return fallback;
  const n = Number(s);
  if (Number.isInteger(n) && n >= 0 && n <= 23) return n;
  warnings.push(`invalid hour "${s}", using ${fallback}`);
  return fallback;
}

export function inWindow(hour, start, end) {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function quietHours({ env = process.env, now = new Date() } = {}) {
  const warnings = [];
  const start = parseHour(env.FACTORY_QUIET_START, DEFAULT_START, warnings);
  const end = parseHour(env.FACTORY_QUIET_END, DEFAULT_END, warnings);
  const off = String(env.FACTORY_QUIET_HOURS ?? "").trim().toLowerCase() === "off";
  const exempt = String(env.QUIET_EXEMPT ?? "").trim().toLowerCase() === "true";
  const hour = jerusalemHour(now);
  const inside = inWindow(hour, start, end);
  const quiet = inside && !off && !exempt;
  const window = `${String(start).padStart(2, "0")}:00-${String(end).padStart(2, "0")}:00 ${TZ}`;
  let reason;
  if (!inside) reason = `outside quiet hours (${window}; now ${hour}h)`;
  else if (off) reason = `inside quiet hours (${window}) but FACTORY_QUIET_HOURS=off`;
  else if (exempt) reason = `inside quiet hours (${window}) but exempt: ${env.QUIET_EXEMPT_REASON || "in-flight work"}`;
  else reason = `quiet hours, skipped (${window}; now ${hour}h)`;
  return { quiet, inside, hour, start, end, off, exempt, window, reason, warnings };
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--what");
  const what = i >= 0 ? args[i + 1] : "factory work";
  const r = quietHours();
  for (const w of r.warnings) console.log(`::warning::quiet-hours: ${w}`);
  console.log(r.quiet ? `::notice title=Quiet hours::${what}: ${r.reason}. Nothing new starts; it runs after ${String(r.end).padStart(2, "0")}:00.` : `quiet-hours: ${what}: ${r.reason}`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `quiet=${r.quiet}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `**Quiet hours** - ${what}: ${r.reason}.\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(async (e) => {
  console.log(`::warning::quiet-hours check failed (${e.message}); treating as not quiet`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, "quiet=false\n").catch(() => {});
  process.exit(0);
});
