// Ticket-writer check (Phase 06 Step 5). Validates one batch written by factory-write-tickets:
//   node scripts/factory/validate-tickets.mjs --batch B11 --size 9 [--hold] [--changed changed.txt]
// size 3 = 3 components (lanes claude, codex, cursor; no data ticket); 9 = 1 data + 8 components;
// 15 = 1 data + 14 components. hold -> every component has hold: true (data never).
// Every component has its OWN scope folder (no two components share or nest folders); the data
// ticket is the only one touching convex/ or the database folder. docs/contracts/<batch>.md exists.
// --changed: the PR's changed files; only docs/tickets/<batch>/ and docs/contracts/<batch>.md allowed.
// Batch loop (2026-10-06, factory/LOOP.md): any size 9..15 = ticket 0 (the data ticket, owns convex/) + 8..14
// components. For size >= 9 every component needs an explicit lane and `browser_test: true|false`:
//   browser_test: true  -> lane cursor or codex (they have cloud computers for real browser/Playwright checks)
//   browser_test: false -> lane claude
// Lane balance: each active lane (--lanes, default claude,codex,cursor) gets 2..5 components (2..7 when only two
// lanes are active). (3..5 per lane is the target; 8 components over 3 lanes can't all reach 3.)
import { readFile, access } from "node:fs/promises";
import { listTicketFiles, checkTicket } from "./tickets-lib.mjs";
import { scopeOf, truthy } from "./factory-lib.mjs";
import { summary } from "./gh-api.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const norm = (s) => s.replace(/^\.\//, "").replace(/\/?$/, "/");
const nested = (a, b) => norm(a).startsWith(norm(b)) || norm(b).startsWith(norm(a));
const DATA_DIRS = ["convex/", "db/", "drizzle/", "prisma/", "migrations/"];

export const LOOP_LANES = ["claude", "codex", "cursor"];
export const BROWSER_LANES = ["cursor", "codex"];

// Batch-loop lane routing for components (size >= 9). Returns problems.
export function loopRouting(comps, lanes = LOOP_LANES) {
  const problems = [], count = Object.fromEntries(lanes.map((l) => [l, 0]));
  for (const t of comps) {
    const id = t.fm.ticket, lane = t.fm.lane, bt = String(t.fm.browser_test ?? "");
    if (!["true", "false"].includes(bt)) { problems.push(`${id}: browser_test must be true or false (routes the lane)`); continue; }
    if (!lanes.includes(lane)) { problems.push(`${id}: lane must be one of ${lanes.join(", ")} (got ${lane || "none"})`); continue; }
    if (bt === "true" && !BROWSER_LANES.includes(lane)) problems.push(`${id}: browser_test: true needs lane cursor or codex (cloud computer), not ${lane}`);
    if (bt === "false" && lane !== "claude" && lanes.includes("claude")) problems.push(`${id}: browser_test: false goes to lane claude (got ${lane})`);
    count[lane]++;
  }
  const max = lanes.length >= 3 ? 5 : 7;
  for (const l of lanes) if (count[l] < 2 || count[l] > max) problems.push(`lane ${l} has ${count[l]} component(s); each active lane needs 2..${max}`);
  return problems;
}

export function validate({ batch, size, hold, files, changed, contractExists, lanes = LOOP_LANES }) {
  const problems = [], notes = [];
  const mine = files.filter((f) => f.path.startsWith(`docs/tickets/${batch}/`));
  const tickets = [];
  for (const f of mine) { const c = checkTicket(f.path, f.text); if (!c.ok) problems.push(`${f.path}: ${c.reason}`); else tickets.push({ ...c, path: f.path }); }
  const data = tickets.filter((t) => t.fm.type === "data"), comps = tickets.filter((t) => t.fm.type === "component");
  const want = size === 3 ? [0, 3] : size >= 9 && size <= 15 ? [1, size - 1] : null;
  if (!want) problems.push(`size ${size} is not 3 or 9..15`);
  else {
    if (mine.length !== size) problems.push(`expected ${size} ticket files in docs/tickets/${batch}/, found ${mine.length}`);
    if (data.length !== want[0]) problems.push(`expected ${want[0]} data ticket(s), found ${data.length}`);
    if (comps.length !== want[1]) problems.push(`expected ${want[1]} component tickets, found ${comps.length}`);
  }
  if (size === 3) { const lanes = comps.map((t) => t.fm.lane).sort().join(","); if (lanes !== "claude,codex,cursor") problems.push(`size 3 needs lanes claude, codex, cursor (one each); got ${lanes || "none"}`); }
  for (const t of tickets) {
    if (!t.path.endsWith(`/${t.fm.ticket}.md`)) problems.push(`${t.path}: file name should be ${t.fm.ticket}.md`);
    if (t.fm.type === "data" && truthy(t.fm.hold)) problems.push(`${t.path}: data ticket must not be on hold`);
    if (t.fm.type === "component" && hold && !truthy(t.fm.hold)) problems.push(`${t.path}: hold requested but hold is not true`);
    if (t.fm.type === "component" && !hold && truthy(t.fm.hold)) problems.push(`${t.path}: hold is true but hold was not requested`);
    if (t.fm.type === "component" && scopeOf(t.fm).some((s) => DATA_DIRS.some((d) => norm(s).startsWith(d)))) problems.push(`${t.path}: component scope touches the data folder`);
  }
  if (size >= 9 && comps.length) problems.push(...loopRouting(comps, lanes));
  for (let i = 0; i < comps.length; i++) for (let j = i + 1; j < comps.length; j++)
    for (const a of scopeOf(comps[i].fm)) for (const b of scopeOf(comps[j].fm))
      if (nested(a, b)) problems.push(`${comps[i].fm.ticket} and ${comps[j].fm.ticket} share scope ${a} / ${b} (separate folders required)`);
  if (!contractExists) problems.push(`docs/contracts/${batch}.md is missing`);
  if (changed) for (const p of changed) if (!(p.startsWith(`docs/tickets/${batch}/`) || p === `docs/contracts/${batch}.md`)) problems.push(`PR changes a file outside the batch: ${p}`);
  notes.push(`${tickets.length} valid tickets: ${data.length} data, ${comps.length} component.`);
  return { problems, notes, tickets };
}

async function main() {
  const batch = arg("--batch"), size = Number(arg("--size")), hold = process.argv.includes("--hold");
  if (!/^[A-Za-z0-9-]+$/.test(batch || "")) throw new Error("--batch must match ^[A-Za-z0-9-]+$");
  const changedFile = arg("--changed");
  const changed = changedFile ? (await readFile(changedFile, "utf8")).split("\n").map((s) => s.trim()).filter(Boolean) : null;
  const { files } = await listTicketFiles(".");
  const contractExists = await access(`docs/contracts/${batch}.md`).then(() => true, () => false);
  const lanes = (arg("--lanes", LOOP_LANES.join(",")) || "").split(",").map((x) => x.trim()).filter((x) => LOOP_LANES.includes(x));
  const r = validate({ batch, size, hold, files, changed, contractExists, lanes: lanes.length ? lanes : LOOP_LANES });
  await summary([`## Ticket check: batch ${batch}, size ${size}${hold ? ", hold" : ""}`, ...r.notes,
    ...r.tickets.map((t) => `- ${t.fm.ticket} (${t.fm.type}${t.fm.lane ? ", lane " + t.fm.lane : ""}${t.fm.browser_test !== undefined ? ", browser_test " + t.fm.browser_test : ""}) scope ${scopeOf(t.fm).join(", ")} — ${t.goal}`),
    r.problems.length ? `\nFAIL (${r.problems.length}):\n${r.problems.map((p) => "- " + p).join("\n")}` : "\nPASS"]);
  if (r.problems.length) process.exit(1);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(async (e) => { await summary([`FAIL: ${e.message}`]); process.exit(1); });
