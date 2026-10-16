// release-gate (Phase H, 2026-10-06). One-click preview -> production release for tempo-rhythm.
// Driven by .github/workflows/release.yml ("Release to production"). Amit clicks Run workflow once.
// Subcommands (each is one step of release.yml):
//   preflight  read-only. Pins the integration SHA (X) and master SHA, and lists what would stop a real merge:
//              the factory-live "Restrict updates" rule, branch "behind" + strict checks, merge conflicts,
//              master content missing from integration, a merge method the repo/ruleset forbids.
//   pr         opens or updates ONE Release PR integration -> master as the token user (Division6066), label
//              `release`. A Release PR opened by someone else (e.g. github-actions from factory-release-pr) is
//              closed with a note first: Bugbot can't review bot-authored PRs (E1).
//   bugbot     ONE Cursor Bugbot review of the release PR head. Reuses a finished review of the same SHA;
//              otherwise waits for an automatic run, then posts "@cursor review" once. Findings = gate fails.
//   verdict    collects the gate jobs. Any failure -> label `blocked:amit` + comment. No auto-fix on release.
//   pr-ready   waits until GitHub says the release PR is mergeable (required checks green, not behind/dirty).
//   convex-key checks CONVEX_DEPLOY_KEY_LIVE targets prod:precious-wildcat-890 (value never printed).
//   ship       merges the PR pinned to SHA X, checks master's tree == X's tree, waits for the Vercel
//              production deployment (GitHub Deployments, vercel[bot]) to succeed, then checks /api/health
//              reports the new master commit. Comments the result on the PR. Never rolls back (DEPLOY.md).
// Env: GH_TOKEN (FACTORY_BATCH_TOKEN if set, else github.token), USER_TOKEN_SET=true|false, GITHUB_REPOSITORY,
//      RELEASE_SHA, MASTER_SHA, PR_NUMBER, DRY_RUN, RUN_URL, MERGE_METHOD, PROD_ENVIRONMENT, HEALTH_URL.
// R15: writes (PR, comments, labels, merge) only with the user token, never GITHUB_TOKEN.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { gh, ghAll, repoParts, summary, linkedTickets } from "./gh-api.mjs";
import { fetchBugbot } from "./review-gate.mjs";
import { reviewNeeded, latestChecks } from "./batch-loop.mjs";
import { releaseTitle, prNumbersFromMessage, israelDate } from "./release-pr.mjs";
import { assertLiveKeyTarget } from "./deploy-live-plan.mjs";

export const AMIT = "Division6066";
export const RELEASE_LABEL = "release";
export const BLOCKED_LABEL = "blocked:amit";
export const MARKER = "Release-Workflow: release.yml";
export const DEFAULT_HEALTH_URL = "https://www.tempoflow.dev/api/health";
export const DEFAULT_PROD_ENVIRONMENT = "Production";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const truthy = (v) => v === true || v === "true";
const short = (s) => String(s || "").slice(0, 7);

// ---------- pure helpers (unit-tested in test-factory.mjs) ----------

// Which merge methods can the release use? repo = GET /repos (allow_*), rules = GET /rules/branches/master,
// linear = classic protection required_linear_history. null = unknown (not readable with this token).
export function allowedMergeMethods({ repo, rules, linear }) {
  let methods = ["merge", "squash", "rebase"];
  if (repo && typeof repo.allow_merge_commit === "boolean") {
    methods = methods.filter((m) => repo[{ merge: "allow_merge_commit", squash: "allow_squash_merge", rebase: "allow_rebase_merge" }[m]]);
  }
  for (const r of (rules || []).filter((r) => r.type === "pull_request")) {
    const allowed = r.parameters && r.parameters.allowed_merge_methods;
    if (Array.isArray(allowed)) methods = methods.filter((m) => allowed.includes(m));
  }
  if ((rules || []).some((r) => r.type === "required_linear_history") || linear === true) methods = methods.filter((m) => m !== "merge");
  return methods;
}

// Everything that would stop a REAL release merge. Pure: inputs are API/git facts gathered by preflight().
export function preflightBlockers(f) {
  const out = [];
  const rules = f.rules || [];
  if (rules.some((r) => r.type === "update") && !["always", "pull_requests_only", "exempt"].includes(f.canBypassLive || "")) {
    out.push("master ruleset factory-live has the \"Restrict updates\" rule and no bypass for this token's user: nobody can merge into master. Amit: remove that rule (or add a bypass) in Settings -> Rules -> factory-live.");
  }
  const strict = rules.some((r) => r.type === "required_status_checks" && r.parameters && r.parameters.strict_required_status_checks_policy) || f.classicStrict === true;
  if (strict && f.behindBy > 0) {
    out.push(`integration is ${f.behindBy} commit(s) behind master and master requires branches to be up to date (strict checks): the release PR can't merge. Amit: see DEPLOY.md "One-time setup" (sync history; strict off on master).`);
  }
  if (f.conflicts > 0) out.push(`integration -> master has ${f.conflicts} conflicting file(s) (master's last squash commit is not in integration's history). Amit: see DEPLOY.md "One-time setup".`);
  else if (f.mergeTree && f.xTree && f.mergeTree !== f.xTree) out.push("merging integration into master would NOT equal the tested integration tree: master has changes that integration lacks (a hotfix?). Bring them into integration first.");
  if (f.allowed && !f.allowed.includes(f.method)) {
    out.push(`merge method "${f.method}" is not allowed on master (allowed: ${f.allowed.join(", ") || "none"}). Amit: allow merge commits for releases (DEPLOY.md), or set repo variable RELEASE_MERGE_METHOD.`);
  }
  if (!f.userToken) out.push("secret FACTORY_BATCH_TOKEN (Division6066 user token) is not set: the release PR, Bugbot request and merge can't be done (R15: never GITHUB_TOKEN).");
  return out;
}

// GitHub mergeable_state -> what ship should do.
export function mergeStateVerdict(state) {
  if (["clean", "has_hooks", "unstable"].includes(state)) return "ready";
  if (["blocked", "unknown", "", undefined, null].includes(state)) return "wait";
  return "fail"; // behind, dirty, draft
}

export function judgeHealth(status, body, sha) {
  let j = null;
  try { j = JSON.parse(body); } catch { j = null; }
  if (status < 200 || status >= 300 || !j) return { ok: false, detail: `HTTP ${status}` };
  if (j.ok !== true || j.service !== "tempo-web") return { ok: false, detail: `unexpected body (ok=${j.ok}, service=${j.service})` };
  if (!sha || String(j.commit || "") !== short(sha)) return { ok: false, detail: `commit ${j.commit} != ${short(sha)}`, commit: j.commit };
  return { ok: true, detail: `commit ${j.commit} matches`, commit: j.commit };
}

// Vercel's production deployment for a SHA (GitHub Deployments API, created by vercel[bot]).
export function isProductionDeployment(d, envName = DEFAULT_PROD_ENVIRONMENT) {
  return !!d && d.environment === envName && /vercel/i.test((d.creator && d.creator.login) || "");
}

export function releaseCommit({ date, number, xSha, runUrl }) {
  return {
    title: `Release ${date} (#${number})`,
    message: [`integration ${xSha} -> master after the release gate (CI, preview E2E, Bugbot).`, `Run: ${runUrl}`, "", MARKER].join("\n"),
  };
}

// PR titles can say "close #327" etc. In the release PR body that reads as a closing reference:
// scope-guard/config-guard (linkedTickets) then treat #327 as this PR's ticket and fail, and the
// merge into master would auto-close it. Escape "#" after a closing keyword so it stays plain text.
export function quoteTitle(title) {
  return String(title).replace(/(\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s+)#(\d+)/gi, "$1\\#$2");
}

export function renderBody({ date, xSha, masterSha, ahead, behind, rows, runUrl, dryRun }) {
  const lines = [
    `## Release ${date} (Asia/Jerusalem)`,
    "",
    `Opened by **Release to production** (\`release.yml\`)${dryRun ? " in **dry run** (no merge)" : ""}: ${runUrl}`,
    "",
    `Gate SHA (integration): \`${xSha}\`. master: \`${masterSha}\`. integration is ${ahead} ahead / ${behind} behind master.`,
    "",
    "Second gate on this exact SHA: full CI (lint, typecheck, unit, scans, notices, local E2E, build), secret scans,",
    "Playwright against the integration Vercel preview, and ONE Cursor Bugbot review of this PR.",
    "Any finding or red check stops the release and labels this PR `blocked:amit`. No auto-fix on release.",
    "If everything is green the workflow merges this PR, which deploys tempo-web to production (www.tempoflow.dev).",
    "Rollback: docs/DEPLOY.md.",
    "",
    "### Pull requests in this release",
  ];
  if (!rows.length) lines.push("- None found (no pull-request numbers on these commits).");
  for (const r of rows) lines.push(`- #${r.number} ${quoteTitle(r.title)}${r.links.length ? ` (links ${r.links.map((n) => `#${n}`).join(", ")})` : ""}`);
  return `${lines.join("\n")}\n`;
}

// ---------- I/O ----------

function out(k, v) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\n/g, " ")}\n`);
}
const say = (lines) => summary(Array.isArray(lines) ? lines : [lines]);
function needUserToken(what) {
  if (!truthy(process.env.USER_TOKEN_SET)) throw new Error(`${what} needs secret FACTORY_BATCH_TOKEN (Division6066 user token). R15: never GITHUB_TOKEN.`);
}
function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
const comment = (o, r, n, body) => gh(`/repos/${o}/${r}/issues/${n}/comments`, { method: "POST", body: { body } });
const addLabels = (o, r, n, labels) => gh(`/repos/${o}/${r}/issues/${n}/labels`, { method: "POST", body: { labels } });
const removeLabel = (o, r, n, l) => gh(`/repos/${o}/${r}/issues/${n}/labels/${encodeURIComponent(l)}`, { method: "DELETE", allow404: true });
const tipOf = async (o, r, branch) => (await gh(`/repos/${o}/${r}/git/ref/heads/${branch}`)).object.sha;
const treeOf = async (o, r, sha) => (await gh(`/repos/${o}/${r}/git/commits/${sha}`)).tree.sha;

export async function block(o, r, n, lines) {
  const text = [`### Release stopped (\`blocked:amit\`)`, "", ...lines, "", `Run: ${process.env.RUN_URL || "UNKNOWN"}`, "Fix on integration, then click **Release to production** again. Rollback: docs/DEPLOY.md."].join("\n");
  await say(lines);
  if (!n || !truthy(process.env.USER_TOKEN_SET)) return;
  try { await addLabels(o, r, n, [BLOCKED_LABEL]); await comment(o, r, n, text); } catch (e) { await say(`Could not label/comment #${n}: ${e.message.slice(0, 200)}`); }
}

async function preflight(o, r) {
  const x = process.env.RELEASE_SHA;
  const dry = truthy(process.env.DRY_RUN);
  const userToken = truthy(process.env.USER_TOKEN_SET);
  const method = process.env.MERGE_METHOD || "merge";
  const intTip = await tipOf(o, r, "integration");
  if (intTip !== x) throw new Error(`integration moved since the click (${short(x)} -> ${short(intTip)}). Click again.`);
  const masterSha = await tipOf(o, r, "master");
  const cmp = await gh(`/repos/${o}/${r}/compare/${masterSha}...${x}`);
  const rules = await gh(`/repos/${o}/${r}/rules/branches/master`).catch(() => []);
  const live = rules.find((x2) => x2.type === "update");
  let canBypassLive = "";
  if (live && live.ruleset_id) canBypassLive = (await gh(`/repos/${o}/${r}/rulesets/${live.ruleset_id}`).catch(() => ({}))).current_user_can_bypass || "";
  const repo = await gh(`/repos/${o}/${r}`);
  const classic = await gh(`/repos/${o}/${r}/branches/master/protection`, { allow404: true }).catch(() => null);
  const linear = classic ? !!(classic.required_linear_history && classic.required_linear_history.enabled) : null;
  const classicStrict = classic && classic.required_status_checks ? !!classic.required_status_checks.strict : null;
  // Exact merge result, computed locally (needs a full-history checkout): conflicts and resulting tree.
  let conflicts = 0, mergeTree = "";
  try { mergeTree = git(["merge-tree", "--write-tree", "--name-only", masterSha, x]).split("\n")[0]; }
  catch (e) {
    const lines = String(e.stdout || "").split("\n");
    const blank = lines.indexOf("");
    conflicts = (blank > 0 ? lines.slice(1, blank) : lines.slice(1)).filter(Boolean).length || 1;
  }
  const xTree = git(["rev-parse", `${x}^{tree}`]);
  const convexChanged = git(["diff", "--name-only", masterSha, x, "--", "convex", "convex.json"]).length > 0;
  const allowed = repo && typeof repo.allow_merge_commit === "boolean" ? allowedMergeMethods({ repo, rules, linear }) : null;
  const blockers = preflightBlockers({ rules, canBypassLive, classicStrict, behindBy: cmp.behind_by, conflicts, mergeTree, xTree, allowed, method, userToken });
  out("master_sha", masterSha); out("convex_changed", convexChanged); out("blockers", blockers.length); out("merge_method", method);
  await say([
    `## Release preflight${dry ? " (dry run)" : ""}`,
    `- Gate SHA (integration): \`${x}\``,
    `- master: \`${masterSha}\` - integration is ${cmp.ahead_by} ahead / ${cmp.behind_by} behind`,
    `- Convex functions changed since master: ${convexChanged ? "yes (prod Convex deploy runs after the gate)" : "no (no Convex deploy)"}`,
    `- Merge method: ${method} (allowed on master: ${allowed ? allowed.join(", ") || "none" : "UNKNOWN with this token"})`,
    `- Release token (FACTORY_BATCH_TOKEN): ${userToken ? "set" : "MISSING"}`,
    ...(blockers.length ? ["", `### ${dry ? "A real run would stop here" : "Stopped before the gate"} (${blockers.length})`, ...blockers.map((b) => `- ${b}`)] : ["- No blockers for the merge."]),
  ]);
  if (blockers.length && !dry) process.exit(1);
}

async function releaseRows(o, r, base, head) {
  const cmp = await gh(`/repos/${o}/${r}/compare/${base}...${head}`);
  const numbers = [];
  for (const c of cmp.commits || []) for (const n of prNumbersFromMessage(c.commit && c.commit.message)) if (!numbers.includes(n)) numbers.push(n);
  const rows = [];
  for (const number of numbers.slice(0, 150)) {
    const p = await gh(`/repos/${o}/${r}/pulls/${number}`, { allow404: true });
    rows.push({ number, title: p ? p.title : "(details unavailable)", links: p ? linkedTickets(p.body || "") : [] });
  }
  return { rows, ahead: cmp.ahead_by, behind: cmp.behind_by };
}

async function openPr(o, r) {
  needUserToken("Opening the release PR");
  const x = process.env.RELEASE_SHA, masterSha = process.env.MASTER_SHA;
  const date = israelDate();
  const me = (await gh("/user")).login;
  const { rows, ahead, behind } = await releaseRows(o, r, masterSha, x);
  const body = renderBody({ date, xSha: x, masterSha, ahead, behind, rows, runUrl: process.env.RUN_URL, dryRun: truthy(process.env.DRY_RUN) });
  const q = new URLSearchParams({ state: "open", base: "master", head: `${o}:integration` });
  let pr = (await gh(`/repos/${o}/${r}/pulls?${q}`))[0] || null;
  if (pr && pr.user.login !== me) {
    await comment(o, r, pr.number, `Superseded by the Release to production workflow (${process.env.RUN_URL}). Closing: Bugbot can only review a release PR opened by ${me} (E1). The new release PR carries the same commits.`);
    await gh(`/repos/${o}/${r}/pulls/${pr.number}`, { method: "PATCH", body: { state: "closed" } });
    await say(`Closed #${pr.number} (opened by ${pr.user.login}, not ${me}).`);
    pr = null;
  }
  if (pr) {
    pr = await gh(`/repos/${o}/${r}/pulls/${pr.number}`, { method: "PATCH", body: { title: releaseTitle(), body } });
    if (pr.draft) await say(`#${pr.number} is a draft: mark it ready (Bugbot and merge need a ready PR).`);
  } else {
    pr = await gh(`/repos/${o}/${r}/pulls`, { method: "POST", body: { title: releaseTitle(), head: "integration", base: "master", body, draft: false } });
  }
  await addLabels(o, r, pr.number, [RELEASE_LABEL]);
  await removeLabel(o, r, pr.number, BLOCKED_LABEL);
  out("pr_number", pr.number); out("pr_url", pr.html_url);
  await say(`Release PR: ${pr.html_url} (head \`${short(pr.head.sha)}\`, author ${pr.user.login}).`);
  if (pr.head.sha !== x) await block(o, r, pr.number, [`Release PR head ${short(pr.head.sha)} is not the gate SHA ${short(x)} (integration moved). Click again.`]).then(() => process.exit(1));
}

async function bugbot(o, r) {
  needUserToken("Requesting Bugbot");
  const n = Number(process.env.PR_NUMBER), x = process.env.RELEASE_SHA;
  const waitAuto = Number(process.env.BUGBOT_WAIT_AUTO_SECONDS || 180);
  const deadline = Date.now() + Number(process.env.BUGBOT_WAIT_MINUTES || 30) * 60_000;
  let requested = false;
  for (let waited = 0; Date.now() < deadline; waited += 30) {
    const s = await fetchBugbot(o, r, n);
    if (s.pr.head.sha !== x) return block(o, r, n, [`PR head moved to ${short(s.pr.head.sha)} during the gate (gate SHA ${short(x)}). Click again.`]).then(() => process.exit(1));
    if (s.state === "clean") { out("detail", s.detail); return say(`Bugbot: clean (${s.detail}).`); }
    if (s.state === "findings") {
      const list = s.findings.map((f, i) => `${i + 1}. ${f.path}${f.line ? `:${f.line}` : ""} ${f.url || ""}\n   ${(f.body || "").split("\n").find((l) => l.trim()) || ""}`.slice(0, 400));
      out("detail", s.detail);
      return block(o, r, n, [`Bugbot found problems on \`${short(x)}\`: ${s.detail}.`, ...list]).then(() => process.exit(1));
    }
    if (s.state === "blocked") { out("detail", s.detail); return block(o, r, n, [`Bugbot couldn't review: ${s.detail}`]).then(() => process.exit(1)); }
    if (!requested) {
      const head = await gh(`/repos/${o}/${r}/commits/${x}`);
      const runs = await ghAll(`/repos/${o}/${r}/commits/${x}/check-runs`, (j) => j.check_runs);
      const need = reviewNeeded({ headSha: x, headDate: head.commit.committer.date, checkRuns: runs, comments: await ghAll(`/repos/${o}/${r}/issues/${n}/comments`) });
      if (!need.need) { requested = true; await say(`Bugbot: no request needed (${need.why}).`); }
      else if (waited >= waitAuto) { await comment(o, r, n, "@cursor review"); requested = true; await say(`Bugbot: posted "@cursor review" on #${n}.`); }
    }
    await sleep(30_000);
  }
  return block(o, r, n, [`Bugbot gave no result for \`${short(x)}\` within ${process.env.BUGBOT_WAIT_MINUTES || 30} min.`]).then(() => process.exit(1));
}

async function verdict(o, r) {
  const n = Number(process.env.PR_NUMBER || 0);
  const results = JSON.parse(process.env.RESULTS || "{}");
  const bad = Object.entries(results).filter(([, v]) => v !== "success");
  const dry = truthy(process.env.DRY_RUN);
  const lines = Object.entries(results).map(([k, v]) => `- ${k}: ${v}`);
  if (bad.length) {
    // Bugbot / PR jobs already commented their own detail; this adds the overall table once.
    await block(o, r, n, [`Gate failed on \`${short(process.env.RELEASE_SHA)}\`:`, ...lines]);
    process.exit(1);
  }
  const pre = Number(process.env.PREFLIGHT_BLOCKERS || 0);
  const text = dry
    ? [`### Dry run: release gate GREEN on \`${short(process.env.RELEASE_SHA)}\``, ...lines, "", `Not merged (dry run). Convex prod deploy would run: ${process.env.CONVEX_CHANGED === "true" ? "yes" : "no"}. Merge method: ${process.env.MERGE_METHOD}.`, pre ? `A real run would stop at preflight: ${pre} blocker(s) (see the preflight summary).` : "A real run would merge now.", `Run: ${process.env.RUN_URL}`]
    : [`### Release gate GREEN on \`${short(process.env.RELEASE_SHA)}\``, ...lines, "", "Merging next."];
  await say(text);
  if (n && truthy(process.env.USER_TOKEN_SET) && dry) await comment(o, r, n, text.join("\n"));
}

async function prReady(o, r) {
  needUserToken("Checking the release PR");
  const n = Number(process.env.PR_NUMBER), x = process.env.RELEASE_SHA, masterSha = process.env.MASTER_SHA;
  const deadline = Date.now() + Number(process.env.CHECKS_WAIT_MINUTES || 60) * 60_000;
  let settledBlocked = 0;
  while (Date.now() < deadline) {
    if ((await tipOf(o, r, "integration")) !== x) return block(o, r, n, ["integration moved during the gate. Click again."]).then(() => process.exit(1));
    if ((await tipOf(o, r, "master")) !== masterSha) return block(o, r, n, ["master moved during the gate. Click again."]).then(() => process.exit(1));
    const pr = await gh(`/repos/${o}/${r}/pulls/${n}`);
    const v = mergeStateVerdict(pr.mergeable_state);
    if (v === "ready") return say(`Release PR #${n} is mergeable (${pr.mergeable_state}).`);
    if (v === "fail") return block(o, r, n, [`Release PR #${n} can't merge: mergeable_state=${pr.mergeable_state} (behind = master not in integration's history; dirty = conflicts). See DEPLOY.md "One-time setup".`]).then(() => process.exit(1));
    const runs = await ghAll(`/repos/${o}/${r}/commits/${x}/check-runs`, (j) => j.check_runs);
    const pending = runs.filter((c) => c.status !== "completed");
    if (pr.mergeable_state === "blocked" && !pending.length && ++settledBlocked >= 3) {
      const failing = Object.entries(latestChecks(runs)).filter(([, v2]) => !["success", "neutral", "skipped"].includes(v2)).map(([k, v2]) => `${k}=${v2}`);
      return block(o, r, n, [`Release PR #${n} is blocked with every check finished. Failing: ${failing.join(", ") || "none (a review/conversation/ruleset requirement)"}.`]).then(() => process.exit(1));
    }
    await sleep(30_000);
  }
  return block(o, r, n, [`Release PR #${n} required checks did not finish within ${process.env.CHECKS_WAIT_MINUTES || 60} min.`]).then(() => process.exit(1));
}

async function convexKey() {
  const c = assertLiveKeyTarget(process.env.CONVEX_DEPLOY_KEY_LIVE || "");
  if (!c.ok) { await say(`::error::${c.error}`); process.exit(1); }
  await say("CONVEX_DEPLOY_KEY_LIVE targets prod:precious-wildcat-890.");
}

async function waitProduction(o, r, sha, envName) {
  const deadline = Date.now() + Number(process.env.DEPLOY_WAIT_MINUTES || 30) * 60_000;
  while (Date.now() < deadline) {
    const deps = (await gh(`/repos/${o}/${r}/deployments?sha=${sha}&per_page=100`)).filter((d) => isProductionDeployment(d, envName));
    for (const d of deps) {
      const [st] = await gh(`/repos/${o}/${r}/deployments/${d.id}/statuses?per_page=1`);
      if (st && st.state === "success") return { ok: true, url: st.environment_url || st.target_url, log: st.log_url || st.target_url };
      if (st && ["failure", "error"].includes(st.state)) return { ok: false, detail: `Vercel production deployment is ${st.state}: ${st.target_url || st.log_url || ""}` };
    }
    await sleep(20_000);
  }
  return { ok: false, detail: `no successful Vercel "${envName}" deployment for ${short(sha)} within ${process.env.DEPLOY_WAIT_MINUTES || 30} min` };
}

async function health(sha) {
  const url = process.env.HEALTH_URL || DEFAULT_HEALTH_URL;
  const headers = { "cache-control": "no-cache" };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  let last = { ok: false, detail: "not tried" };
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}release=${Date.now()}`, { headers });
      last = judgeHealth(res.status, await res.text(), sha);
      if (last.ok) return last;
    } catch (e) { last = { ok: false, detail: e.message }; }
    await sleep(30_000);
  }
  return last;
}

async function ship(o, r) {
  needUserToken("Merging the release PR");
  const n = Number(process.env.PR_NUMBER), x = process.env.RELEASE_SHA;
  const method = process.env.MERGE_METHOD || "merge";
  const envName = process.env.PROD_ENVIRONMENT || DEFAULT_PROD_ENVIRONMENT;
  const { title, message } = releaseCommit({ date: israelDate(), number: n, xSha: x, runUrl: process.env.RUN_URL });
  try {
    await gh(`/repos/${o}/${r}/pulls/${n}/merge`, { method: "PUT", body: { merge_method: method, sha: x, commit_title: title, commit_message: message } });
  } catch (e) {
    return block(o, r, n, [`Merge into master failed (nothing deployed by this run): ${e.message.slice(0, 300)}`]).then(() => process.exit(1));
  }
  const s = await tipOf(o, r, "master");
  out("master_after", s);
  const [ts, tx] = [await treeOf(o, r, s), await treeOf(o, r, x)];
  const lines = [`## Released`, `- Merged #${n} into master as \`${s}\` (${method}).`, `- master tree ${ts === tx ? "==" : "!="} gate tree (integration \`${short(x)}\`).`];
  if (ts !== tx) return block(o, r, n, [...lines, "master's tree differs from the tested integration tree. Production is deploying it anyway (already merged). Check it; rollback steps in docs/DEPLOY.md."]).then(() => process.exit(1));
  const dep = await waitProduction(o, r, s, envName);
  if (!dep.ok) return block(o, r, n, [...lines, `- Vercel production: ${dep.detail}`, "Production may still serve the previous release. Rollback steps: docs/DEPLOY.md."]).then(() => process.exit(1));
  lines.push(`- Vercel production deployment READY: ${dep.url}`);
  const h = await health(s);
  if (!h.ok) return block(o, r, n, [...lines, `- ${process.env.HEALTH_URL || DEFAULT_HEALTH_URL}: ${h.detail}`, "The deploy is READY but the live site does not report the new commit. If production was rolled back earlier, Vercel stops auto-assigning the domain until someone clicks Undo Rollback (docs/DEPLOY.md). Check it; rollback steps: docs/DEPLOY.md."]).then(() => process.exit(1));
  lines.push(`- ${process.env.HEALTH_URL || DEFAULT_HEALTH_URL}: ${h.detail}`, "", `Rollback if needed: docs/DEPLOY.md (Vercel Instant Rollback). Run: ${process.env.RUN_URL}`);
  await say(lines);
  await comment(o, r, n, lines.join("\n"));
}

async function main() {
  const { owner, repo } = repoParts();
  const cmd = process.argv[2];
  const fns = { preflight, pr: openPr, bugbot, verdict, "pr-ready": prReady, "convex-key": convexKey, ship };
  if (!fns[cmd]) throw new Error(`command must be one of ${Object.keys(fns).join("|")}`);
  await fns[cmd](owner, repo);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => { await summary([`FAIL: ${e.message.slice(0, 500)}`]); process.exit(1); });
}
