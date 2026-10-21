// batch-loop (2026-10-06, factory/LOOP.md). ONE Cursor Bugbot review per factory loop instead of one per PR.
// A loop = ticket 0 (convex architecture, type: data, lands on integration first) + 8-14 component PRs.
// Component PRs get CI only. When they are CI-green this script:
//   build    creates batch/<loop-id> from integration (if missing); for each ready component PR: retargets
//            its base to batch/<loop-id>, then merges its head commit into the batch branch with the merges
//            API (POST /merges, a merge commit). GitHub then marks the PR "merged" into the batch branch
//            (history kept). Works on DRAFT PRs on purpose: component PRs stay draft so Bugbot (which
//            auto-reviews non-draft PRs on every push while the dashboard auto-run is on) never runs on them.
//            Not ready (CI not green, blocked:amit, config) -> left alone. Conflict (409) -> base goes back to
//            integration, label batch:conflict + comment (rolls to the next loop).
//   open     opens ONE PR batch/<loop-id> -> integration (body: "Closes #N" for every merged ticket, so the
//            issues close when the batch lands; labels batch + factory).
//   review   requests ONE Bugbot review on the batch PR ("@cursor review") unless Bugbot already ran / is
//            running on the head commit or a request is already pending (waits --wait-auto seconds first).
//   status   prints CI + Bugbot gate for the batch PR; after 3 review-fix rounds with findings -> blocked:amit.
//   enqueue  CI green (5 required checks) + Bugbot clean + not blocked -> GraphQL enqueuePullRequest.
//   finalize after the batch PR merged: comment on every component PR "landed via #B", label
//            merged-via-batch; tickets -> status:done (GitHub closes them via the batch PR's Closes lines).
//   plan     read-only: which PRs are in the loop and whether each is ready.
//   run      build -> open -> review.
// Quiet hours (factory/LOOP.md): 22:00-09:00 Asia/Jerusalem `build`/`run` never START a new loop (batch branch
// missing -> notice, exit 0). An in-flight loop (branch exists) keeps going; open/review/status/enqueue/finalize
// are never gated. Override: FACTORY_QUIET_HOURS=off.
// Bugbot fix loop: factory-review-fix (Bugbot review on a batch/* head) dispatches factory-lane-claude with
// target_branch=batch/<loop-id>; each fix push then needs `review` again (max 3 rounds, review-fix:1..3).
// Loop PRs = --prs 1,2,3, else open PRs into integration or batch/<loop-id> whose linked ticket has
// front-matter `loop: <id>` or `batch: <id>`.
// Usage: node scripts/factory/batch-loop.mjs <command> --loop <id> [--prs 1,2] [--dry-run] [--wait-auto 180]
// Env: GH_TOKEN = a USER token (Division6066; never GITHUB_TOKEN for build/open/review/enqueue: R15 - PRs
//      opened with GITHUB_TOKEN start no CI, and Bugbot needs a covered human author), GITHUB_REPOSITORY.
import { quietHours } from "./quiet-hours.mjs";
import { gh, ghAll, repoParts, summary, linkedTickets } from "./gh-api.mjs";
import { frontMatter, labelNames, addLabels, removeLabel, comment, BASE } from "./factory-lib.mjs";
import { fetchBugbot, isBugbotRun } from "./review-gate.mjs";
import { appendFile } from "node:fs/promises";

// Ticket labels a landed batch clears (status:done is added). status:ready stayed on f3-1's tickets.
export const FINALIZE_CLEARS = ["status:ready", "status:dispatched", "status:in-pr", "waiting:data"];
export const REQUIRED = ["ci", "e2e-preview", "secret-scan", "config-guard", "scope-guard"];
export const batchBranch = (loop) => {
  if (!/^[A-Za-z0-9._-]+$/.test(loop || "")) throw new Error("--loop must match ^[A-Za-z0-9._-]+$");
  return `batch/${loop}`;
};
// POST /merges answers 409 for a merge conflict; other failures are not conflicts.
export const isConflict = (e) => / -> 409 /.test(String(e?.message || ""));
const REVIEW_REQ = /(^|\s)@?(cursor review|bugbot run)\b/i;

// Latest check run per name on a commit -> { name: conclusion|status }.
export function latestChecks(checkRuns) {
  const by = new Map();
  for (const r of checkRuns) { const p = by.get(r.name); if (!p || r.id > p.id) by.set(r.name, r); }
  return Object.fromEntries([...by].map(([k, r]) => [k, r.status === "completed" ? r.conclusion : r.status]));
}
export function ciGreen(checkRuns, required = REQUIRED) {
  const c = latestChecks(checkRuns);
  const bad = required.filter((n) => c[n] !== "success");
  return { ok: bad.length === 0, bad: bad.map((n) => `${n}=${c[n] ?? "missing"}`) };
}
// Ready to merge into the batch branch?
export function readiness({ pr, labels, checkRuns }) {
  if (pr.state !== "open") return { ok: false, why: `PR is ${pr.state}` };
  if (labels.includes("blocked:amit")) return { ok: false, why: "blocked:amit" };
  if (labels.includes("config")) return { ok: false, why: "config PR (not a loop ticket)" };
  const ci = ciGreen(checkRuns);
  if (!ci.ok) return { ok: false, why: `CI not green: ${ci.bad.join(", ")}` };
  return { ok: true, why: "CI green" };
}
// data ticket first, then ticket id order.
export function mergeOrder(items) {
  return [...items].sort((a, b) => (a.fm?.type === "data" ? 0 : 1) - (b.fm?.type === "data" ? 0 : 1) ||
    String(a.fm?.ticket || a.number).localeCompare(String(b.fm?.ticket || b.number), undefined, { numeric: true }));
}
export function batchBody({ loop, merged, skipped }) {
  return [
    `Factory loop **${loop}**: ONE Bugbot review for the whole loop (factory/LOOP.md). Each component PR below passed CI on its own and was merged into \`batch/${loop}\`.`,
    "", "## Tickets (close when this PR lands on integration)",
    ...merged.map((m) => `Closes #${m.ticket} - ${m.fm?.ticket || ""} via #${m.number}`),
    ...(skipped.length ? ["", "## Not in this batch", ...skipped.map((s) => `- #${s.number}: ${s.why}`)] : []),
    "", "Review: Bugbot reviews this PR only (`@cursor review`, once; max 3 fix rounds on this branch, then blocked:amit).",
    "Merge: GitHub merge queue (squash) when Bugbot is clean and the 5 required checks are green.",
  ].join("\n");
}
// Is a Bugbot review already done / running / requested for the head commit?
export function reviewNeeded({ headSha, headDate, checkRuns, comments }) {
  const runs = checkRuns.filter(isBugbotRun);
  if (runs.length) return { need: false, why: `Bugbot check already ${runs.some((r) => r.status !== "completed") ? "running" : "done"} on ${String(headSha).slice(0, 7)}` };
  const t = Date.parse(headDate || 0) || 0;
  const req = comments.filter((c) => REVIEW_REQ.test(c.body || "") && !/\[bot\]$/.test(c.user?.login || "") && (Date.parse(c.created_at) || 0) >= t);
  if (req.length) return { need: false, why: `review already requested at ${req[req.length - 1].created_at}` };
  return { need: true, why: "no Bugbot run or request for the head commit" };
}

const args = process.argv.slice(2);
const opt = (k, d = "") => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes("--dry-run");
const log = [];
const say = (s) => { log.push(s); console.log(s); };
const act = async (what, fn) => { say(`${DRY ? "[dry-run] would " : ""}${what}`); if (!DRY) return fn(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const QUIET = Symbol("quiet-hours");

async function checksOf(owner, repo, sha) {
  return ghAll(`/repos/${owner}/${repo}/commits/${sha}/check-runs`, (j) => j.check_runs);
}
async function loopPRs(owner, repo, loop) {
  const branch = batchBranch(loop);
  const explicit = opt("--prs").split(",").map((s) => Number(s.trim())).filter(Boolean);
  const out = [];
  const prs = explicit.length ? await Promise.all(explicit.map((n) => gh(`/repos/${owner}/${repo}/pulls/${n}`)))
    : [...await ghAll(`/repos/${owner}/${repo}/pulls?state=open&base=${BASE}`), ...await ghAll(`/repos/${owner}/${repo}/pulls?state=open&base=${encodeURIComponent(branch)}`)];
  for (const pr of prs) {
    if (pr.head.ref === branch) continue;
    const [ticket] = linkedTickets(pr.body);
    const issue = ticket ? await gh(`/repos/${owner}/${repo}/issues/${ticket}`, { allow404: true }) : null;
    const fm = issue && !issue.pull_request ? frontMatter(issue.body) : null;
    if (!explicit.length && !(fm && (String(fm.loop || "") === loop || String(fm.batch || "") === loop))) continue;
    out.push({ number: pr.number, pr, ticket, fm, labels: labelNames(pr) });
  }
  return mergeOrder(out);
}
async function findBatchPR(owner, repo, loop) {
  const prs = await ghAll(`/repos/${owner}/${repo}/pulls?state=all&base=${BASE}&head=${owner}:${encodeURIComponent(batchBranch(loop))}`);
  return prs.find((p) => p.state === "open") || prs[0] || null;
}
async function build(owner, repo, loop) {
  const branch = batchBranch(loop);
  const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`, { allow404: true });
  if (!ref) {
    const q = quietHours();
    if (q.quiet) { say(`Quiet hours: new loop ${branch} not started (${q.reason}). Run build again after ${String(q.end).padStart(2, "0")}:00.`); return QUIET; }
    const base = await gh(`/repos/${owner}/${repo}/git/ref/heads/${BASE}`);
    await act(`create ${branch} from ${BASE} @ ${base.object.sha.slice(0, 8)}`, () => gh(`/repos/${owner}/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: base.object.sha } }));
  } else say(`${branch} exists @ ${ref.object.sha.slice(0, 8)}`);
  const merged = [], skipped = [];
  for (const it of await loopPRs(owner, repo, loop)) {
    const r = it.pr.base.ref === branch && it.pr.state === "open" ? { ok: true, why: "already targets the batch branch" } : readiness({ pr: it.pr, labels: it.labels, checkRuns: await checksOf(owner, repo, it.pr.head.sha) });
    if (!r.ok) { skipped.push({ number: it.number, why: r.why }); say(`skip #${it.number}: ${r.why}`); continue; }
    if (it.pr.base.ref !== branch) await act(`retarget #${it.number} ${it.pr.base.ref} -> ${branch}`, () => gh(`/repos/${owner}/${repo}/pulls/${it.number}`, { method: "PATCH", body: { base: branch } }));
    if (DRY) { merged.push(it); say(`[dry-run] would merge #${it.number} head ${it.pr.head.sha.slice(0, 8)} into ${branch}`); continue; }
    let ok = true;
    try {
      const m = await gh(`/repos/${owner}/${repo}/merges`, { method: "POST", body: { base: branch, head: it.pr.head.sha, commit_message: `Merge #${it.number} (${it.fm?.ticket || "ticket"}) into ${branch}` } });
      say(`merged #${it.number} into ${branch}${m ? ` (${m.sha.slice(0, 8)})` : " (already contained)"}`); merged.push(it);
    } catch (e) {
      say(`merge #${it.number} failed: ${e.message.slice(0, 200)}`);
      // Only 409 = a real merge conflict. Anything else (auth, rate limit, 5xx) is not the PR's fault: undo the
      // retarget and stop the build, so it can simply be re-run.
      if (!isConflict(e)) {
        await gh(`/repos/${owner}/${repo}/pulls/${it.number}`, { method: "PATCH", body: { base: BASE } }).catch(() => {});
        throw new Error(`build stopped at #${it.number} (not a conflict; base restored to ${BASE}): ${e.message.slice(0, 200)}`);
      }
      ok = false;
    }
    if (!ok) {
      await gh(`/repos/${owner}/${repo}/pulls/${it.number}`, { method: "PATCH", body: { base: BASE } });
      await addLabels(owner, repo, it.number, ["batch:conflict"]);
      await comment(owner, repo, it.number, `Factory batch ${loop}: this PR conflicts with \`${branch}\`, so it was moved back to \`${BASE}\` and rolls to the next loop (label batch:conflict). Rebase on integration after the batch lands.`);
      skipped.push({ number: it.number, why: "conflict with batch branch (back to integration)" });
    }
  }
  return { merged, skipped };
}

async function open(owner, repo, loop, built) {
  const branch = batchBranch(loop);
  const found = await findBatchPR(owner, repo, loop);
  const existing = found && found.state === "open" ? found : null;
  // Tickets = every PR merged into the batch branch (all builds so far), plus this run's.
  const all = await ghAll(`/repos/${owner}/${repo}/pulls?state=closed&base=${encodeURIComponent(branch)}`);
  const merged = [];
  for (const p of all.filter((p) => p.merged_at)) {
    const [ticket] = linkedTickets(p.body);
    const issue = ticket ? await gh(`/repos/${owner}/${repo}/issues/${ticket}`, { allow404: true }) : null;
    merged.push({ number: p.number, ticket, fm: issue ? frontMatter(issue.body) : null });
  }
  for (const m of built?.merged || []) if (!merged.some((x) => x.number === m.number)) merged.push(m);
  if (!merged.length) { say(`nothing merged into ${branch} yet: no batch PR.`); return existing; }
  const body = batchBody({ loop, merged: mergeOrder(merged).filter((m) => m.ticket), skipped: built?.skipped || [] });
  if (existing) {
    // A later build may have merged more PRs: keep the Closes lines (and scope-guard rule i's ticket union) current.
    say(`batch PR exists: #${existing.number} ${existing.html_url}`);
    if ((existing.body || "").trim() !== body.trim())
      await act(`update #${existing.number} body (${merged.length} ticket(s))`, () => gh(`/repos/${owner}/${repo}/pulls/${existing.number}`, { method: "PATCH", body: { body, title: `[batch ${loop}] ${merged.length} factory tickets` } }));
    return existing;
  }
  let pr = null;
  await act(`open PR ${branch} -> ${BASE} with ${merged.length} ticket(s)`, async () => {
    pr = await gh(`/repos/${owner}/${repo}/pulls`, { method: "POST", body: { title: `[batch ${loop}] ${merged.length} factory tickets`, head: branch, base: BASE, body } });
    await addLabels(owner, repo, pr.number, ["batch", "factory"]);
    say(`opened #${pr.number} ${pr.html_url}`);
  });
  return pr;
}

async function review(owner, repo, loop) {
  const pr = await findBatchPR(owner, repo, loop);
  if (!pr || pr.state !== "open") { say("no open batch PR"); return; }
  const waitAuto = Number(opt("--wait-auto", "0"));
  for (let waited = 0; ; waited += 15) {
    const head = await gh(`/repos/${owner}/${repo}/commits/${pr.head.sha}`);
    const r = reviewNeeded({ headSha: pr.head.sha, headDate: head.commit.committer.date, checkRuns: await checksOf(owner, repo, pr.head.sha), comments: await ghAll(`/repos/${owner}/${repo}/issues/${pr.number}/comments`) });
    if (!r.need) { say(`#${pr.number}: no request needed (${r.why})`); return; }
    if (waited >= waitAuto) break;
    await sleep(15000);
  }
  const labels = labelNames(pr);
  if (labels.includes("blocked:amit")) { say(`#${pr.number} is blocked:amit: no review request`); return; }
  await act(`comment "@cursor review" on batch PR #${pr.number}`, () => comment(owner, repo, pr.number, "@cursor review"));
}

async function status(owner, repo, loop) {
  const pr = await findBatchPR(owner, repo, loop);
  if (!pr) { say("no batch PR"); return null; }
  const r = await fetchBugbot(owner, repo, pr.number);
  const ci = ciGreen(await checksOf(owner, repo, r.pr.head.sha));
  const labels = labelNames(r.pr);
  const tries = [1, 2, 3].filter((n) => labels.includes(`review-fix:${n}`)).length;
  say(`#${pr.number} ${r.pr.state}${r.pr.merged_at ? " (merged)" : ""} head ${r.pr.head.sha.slice(0, 8)}: CI ${ci.ok ? "green" : ci.bad.join(", ")}; Bugbot ${r.state} (${r.detail}); review-fix ${tries}/3`);
  if (r.pr.state === "open" && r.state === "findings" && tries >= 3 && !labels.includes("blocked:amit"))
    await act(`label #${pr.number} blocked:amit (3 Bugbot fix rounds used)`, async () => { await addLabels(owner, repo, pr.number, ["blocked:amit"]); await comment(owner, repo, pr.number, "Factory batch: 3 Bugbot fix rounds used and findings remain. Labelled blocked:amit."); });
  return { pr: r.pr, bugbot: r.state, ci, labels };
}

async function enqueue(owner, repo, loop) {
  const s = await status(owner, repo, loop);
  if (!s || s.pr.state !== "open") return;
  if (s.labels.includes("blocked:amit")) { say("blocked:amit: not enqueued"); return; }
  if (!s.ci.ok || s.bugbot !== "clean") { say(`not enqueued: CI ${s.ci.ok ? "green" : "not green"}, Bugbot ${s.bugbot}`); return; }
  await act(`enqueue batch PR #${s.pr.number} (GraphQL enqueuePullRequest)`, async () => {
    const q = "mutation($id:ID!){enqueuePullRequest(input:{pullRequestId:$id}){mergeQueueEntry{position state}}}";
    const g = await gh("/graphql", { method: "POST", body: { query: q, variables: { id: s.pr.node_id } } });
    if (g.errors) throw new Error(`enqueue failed: ${JSON.stringify(g.errors).slice(0, 300)}`);
    say(`enqueued: ${JSON.stringify(g.data.enqueuePullRequest.mergeQueueEntry)}`);
  });
}

async function finalize(owner, repo, loop) {
  const branch = batchBranch(loop);
  const pr = await findBatchPR(owner, repo, loop);
  if (!pr || !pr.merged_at) { say("batch PR not merged yet"); return; }
  const done = await ghAll(`/repos/${owner}/${repo}/pulls?state=closed&base=${encodeURIComponent(branch)}`);
  for (const p of done.filter((p) => p.merged_at)) {
    if (labelNames(p).includes("merged-via-batch")) continue;
    await act(`#${p.number}: comment + merged-via-batch`, async () => {
      await comment(owner, repo, p.number, `Landed on \`${BASE}\` via batch PR #${pr.number} (${pr.merge_commit_sha?.slice(0, 8) || "merge queue"}). This PR was merged into \`${branch}\`; the batch PR carried it through Bugbot and the merge queue.`);
      await addLabels(owner, repo, p.number, ["merged-via-batch"]);
      const [t] = linkedTickets(p.body);
      if (t) { await addLabels(owner, repo, t, ["status:done"]); for (const l of FINALIZE_CLEARS) await removeLabel(owner, repo, t, l); }
    });
  }
}

async function plan(owner, repo, loop) {
  for (const it of await loopPRs(owner, repo, loop)) {
    const r = readiness({ pr: it.pr, labels: it.labels, checkRuns: await checksOf(owner, repo, it.pr.head.sha) });
    say(`#${it.number} ${it.fm?.ticket || "?"} (${it.fm?.type || "?"}) base ${it.pr.base.ref}: ${r.ok ? "READY" : "not ready"} - ${r.why}`);
  }
}

async function main() {
  const { owner, repo } = repoParts();
  const cmd = args[0];
  const loop = opt("--loop");
  batchBranch(loop);
  say(`## batch-loop ${cmd} --loop ${loop}${DRY ? " (dry run)" : ""}`);
  if (cmd === "plan") await plan(owner, repo, loop);
  else if (cmd === "build") await build(owner, repo, loop);
  else if (cmd === "open") await open(owner, repo, loop, null);
  else if (cmd === "review") await review(owner, repo, loop);
  else if (cmd === "status") await status(owner, repo, loop);
  else if (cmd === "enqueue") await enqueue(owner, repo, loop);
  else if (cmd === "finalize") await finalize(owner, repo, loop);
  else if (cmd === "run") { const b = await build(owner, repo, loop); if (b === QUIET) return finish(); const pr = await open(owner, repo, loop, b); if (pr) await review(owner, repo, loop); }
  else throw new Error("command must be plan|build|open|review|status|enqueue|finalize|run");
  await finish();
}
async function finish() {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, log.join("\n") + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(async (e) => { await summary([`FAIL: ${e.message}`]); process.exit(1); });
