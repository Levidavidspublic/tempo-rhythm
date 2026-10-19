// release-go (Kitchen, owner-approved 2026-10-19). "Comment `go` on the Release PR to release."
// Driven by .github/workflows/release-go.yml. Amit-facing guide: docs/DEPLOY.md "Release by comment".
//
// Part 1, candidate check (automatic, subcommands prep / acceptance / report).
//   On the integration head SHA: full CI (ci.yml), secret scans since master (security.yml) and the signed-in
//   preview acceptance (preview-acceptance.yml, dispatched as Division6066). The result goes into ONE comment on
//   the open Release PR, written with github.token and starting with the hidden marker
//   <!-- release-candidate {"sha":"<40 hex>","run":<run id>,"state":"pending|pass|fail"} -->
//   NO Bugbot here: release.yml asks for ONE Bugbot review inside the real release. A release.yml dry run is not
//   used, because its bugbot job has no dry_run guard (it would request Bugbot too).
// Part 2, `go` (subcommands guard / dispatch / announce). goVerdict() holds every rule. If all hold, release.yml
//   is dispatched (dry_run=false) on integration with FACTORY_BATCH_TOKEN, so the run's actor is Division6066
//   (release.yml's preflight requires that). A failed guard gets one reply naming it; nothing else happens.
//   The `go` is bound to what Amit read: refused if older than 30 min (re-run of an old comment run) or if the
//   candidate comment changed at/after it. The started run is identified by pickDispatchedRun (no correlation
//   input exists); a run not uniquely identified is reported and never cancelled.
//   A comment whose text is not exactly `go` is ignored without a reply.
// Env: GH_TOKEN (github.token, except the two dispatch steps: FACTORY_BATCH_TOKEN), GITHUB_REPOSITORY, SHA,
//      RUN_ID, RUN_URL, EVENT_NAME, PR_NUMBER, COMMENT_ID, COMMENT_BODY, COMMENT_AUTHOR, PAUSED_ALL, PAUSED,
//      USER_TOKEN_SET, RESULTS, PREVIEW_URL, VERCEL_SKIPPED, ACCEPTANCE_URL, MASTER_SHA, CONVEX_CHANGED.
// Never: merges, deploys, touches Convex, or prints a token.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gh, ghAll, repoParts, summary } from "./gh-api.mjs";
import { isReleaseTitle } from "./release-pr.mjs";
import { AMIT, RELEASE_LABEL } from "./release-gate.mjs";

export const CANDIDATE_TAG = "release-candidate";
export const CANDIDATE_AUTHOR = "github-actions[bot]"; // github.token; nobody else can write as this account
export const CANDIDATE_WORKFLOW = "release-go.yml";
export const RELEASE_WORKFLOW = "release.yml";
export const ACCEPTANCE_WORKFLOW = "preview-acceptance.yml";
export const PREVIEW_ALIAS = "https://preview.tempoflow.dev";
const STATES = ["pending", "pass", "fail"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const truthy = (v) => v === true || v === "true";
const short = (s) => String(s || "").slice(0, 7);

// ---------- pure helpers (unit-tested in tests/unit/releaseGo.test.ts) ----------

export const isGo = (body) => String(body ?? "").trim().toLowerCase() === "go";
export const isPaused = ({ pausedAll, paused }) => pausedAll === "true" || paused === "true";
export const isActiveRun = (run) => !!run && run.status !== "completed";

export const CHECKS = [
  ["ci", "CI (lint, typecheck, unit tests, scans, notices, local E2E, build)"],
  ["security", "Secret scans (every commit since master)"],
  ["acceptance", "Preview acceptance (signed-in synthetic account on preview)"],
];

// Job results ({ci, security, acceptance} -> "success" | "failure" | "cancelled" | "skipped") -> pass/fail per check.
export function checkResults(results) {
  const checks = Object.fromEntries(CHECKS.map(([k]) => [k, results && results[k] === "success" ? "pass" : "fail"]));
  return { checks, state: Object.values(checks).every((v) => v === "pass") ? "pass" : "fail" };
}

export function renderCandidate({ sha, run, runUrl, state, checks = {}, previewUrl = "", vercelSkipped = false, acceptanceUrl = "", convexChanged, masterSha }) {
  const show = (k) => (state === "pending" ? "running" : checks[k] === "pass" ? "pass" : "**FAIL**");
  const preview = previewUrl ? previewUrl
    : vercelSkipped ? `Vercel did not build this commit (no app change), so ${PREVIEW_ALIAS} still serves the last app build. Preview acceptance can't run on it.`
    : state === "pending" ? "waiting for the Vercel build" : `UNKNOWN (see the run). Integration alias: ${PREVIEW_ALIAS}`;
  const convex = convexChanged === true || convexChanged === "true"
    ? "**yes**: `convex/` differs from master, so the release deploys Convex prod (precious-wildcat-890) before the web."
    : "no: `convex/` is the same as master, so the release deploys no Convex.";
  const verdict = { pending: "CHECKING", pass: "ALL PASSED", fail: "FAILED" }[state];
  const lines = [
    `<!-- ${CANDIDATE_TAG} ${JSON.stringify({ sha, run: Number(run), state })} -->`,
    `### Release candidate \`${short(sha)}\`: ${verdict}`,
    "",
    `- Commit (integration head): \`${sha}\``,
    `- Preview: ${preview}`,
    `- Convex deploy: ${convex}`,
    `- master: \`${short(masterSha)}\``,
    "",
    "| Check | Result |",
    "|---|---|",
    ...CHECKS.map(([k, name]) => `| ${name} | ${show(k)} |`),
    "",
    "Cursor Bugbot is not part of this check. It reviews once, inside the real release.",
    "",
  ];
  if (state === "pass") lines.push("**Comment `go` to release this commit.**", "");
  else if (state === "pending") lines.push("Checking now. Don't comment `go` yet.", "");
  else lines.push("Not releasable yet: fix it on integration. A new check runs on the next integration change (or Actions -> release-go -> Run workflow).", "");
  lines.push(`Run: ${runUrl}${acceptanceUrl ? ` - preview acceptance run: ${acceptanceUrl}` : ""}`);
  lines.push("The one-click button (Actions -> Release to production) still works. Guide: docs/DEPLOY.md.");
  return `${lines.join("\n")}\n`;
}

// The marker must open the comment; anything else is not a candidate comment.
export function parseCandidate(body) {
  const m = String(body || "").match(new RegExp(`^<!-- ${CANDIDATE_TAG} (\\{[^\\n]*?\\}) -->`));
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[1]); } catch { return null; }
  if (!j || !/^[0-9a-f]{40}$/.test(j.sha || "") || !Number.isInteger(j.run) || j.run <= 0 || !STATES.includes(j.state)) return null;
  return { sha: j.sha, run: j.run, state: j.state };
}

// Latest candidate comment written by github.token. Comments by anyone else are ignored, marker or not.
export function latestCandidate(comments) {
  const found = (comments || [])
    .filter((c) => c && c.user && c.user.login === CANDIDATE_AUTHOR)
    .map((c) => ({ c, p: parseCandidate(c.body) }))
    .filter((x) => x.p)
    .sort((a, b) => String(b.c.updated_at || b.c.created_at).localeCompare(String(a.c.updated_at || a.c.created_at)));
  return found.length ? { id: found[0].c.id, ...found[0].p, updated_at: found[0].c.updated_at || found[0].c.created_at || "" } : null;
}

// A `go` older than this is refused: a re-run of an old issue_comment run must not release today's commit.
export const GO_MAX_AGE_MINUTES = 30;

// Which run did OUR dispatch start? release.yml / preview-acceptance.yml take no correlation input, so: a
// workflow_dispatch run on integration by the token's user, created at/after the dispatch (GitHub's created_at is
// whole seconds, so `since` is floored by the caller) and not seen before it. Exactly one = ours; else unknown.
export function pickDispatchedRun(runs, { before, since, actor }) {
  const mine = (runs || []).filter((x) => x && !before.has(x.id) && x.event === "workflow_dispatch" && x.head_branch === "integration" &&
    x.actor && x.actor.login === actor && Date.parse(x.created_at) >= since);
  if (mine.length === 1) return { run: mine[0] };
  return mine.length ? { ambiguous: mine } : { none: true };
}

// What to do after dispatching release.yml. Only a uniquely identified run that started on the wrong SHA is cancelled.
export function dispatchOutcome(found, sha) {
  if (!found || found.none) return { result: "unidentified", cancel: null };
  if (found.ambiguous) return { result: "ambiguous", cancel: null };
  if (found.run.head_sha !== sha) return { result: "mismatch", cancel: found.run.id };
  return { result: "started", cancel: null };
}

// The run named in the candidate comment must be a finished, green release-go candidate run on that SHA.
export function candidateRunProblem(run, sha) {
  if (!run) return "its workflow run was not found";
  if (!new RegExp(`^\\.github/workflows/${CANDIDATE_WORKFLOW.replace(".", "\\.")}(@.*)?$`).test(run.path || "")) return `run ${run.id} is not a ${CANDIDATE_WORKFLOW} run`;
  if (!["workflow_run", "workflow_dispatch"].includes(run.event)) return `run ${run.id} is not a candidate check (event ${run.event})`;
  if (run.head_sha !== sha) return `run ${run.id} tested \`${short(run.head_sha)}\`, not \`${short(sha)}\``;
  if (run.status !== "completed") return `run ${run.id} is still finishing (${run.status}); comment \`go\` again in a minute`;
  if (run.conclusion !== "success") return `run ${run.id} ended ${run.conclusion}`;
  return null;
}

export function isReleasePr(pr) {
  return !!pr && pr.state === "open" && pr.base && pr.base.ref === "master" && pr.head && pr.head.ref === "integration" &&
    !!pr.head.repo && !!pr.base.repo && pr.head.repo.full_name === pr.base.repo.full_name &&
    (pr.labels || []).some((l) => (l.name || l) === RELEASE_LABEL);
}

// Every guard for `go`, in order. silent = not a `go` comment at all (no reply).
export function goVerdict(f) {
  const no = (guard, reason) => ({ ok: false, silent: false, guard, reason });
  if (!isGo(f.body)) return { ok: false, silent: true, guard: "text", reason: "comment is not exactly `go`" };
  if (!isReleasePr(f.pr)) return no("release-pr", "this is not the open Release PR (label `release`, integration -> master).");
  if (f.author !== AMIT) return no("author", `only ${AMIT} (Amit) can release by comment (this comment: ${f.author || "unknown"}).`);
  if (isPaused(f.paused || {})) return no("paused", "the factory is paused (repo variable FACTORY_PAUSED_ALL or FACTORY_PAUSED is true).");
  if (!f.userToken) return no("token", "secret FACTORY_BATCH_TOKEN is not set, so the release can't start as Division6066.");
  // Bind the `go` to what Amit read: refuse an old `go` (e.g. a re-run of an old comment run) and any candidate
  // comment that changed at or after the `go` was written. Missing or unreadable times refuse too (fail closed).
  const goAt = Date.parse(f.goCreatedAt || "");
  const nowMs = f.now === undefined ? Date.now() : Number(f.now);
  if (!Number.isFinite(goAt) || nowMs - goAt > GO_MAX_AGE_MINUTES * 60_000) {
    return no("old-go", `this \`go\` was written more than ${GO_MAX_AGE_MINUTES} minutes ago (or its time is unknown), for example a re-run of an old comment run. Read the candidate comment again, then comment \`go\` again.`);
  }
  const c = f.candidate;
  if (!c) return no("candidate", "there is no candidate check on this PR yet. Wait for the comment that says \"Comment `go` to release this commit.\"");
  const candAt = Date.parse(c.updated_at || "");
  if (!Number.isFinite(candAt) || candAt >= goAt) {
    return no("changed", `the candidate comment changed after your \`go\` (it is now for \`${short(c.sha)}\`, ${c.state}), so this \`go\` may not be for that commit. Read it again, then comment \`go\` again.`);
  }
  if (!f.integrationSha || c.sha !== f.integrationSha) return no("stale", `the candidate check is for \`${short(c.sha)}\`, but integration is now \`${short(f.integrationSha)}\`. A new check runs on the new commit; comment \`go\` when it says ALL PASSED.`);
  if (c.state === "pending") return no("candidate", `the candidate check for \`${short(c.sha)}\` is still running.`);
  if (c.state !== "pass") return no("candidate", `the candidate check for \`${short(c.sha)}\` did not pass. Fix it on integration first.`);
  const p = candidateRunProblem(f.candidateRun, c.sha);
  if (p) return no("candidate-run", `could not confirm the candidate check: ${p}.`);
  const busy = (f.releaseRuns || []).find(isActiveRun);
  if (busy) return no("busy", `a Release to production run is already ${busy.status}: ${busy.html_url}`);
  return { ok: true, silent: false, guard: "", reason: "", sha: c.sha };
}

export function refusal(v) {
  return [`\`go\` refused (${v.guard}): ${v.reason}`, "", "Nothing was started. The one-click button (Actions -> Release to production) still works."].join("\n");
}

// ---------- I/O ----------

function out(k, v) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\n/g, " ")}\n`);
}
const say = (lines) => summary(Array.isArray(lines) ? lines : [lines]);
const tipOf = async (o, r, branch) => (await gh(`/repos/${o}/${r}/git/ref/heads/${branch}`)).object.sha;
const comment = (o, r, n, body) => gh(`/repos/${o}/${r}/issues/${n}/comments`, { method: "POST", body: { body } });
const workflowRuns = async (o, r, wf, q = "") => (await gh(`/repos/${o}/${r}/actions/workflows/${wf}/runs?per_page=20${q}`)).workflow_runs || [];

async function findReleasePr(o, r) {
  const q = new URLSearchParams({ state: "open", base: "master", head: `${o}:integration` });
  const prs = ((await gh(`/repos/${o}/${r}/pulls?${q}`)) || []).filter((p) => p.head.repo && p.head.repo.full_name === `${o}/${r}`);
  return prs.find((p) => p.labels.some((l) => l.name === RELEASE_LABEL)) || prs.find((p) => isReleaseTitle(p.title)) || null;
}

// Dispatch a workflow on integration and identify the run it started (pickDispatchedRun). Returns { run } |
// { none: true } | { ambiguous: [runs] }. Once a match shows up, one more look 10 s later catches a twin dispatch.
async function dispatchAndFind(o, r, wf, inputs) {
  const actor = (await gh("/user")).login;
  const list = () => workflowRuns(o, r, wf, "&event=workflow_dispatch&branch=integration");
  const before = new Set((await list()).map((x) => x.id));
  const since = Math.floor(Date.now() / 1000) * 1000;
  await gh(`/repos/${o}/${r}/actions/workflows/${wf}/dispatches`, { method: "POST", body: { ref: "integration", ...(inputs ? { inputs } : {}) } });
  for (let i = 0; i < 36; i++) {
    await sleep(5_000);
    if (pickDispatchedRun(await list(), { before, since, actor }).none) continue;
    await sleep(10_000);
    return pickDispatchedRun(await list(), { before, since, actor });
  }
  return { none: true };
}

async function prep(o, r) {
  const sha = process.env.SHA;
  const skip = async (why) => { out("run", "false"); await say(`Candidate check skipped: ${why}`); };
  if ((await tipOf(o, r, "integration")) !== sha) return skip(`integration moved past \`${short(sha)}\`; the newer commit gets its own check.`);
  const pr = await findReleasePr(o, r);
  if (!pr) return skip("no open Release PR (integration -> master).");
  const busy = (await workflowRuns(o, r, RELEASE_WORKFLOW)).find(isActiveRun);
  if (busy) return skip(`a Release to production run is ${busy.status} (${busy.html_url}); its gate is testing now.`);
  const cand = latestCandidate(await ghAll(`/repos/${o}/${r}/issues/${pr.number}/comments`));
  if (process.env.EVENT_NAME === "workflow_run" && cand && cand.sha === sha && cand.state !== "pending") return skip(`#${pr.number} already has a ${cand.state} result for \`${short(sha)}\`.`);
  const masterSha = await tipOf(o, r, "master");
  const convexChanged = execFileSync("git", ["diff", "--name-only", masterSha, sha, "--", "convex", "convex.json"], { encoding: "utf8" }).trim().length > 0;
  if (!pr.labels.some((l) => l.name === RELEASE_LABEL)) await gh(`/repos/${o}/${r}/issues/${pr.number}/labels`, { method: "POST", body: { labels: [RELEASE_LABEL] } });
  const body = renderCandidate({ sha, run: process.env.RUN_ID, runUrl: process.env.RUN_URL, state: "pending", convexChanged, masterSha });
  const c = cand ? await gh(`/repos/${o}/${r}/issues/comments/${cand.id}`, { method: "PATCH", body: { body } }) : await comment(o, r, pr.number, body);
  out("run", "true"); out("pr_number", pr.number); out("comment_id", c.id); out("master_sha", masterSha); out("convex_changed", convexChanged);
  await say([`Candidate check for \`${short(sha)}\` on Release PR #${pr.number}. Convex differs from master: ${convexChanged ? "yes" : "no"}.`]);
}

async function acceptance(o, r) {
  if (!truthy(process.env.USER_TOKEN_SET)) throw new Error("preview-acceptance must be dispatched as Division6066: secret FACTORY_BATCH_TOKEN is not set.");
  const sha = process.env.SHA;
  if ((await tipOf(o, r, "integration")) !== sha) throw new Error(`integration moved past \`${short(sha)}\`; not testing an old commit.`);
  const found = await dispatchAndFind(o, r, ACCEPTANCE_WORKFLOW);
  if (found.none) throw new Error(`dispatched ${ACCEPTANCE_WORKFLOW}, but its run was not identified within 3 minutes.`);
  if (found.ambiguous) throw new Error(`dispatched ${ACCEPTANCE_WORKFLOW}, but ${found.ambiguous.length} new runs match; can't tell which one tests \`${short(sha)}\`.`);
  const run = found.run;
  out("acceptance_url", run.html_url);
  if (run.head_sha !== sha) throw new Error(`${ACCEPTANCE_WORKFLOW} started on \`${short(run.head_sha)}\`, not \`${short(sha)}\` (integration moved): ${run.html_url}`);
  await say(`Preview acceptance run: ${run.html_url}`);
  const deadline = Date.now() + Number(process.env.ACCEPTANCE_WAIT_MINUTES || 50) * 60_000;
  while (Date.now() < deadline) {
    await sleep(30_000);
    const now = await gh(`/repos/${o}/${r}/actions/runs/${run.id}`);
    if (now.status !== "completed") continue;
    if (now.conclusion === "success") return say(`Preview acceptance passed on \`${short(sha)}\`.`);
    throw new Error(`preview acceptance ended ${now.conclusion}: ${run.html_url}`);
  }
  throw new Error(`preview acceptance did not finish within ${process.env.ACCEPTANCE_WAIT_MINUTES || 50} min: ${run.html_url}`);
}

async function report(o, r) {
  const sha = process.env.SHA, run = Number(process.env.RUN_ID);
  const { checks, state } = checkResults(JSON.parse(process.env.RESULTS || "{}"));
  const now = await gh(`/repos/${o}/${r}/issues/comments/${process.env.COMMENT_ID}`, { allow404: true });
  const mine = now && now.user && now.user.login === CANDIDATE_AUTHOR ? parseCandidate(now.body) : null;
  if (!mine || mine.sha !== sha || mine.run !== run) return say("A newer candidate check owns the Release PR comment; not overwriting it.");
  const body = renderCandidate({
    sha, run, runUrl: process.env.RUN_URL, state, checks, previewUrl: process.env.PREVIEW_URL || "", vercelSkipped: truthy(process.env.VERCEL_SKIPPED),
    acceptanceUrl: process.env.ACCEPTANCE_URL || "", convexChanged: process.env.CONVEX_CHANGED, masterSha: process.env.MASTER_SHA,
  });
  await gh(`/repos/${o}/${r}/issues/comments/${process.env.COMMENT_ID}`, { method: "PATCH", body: { body } });
  await say([`Candidate \`${short(sha)}\`: ${state}.`, ...CHECKS.map(([k, name]) => `- ${name}: ${checks[k]}`)]);
}

async function guard(o, r) {
  const body = process.env.COMMENT_BODY || "";
  if (!isGo(body)) { out("ok", "false"); return say("Not a `go` comment; ignored."); }
  const n = Number(process.env.PR_NUMBER);
  const pr = await gh(`/repos/${o}/${r}/pulls/${n}`);
  const candidate = latestCandidate(await ghAll(`/repos/${o}/${r}/issues/${n}/comments`));
  const f = {
    body, pr, author: process.env.COMMENT_AUTHOR, candidate, goCreatedAt: process.env.COMMENT_CREATED_AT, now: Date.now(),
    paused: { pausedAll: process.env.PAUSED_ALL, paused: process.env.PAUSED },
    userToken: truthy(process.env.USER_TOKEN_SET),
    integrationSha: await tipOf(o, r, "integration"),
    candidateRun: candidate ? await gh(`/repos/${o}/${r}/actions/runs/${candidate.run}`, { allow404: true }) : null,
    releaseRuns: await workflowRuns(o, r, RELEASE_WORKFLOW),
  };
  const v = goVerdict(f);
  if (v.ok) { out("ok", "true"); out("sha", v.sha); return say(`All guards hold for \`${short(v.sha)}\`. Starting the release.`); }
  out("ok", "false");
  await say(`Guard failed (${v.guard}): ${v.reason}`);
  if (!v.silent) await comment(o, r, n, refusal(v));
}

async function dispatch(o, r) {
  const sha = process.env.SHA;
  try {
    if ((await tipOf(o, r, "integration")) !== sha) { out("result", "moved"); return say(`integration moved past \`${short(sha)}\`; not dispatched.`); }
    const found = await dispatchAndFind(o, r, RELEASE_WORKFLOW, { dry_run: "false" });
    const d = dispatchOutcome(found, sha);
    out("result", d.result);
    if (d.result === "unidentified") return say("Dispatched release.yml (started), but its run was not identified within 3 minutes. Cancelled nothing.");
    if (d.result === "ambiguous") return say(`Dispatched release.yml, but ${found.ambiguous.length} new runs match: ${found.ambiguous.map((x) => x.html_url).join(" ")}. Cancelled nothing.`);
    out("run_url", found.run.html_url);
    if (d.cancel) {
      await gh(`/repos/${o}/${r}/actions/runs/${d.cancel}/cancel`, { method: "POST" });
      out("detail", short(found.run.head_sha));
      return say(`Release run ${found.run.html_url} started on \`${short(found.run.head_sha)}\`, not the checked \`${short(sha)}\`. Cancelled it.`);
    }
    await say(`Release to production started on \`${short(sha)}\`: ${found.run.html_url}`);
  } catch (e) {
    out("result", "error"); out("detail", e.message.slice(0, 200));
    throw e;
  }
}

async function announce(o, r) {
  const n = Number(process.env.PR_NUMBER), sha = process.env.SHA, url = process.env.RELEASE_RUN_URL || "";
  const all = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${o}/${r}/actions/workflows/${RELEASE_WORKFLOW}`;
  const res = process.env.RESULT || "error";
  const text = {
    started: [`Release started for \`${short(sha)}\` (Release to production, dry_run=false, as ${AMIT}): ${url}`, "", "The full release gate runs first (CI, secret scans, preview E2E, one Cursor Bugbot review). Any red check stops it before the merge. Rollback: docs/DEPLOY.md."],
    unidentified: [`Release started for \`${short(sha)}\`, but its run was not identified. Check the runs page: ${all}`],
    ambiguous: [`Release dispatched for \`${short(sha)}\`, but more than one new run matched, so none was identified and nothing was cancelled. Check the runs page: ${all}`],
    mismatch: [`Stopped: the release run started on \`${process.env.DETAIL || "another commit"}\`, not the checked \`${short(sha)}\` (integration moved). It was cancelled: ${url}`, "", "Wait for the new candidate comment, then comment `go` again."],
    moved: [`Not started: integration moved past \`${short(sha)}\` just now. Wait for the new candidate comment, then comment \`go\` again.`],
    error: [`Could not start the release for \`${short(sha)}\`: ${process.env.DETAIL || "see the workflow run"}. Run: ${process.env.RUN_URL}`],
    "guard-error": [`Could not check the guards (see the run), so nothing was started: ${process.env.RUN_URL}`, "", "Comment `go` again, or use the one-click button (Actions -> Release to production)."],
  }[res] || [`Unexpected result \`${res}\`. Run: ${process.env.RUN_URL}`];
  await gh(`/repos/${o}/${r}/issues/comments/${process.env.COMMENT_ID}/reactions`, { method: "POST", body: { content: res === "started" ? "rocket" : "confused" } });
  await comment(o, r, n, text.join("\n"));
}

async function main() {
  const { owner, repo } = repoParts();
  const cmd = process.argv[2];
  const fns = { prep, acceptance, report, guard, dispatch, announce };
  if (!fns[cmd]) throw new Error(`command must be one of ${Object.keys(fns).join("|")}`);
  await fns[cmd](owner, repo);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => { await summary([`FAIL: ${e.message.slice(0, 500)}`]); process.exit(1); });
}
