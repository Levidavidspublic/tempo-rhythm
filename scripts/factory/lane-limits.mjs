// lane-limits: which build lane (agent) a ticket goes to, given usage limits and Amit's preference order.
// Single source of truth for next-tickets.mjs (factory dispatcher) and the label routers (dispatch-router.yml,
// agent-router.yml). Docs: docs/factory/AGENT-LIMITS.md.
//
// Repo variables (all optional):
//   FACTORY_CLAUDE_AT_LIMIT / FACTORY_CODEX_AT_LIMIT / FACTORY_CURSOR_AT_LIMIT  "true" = that agent is out of usage
//     (default false). An agent at its limit gets NO new tickets. Cursor at limit does NOT affect Bugbot or the
//     Cursor automations (they are not lanes and never read these vars).
//   FACTORY_AGENT_PREFERENCE  comma list, default "claude,codex,cursor". Unknown names are ignored; lanes left out are
//     appended in the default order, so a lane is never silently disabled (use *_AT_LIMIT for that).
// Rules:
//   - build tickets: balanced over the available lanes EXCEPT the last one in the preference; the last lane is a
//     fallback only (default: claude + codex share the work, cursor only when both are at their limit).
//   - browser_test tickets: the preference order with claude moved last (default codex, cursor, then claude; Codex has
//     Playwright in its environment).
//   - data tickets (convex/): claude, then the preference order.
//   - a pinned lane (front-matter lane_pin: true, or an explicit agent:/area: router choice) is kept unless that agent
//     is at its limit; then the first available lane in that ticket's order.
//   - nothing available (claude, codex and cursor all at their limit) -> MANUAL fallbacks, in this order:
//       1. freebuff (freebuff.com, free ad-supported agent built on Codebuff)  - skipped if FACTORY_FREEBUFF_AT_LIMIT=true
//       2. opencode (OpenCode: free models / Go plan; Amit's)                  - skipped if FACTORY_OPENCODE_AT_LIMIT=true
//     Neither has a GitHub trigger wired yet (OpenCode needs a key from Amit), so the caller labels the ticket
//     `agent:<fallback>` + `needs:manual-run` and starts nothing; Dots or Amit runs it by hand
//     (docs/factory/AGENT-LIMITS.md). This replaces blocked:amit. Only when BOTH are also at their limit does the
//     ticket get `blocked:amit` ("usage limits").
//   - There is NO pay-per-use fallback: claude (subscription OAuth), codex (ChatGPT plan), cursor (plan), then the free
//     Freebuff, then OpenCode free models / Go plan. Never a metered API key. Copilot is not a lane (last resort, by a
//     person only).
export const LANES = ["claude", "codex", "cursor"];
export const DEFAULT_PREFERENCE = "claude,codex,cursor";
export const USAGE_LIMITS = "usage limits";
// Manual fallbacks after the three lanes, in order (no GitHub trigger yet -> labels only, a person runs them).
export const MANUAL_FALLBACKS = ["freebuff", "opencode"];
export const fallbackLabels = (agent) => [`agent:${agent}`, "needs:manual-run"];
export const BLOCKED_LABEL = "blocked:amit";
const on = (v) => String(v ?? "").trim().toLowerCase() === "true";

export function preference(env = {}) {
  const listed = String(env.FACTORY_AGENT_PREFERENCE || DEFAULT_PREFERENCE).split(",").map((s) => s.trim().toLowerCase()).filter((l) => LANES.includes(l));
  const out = [...new Set(listed)];
  for (const l of LANES) if (!out.includes(l)) out.push(l);
  return out;
}

export function atLimit(env = {}) {
  return { claude: on(env.FACTORY_CLAUDE_AT_LIMIT), codex: on(env.FACTORY_CODEX_AT_LIMIT), cursor: on(env.FACTORY_CURSOR_AT_LIMIT),
    freebuff: on(env.FACTORY_FREEBUFF_AT_LIMIT), opencode: on(env.FACTORY_OPENCODE_AT_LIMIT) };
}

// Lanes that may get a new ticket, in preference order. codexMode "manual" (FACTORY_CODEX_MODE) also removes codex.
export function available(env = {}, { codexMode } = {}) {
  const lim = atLimit(env);
  return preference(env).filter((l) => !lim[l] && !(l === "codex" && codexMode === "manual"));
}

export function candidates(kind, env = {}) {
  const pref = preference(env);
  if (kind === "data") return ["claude", ...pref.filter((l) => l !== "claude")];
  if (kind === "browser") return [...pref.filter((l) => l !== "claude"), "claude"];
  return pref;
}

export const ticketKind = (fm = {}) => (fm.type === "data" ? "data" : ["true", true, "yes"].includes(fm.browser_test) ? "browser" : "build");

// claude, codex and cursor are all out for this ticket: first manual fallback not at its limit, else blocked:amit.
const manualFallback = (env, from) => {
  const lim = atLimit(env);
  const f = MANUAL_FALLBACKS.find((x) => !lim[x]);
  const base = from ? { from } : {};
  if (!f) return { lane: null, manual: false, blocked: true, labels: [BLOCKED_LABEL], ...base, reason: `${USAGE_LIMITS}: claude, codex, cursor, freebuff and opencode all at their limit -> blocked:amit` };
  return { lane: f, manual: true, labels: fallbackLabels(f), ...base, reason: `${USAGE_LIMITS}: claude, codex and cursor all at their limit -> ${f} (manual run)` };
};

// want: pinned lane or null. counts: { lane: n } tickets already in that lane (balancing build tickets).
export function chooseLane({ kind = "build", want = null, counts = {} } = {}, env = {}, opts = {}) {
  const lim = atLimit(env);
  const avail = new Set(available(env, opts));
  const pref = preference(env);
  const why = (l) => (lim[l] ? `${l} at usage limit` : `${l} off (FACTORY_CODEX_MODE=manual)`);
  if (want && LANES.includes(want)) {
    if (avail.has(want)) return { lane: want, reason: `lane ${want} kept` };
    const fb = candidates(kind, env).filter((l) => l !== want && avail.has(l));
    return fb.length ? { lane: fb[0], from: want, reason: `${why(want)} -> ${fb[0]}` } : manualFallback(env, want);
  }
  const cand = candidates(kind, env).filter((l) => avail.has(l));
  if (!cand.length) return manualFallback(env, null);
  if (kind !== "build") return { lane: cand[0], reason: `${kind} ticket -> ${cand[0]} (preference ${pref.join(",")})` };
  const last = pref[pref.length - 1];
  const early = cand.filter((l) => l !== last);
  const pool = early.length ? early : cand;
  const lane = pool.reduce((best, l) => ((counts[l] || 0) < (counts[best] || 0) ? l : best), pool[0]);
  return { lane, reason: `build ticket -> ${lane} (balanced over ${pool.join("+")}; preference ${pref.join(",")})` };
}

export function limitsSummary(env = {}, opts = {}) {
  const lim = atLimit(env);
  return { agent_preference: preference(env), at_limit: lim, available_lanes: available(env, opts), all_at_limit: available(env, opts).length === 0 };
}

// CLI for the bash routers: node lane-limits.mjs --want <lane> [--kind build|data|browser]
// Prints `lane=<claude|codex|cursor|freebuff|opencode or empty>`, `manual=<true|false>`, `labels=<comma list>` and
// `reason=<text>` (one line each). manual=true or an empty lane means: add `labels` and start nothing.
async function main() {
  const a = process.argv.slice(2);
  const arg = (k) => (a.includes(k) ? a[a.indexOf(k) + 1] : undefined);
  const want = arg("--want") || null;
  const kind = arg("--kind") || "build";
  if (want && !LANES.includes(want)) { console.error(`unknown lane ${want}`); process.exit(2); }
  if (!["build", "data", "browser"].includes(kind)) { console.error(`unknown kind ${kind}`); process.exit(2); }
  const r = chooseLane({ kind, want }, process.env);
  process.stdout.write(`lane=${r.lane || ""}\nmanual=${r.manual === true}\nlabels=${(r.labels || []).join(",")}\nreason=${r.reason.replace(/[\r\n]/g, " ")}\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
