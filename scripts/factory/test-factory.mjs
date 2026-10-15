// Unit tests for the Phase 04 factory scripts (pure functions; no API). Run: node scripts/factory/test-factory.mjs
import assert from "node:assert/strict";
import { pick, overlaps, activeBatches } from "./next-tickets.mjs";
import { order } from "./merge-train.mjs";
import { classify } from "./failures.mjs";
import { labelsFor } from "./label-pr.mjs";
import { agentBody } from "./cursor-lane.mjs";
import { ticketBranch } from "./factory-lib.mjs";
import { plan } from "./promote.mjs";
import { validate } from "./validate-tickets.mjs";
import { isTicketPath, MARKER } from "./tickets-lib.mjs";
import { linkedTickets } from "./gh-api.mjs";
import { bugbotState, findingsNote } from "./review-gate.mjs";
import { nextStep, ownerTicket } from "./review-fix.mjs";
import { judge as scopeJudge, judgeBatch, isBatchPR } from "./scope-guard.mjs";
import { ciGreen, readiness, mergeOrder, batchBody, reviewNeeded, batchBranch, isConflict, FINALIZE_CLEARS } from "./batch-loop.mjs";
import { loopRouting } from "./validate-tickets.mjs";
import { shouldDeploy, assertLiveKeyTarget, judgeSmoke } from "./deploy-live-plan.mjs";
import { israelDate, isReleaseTitle, prNumbersFromMessage, renderReleaseBody } from "./release-pr.mjs";
import { quietHours, inWindow, parseHour, jerusalemHour } from "./quiet-hours.mjs";
import { chooseLane, preference, atLimit, available, ticketKind, MANUAL_FALLBACKS } from "./lane-limits.mjs";

let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const T = (number, ticket, batch, type, scope, labels = ["status:ready"], extra = {}) => ({ number, title: ticket, labels, fm: { ticket, batch, type, scope, ...extra } });
// FACTORY_QUIET_HOURS=off keeps the older pick() tests independent of the wall clock (quiet hours have their own tests).
const ENV = { FACTORY_PAUSED_ALL: "false", FACTORY_PAUSED: "false", FACTORY_MAX_IN_FLIGHT: "15", FACTORY_ACTIVE_BATCHES: "B02", FACTORY_QUIET_HOURS: "off" };

t("overlap: equal, inside, containing; siblings don't", () => {
  assert.ok(overlaps(["apps/web/a/"], ["apps/web/a"]));
  assert.ok(overlaps(["apps/web/a/b/"], ["apps/web/a/"]));
  assert.ok(overlaps(["apps/web/"], ["apps/web/a/"]));
  assert.ok(!overlaps(["apps/web/a/"], ["apps/web/ab/"]));
});
t("paused -> nothing ready", () => {
  const r = pick([T(1, "X-1", "B02", "component", ["a/"])], { ...ENV, FACTORY_PAUSED: "true" });
  assert.equal(r.paused, true); assert.equal(r.ready.length, 0);
});
t("force overrides pause (manual run only)", () => {
  assert.equal(pick([T(1, "X-1", "B02", "component", ["a/"])], { ...ENV, FACTORY_PAUSED_ALL: "true", FORCE: "true" }).ready.length, 1);
});
t("active batches: none / list / all", () => {
  assert.equal(activeBatches("none").size, 0); assert.equal(activeBatches("all"), "all"); assert.ok(activeBatches("B01,B02").has("B02"));
  assert.equal(pick([T(1, "X-1", "B03", "component", ["a/"])], ENV).ready.length, 0);
  assert.equal(pick([T(1, "X-1", "B03", "component", ["a/"])], { ...ENV, FACTORY_ACTIVE_BATCHES: "none" }).ready.length, 0);
});
t("scope overlap with an open ticket or an earlier pick is skipped; overlap_test pair allowed", () => {
  const r = pick([T(1, "B02-01", "B02", "component", ["apps/web/x/"]), T(2, "B02-02", "B02", "component", ["apps/web/x/y/"]), T(3, "B02-03", "B02", "component", ["apps/web/z/"], ["status:in-pr"]),
    T(4, "B02-04", "B02", "component", ["apps/web/z/q/"])], ENV);
  assert.deepEqual(r.ready.map((x) => x.ticket), ["B02-01"]);
  const o = pick([T(1, "B02-01", "B02", "component", ["s/"], ["status:ready"], { overlap_test: "true" }), T(2, "B02-02", "B02", "component", ["s/"], ["status:ready"], { overlap_test: "true" })], ENV);
  assert.equal(o.ready.length, 2);
});
t("depends_on must be status:done; max in flight", () => {
  const r = pick([T(1, "B02-01", "B02", "data", ["convex/"], ["status:in-pr"]), T(2, "B02-02", "B02", "component", ["a/"], ["status:ready"], { depends_on: ["B02-01"] })], ENV);
  assert.equal(r.ready.length, 0); assert.match(r.skipped[0].reason, /depends_on/);
  const m = pick([T(1, "B02-01", "B02", "component", ["a/"]), T(2, "B02-02", "B02", "component", ["b/"])], { ...ENV, FACTORY_MAX_IN_FLIGHT: "1" });
  assert.equal(m.ready.length, 1);
});
t("lanes: data -> claude; build split claude+codex, cursor last; codex manual -> claude only", () => {
  const all = Array.from({ length: 9 }, (_, i) => T(i + 1, `B02-0${i + 1}`, "B02", i === 0 ? "data" : "component", [`f${i}/`]));
  const r = pick(all, ENV);
  assert.equal(r.ready[0].lane, "claude");
  const n = (res, l) => res.ready.filter((x) => x.lane === l).length;
  assert.equal(n(r, "cursor"), 0); assert.equal(n(r, "claude"), 5); assert.equal(n(r, "codex"), 4);
  assert.deepEqual(r.agent_preference, ["claude", "codex", "cursor"]); assert.deepEqual(r.available_lanes, ["claude", "codex", "cursor"]);
  const m = pick(all, { ...ENV, FACTORY_CODEX_MODE: "manual" });
  assert.equal(n(m, "codex"), 0); assert.equal(n(m, "claude"), 9);
});
t("merge order: per batch data first, then ticket order", () => {
  const o = order([{ fm: { batch: "B02", type: "component", ticket: "B02-10" } }, { fm: { batch: "B02", type: "data", ticket: "B02-05" } }, { fm: { batch: "B01", type: "component", ticket: "B01-02" } }, { fm: { batch: "B02", type: "component", ticket: "B02-2" } }]);
  assert.deepEqual(o.map((x) => x.fm.ticket), ["B01-02", "B02-05", "B02-2", "B02-10"]);
});
t("failure classification", () => {
  assert.equal(classify("src/a.tsx(3,10): error TS2305: Module '\"x\"' has no exported member 'Foo'."), "misalignment");
  assert.equal(classify("Property 'bar' does not exist on type 'Task'"), "misalignment");
  assert.equal(classify("expect(received).toBe(expected)"), "other");
});
t("PR labels from front-matter; data never held", () => {
  assert.deepEqual(labelsFor({ type: "data", batch: "B02", hold: "true" }), ["factory", "ticket:data", "batch:B02"]);
  assert.deepEqual(labelsFor({ type: "component", batch: "B02", hold: "true", overlap_test: "true" }), ["factory", "ticket:component", "batch:B02", "test:overlap", "hold:stress-test"]);
});
t("ticket branch is t/<issue>-<slug>", () => {
  assert.equal(ticketBranch(42, "TEMPO-B02-04"), "t/42-tempo-b02-04");
});
t("Cursor API body (v1)", () => {
  const b = agentBody({ prompt: "p", model: "grok-4.7", params: "fast=true", repoUrl: "https://github.com/o/r", ref: "factory/X-1", prUrl: "", name: "[X-1] t" });
  assert.deepEqual(b.model, { id: "grok-4.7", params: [{ id: "fast", value: "true" }] });
  assert.equal(b.autoCreatePR, true); assert.equal(b.repos[0].startingRef, "factory/X-1");
  const r = agentBody({ prompt: "p", model: "", params: "", repoUrl: "u", ref: "x", prUrl: "https://github.com/o/r/pull/5", name: "n" });
  assert.equal(r.autoCreatePR, false); assert.equal(r.repos[0].prUrl, "https://github.com/o/r/pull/5"); assert.equal(r.model, undefined);
});

// Phase 06: promoter + ticket-writer check
const TF = (id, type, scope, extra = "") => ({ path: `docs/tickets/DRY/${id}.md`, text: `---\nticket: ${id}\nbatch: DRY\ntype: ${type}\nlane: ${type === "data" ? "claude" : "auto"}\nscope:\n  - ${scope}\nhold: false\n${extra}---\n\nFOR: x\nGOAL: Goal of ${id}\n` });
const LOOP_LANE = ["claude", "claude", "claude", "cursor", "cursor", "cursor", "codex", "codex"];
const TFL = (id, scope, lane) => { const f = TF(id, "component", scope, `browser_test: ${lane !== "claude"}\n`); f.text = f.text.replace("lane: auto", `lane: ${lane}`); return f; };
const BATCH9 = [TF("T-DRY-01", "data", "convex/"), ...Array.from({ length: 8 }, (_, i) => TFL(`T-DRY-0${i + 2}`, `apps/web/components/f${i + 2}/`, LOOP_LANE[i]))];
t("ticket paths: batch files only, never _templates/README", () => {
  assert.ok(isTicketPath("docs/tickets/B1/T-1.md"));
  assert.ok(!isTicketPath("docs/tickets/_templates/component.md"));
  assert.ok(!isTicketPath("docs/tickets/README.md"));
  assert.ok(!isTicketPath("docs/tickets/B1/README.md"));
});
t("promoter: 9 creates with labels; invalid skipped", () => {
  const bad = { path: "docs/tickets/DRY/bad.md", text: "no front matter" };
  const r = plan({ files: [...BATCH9, bad], issues: [] });
  assert.equal(r.actions.length, 9); assert.equal(r.skipped.length, 1);
  assert.deepEqual(r.actions[0].labels, ["status:ready", "factory", "ticket:data", "batch:DRY", "lane:claude"]);
  assert.deepEqual(r.actions[1].labels, ["status:ready", "factory", "ticket:component", "batch:DRY", "lane:claude"]);
  assert.equal(r.actions[1].title, "[T-DRY-02] Goal of T-DRY-02");
  assert.ok(r.actions[1].body.endsWith(MARKER("docs/tickets/DRY/T-DRY-02.md") + "\n"));
});
t("promoter: existing marker -> no duplicate; status labels untouched; deleted -> paused:dependency", () => {
  const first = plan({ files: BATCH9, issues: [] }).actions;
  const issues = first.map((a, i) => ({ number: 100 + i, state: "open", title: a.title, body: a.body, labels: a.labels.filter((l) => l !== "status:ready").concat("status:in-pr") }));
  assert.equal(plan({ files: BATCH9, issues }).actions.length, 0);
  const r = plan({ files: BATCH9.slice(1), issues, deleted: [BATCH9[0].path] });
  assert.deepEqual(r.actions, [{ op: "deleted", path: BATCH9[0].path, issue: 100 }]);
});
t("writer check: 9 = 1 data + 8 separate components, contract, only batch files", () => {
  const ok = validate({ batch: "DRY", size: 9, hold: false, files: BATCH9, changed: [...BATCH9.map((f) => f.path), "docs/contracts/DRY.md"], contractExists: true });
  assert.deepEqual(ok.problems, []);
  const shared = [...BATCH9.slice(0, 8), TFL("T-DRY-09", "apps/web/components/f2/sub/", "codex")];
  assert.ok(validate({ batch: "DRY", size: 9, hold: false, files: shared, contractExists: true }).problems.some((p) => p.includes("share scope")));
  assert.ok(validate({ batch: "DRY", size: 9, hold: true, files: BATCH9, contractExists: false }).problems.length >= 9);
  assert.ok(validate({ batch: "DRY", size: 9, hold: false, files: BATCH9, changed: ["package.json"], contractExists: true }).problems.some((p) => p.includes("outside the batch")));
});

t("release date uses Asia/Jerusalem", () => {
  assert.equal(israelDate(new Date("2026-10-04T22:30:00.000Z")), "2026-10-05");
  assert.equal(israelDate(new Date("2026-10-04T20:30:00.000Z")), "2026-10-04");
  assert.equal(isReleaseTitle("Release 2026-10-05"), true);
  assert.equal(isReleaseTitle("Release notes"), false);
});
t("release body lists PRs without a closing keyword", () => {
  assert.deepEqual(prNumbersFromMessage("feat(tasks): add a card (#482)\n\nbody mentions #9"), [482]);
  assert.deepEqual(prNumbersFromMessage("Merge pull request #12 from org/branch"), [12]);
  assert.deepEqual(prNumbersFromMessage("see #12 in the body only"), []);
  const body = renderReleaseBody({
    date: "2026-10-05", masterSha: "abc123", ahead: 2, truncated: false,
    rows: [{ number: 482, title: "feat(tasks): add a card", closes: [12] }],
  });
  assert.match(body, /#482 feat\(tasks\): add a card \(links #12\)/);
  assert.deepEqual(linkedTickets(body), []);
});
t("dry_run never deploys, including a master push", () => {
  for (const eventName of ["push", "workflow_dispatch"]) {
    const d = shouldDeploy({ eventName, ref: "refs/heads/master", dryRun: "true", pausedAll: "false", force: "true", actor: "Division6066" });
    assert.equal(d.action, "dry_run");
    assert.equal(d.exitCode, 0);
  }
});
t("real deploy only on master, and paused refuses unless a person forces a dispatch", () => {
  assert.equal(shouldDeploy({ eventName: "push", ref: "refs/heads/master", dryRun: "false", pausedAll: "false", force: "false", actor: "" }).action, "deploy");
  assert.equal(shouldDeploy({ eventName: "push", ref: "refs/heads/master", dryRun: "false", pausedAll: "true", force: "true", actor: "Division6066" }).action, "refuse");
  assert.equal(shouldDeploy({ eventName: "workflow_dispatch", ref: "refs/heads/integration", dryRun: "false", pausedAll: "false", force: "false", actor: "Division6066" }).action, "refuse");
  assert.equal(shouldDeploy({ eventName: "workflow_dispatch", ref: "refs/heads/master", dryRun: "false", pausedAll: "true", force: "true", actor: "some-app[bot]" }).action, "refuse");
  assert.equal(shouldDeploy({ eventName: "workflow_dispatch", ref: "refs/heads/master", dryRun: "false", pausedAll: "true", force: "true", actor: "Division6066" }).action, "deploy");
  assert.equal(shouldDeploy({ eventName: "", ref: "", dryRun: "", pausedAll: "", force: "", actor: "" }).action, "dry_run");
});
t("live key target is checked without echoing the key", () => {
  const bad = assertLiveKeyTarget("dev:ceaseless-dog-617|example-not-a-key");
  assert.equal(bad.ok, false);
  assert.equal(bad.error.includes("example-not-a-key"), false);
  assert.equal(bad.error.includes("dev:ceaseless-dog-617"), false);
  assert.equal(assertLiveKeyTarget("").ok, false);
  assert.equal(assertLiveKeyTarget("no-pipe").ok, false);
  assert.equal(assertLiveKeyTarget("prod:precious-wildcat-890|example-not-a-key").ok, true);
});
t("smoke requires tempoflow.dev and /api/health", () => {
  assert.equal(judgeSmoke(200, 200, JSON.stringify({ ok: true, service: "tempo-web" })).ok, true);
  assert.equal(judgeSmoke(500, 200, JSON.stringify({ ok: true, service: "tempo-web" })).ok, false);
  assert.equal(judgeSmoke(200, 200, JSON.stringify({ ok: true, service: "other" })).ok, false);
  assert.equal(judgeSmoke(200, 404, "missing").ok, false);
});


t("review gate: Bugbot clean / findings / pending / blocked", () => {
  const run = (o) => ({ name: "Cursor Bugbot", app: { slug: "cursor" }, status: "completed", conclusion: "success", ...o });
  const th = (o) => ({ isResolved: false, isOutdated: false, path: "a.ts", line: 3, author: { login: "cursor[bot]" }, body: "Bug: x", ...o });
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [run()] }).state, "clean");
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [run({ conclusion: "neutral" })], threads: [th({ isResolved: true })] }).state, "clean");
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [run()], threads: [th()] }).state, "findings");
  assert.equal(bugbotState({ headSha: "abc", threads: [th({ author: { login: "someone" } })] }).state, "pending");
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [run({ status: "in_progress", conclusion: null })] }).state, "pending");
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [run({ conclusion: "failure" })] }).state, "findings");
  assert.equal(bugbotState({ headSha: "abc", comments: [{ user: { login: "cursor[bot]" }, body: "Bugbot couldn't run — GitHub account mismatch" }] }).state, "blocked");
  // The release gate's own Actions job is not Bugbot: it must not make the gate wait on itself.
  const gateJob = { name: "gate Bugbot (one review)", app: { slug: "github-actions" }, status: "in_progress", conclusion: null };
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [gateJob, run()] }).state, "clean");
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [gateJob] }).state, "pending");
  assert.ok(findingsNote([th()]).startsWith("BUGBOT REVIEW FINDINGS"));
});
t("review fix loop: 3 attempts then blocked:amit", () => {
  assert.deepEqual(nextStep({ state: "findings", labels: [] }), { action: "fix", attempt: 1 });
  assert.deepEqual(nextStep({ state: "findings", labels: ["review-fix:1", "review-fix:2"] }), { action: "fix", attempt: 3 });
  assert.equal(nextStep({ state: "findings", labels: ["review-fix:1", "review-fix:2", "review-fix:3"] }).action, "block");
  assert.equal(nextStep({ state: "blocked", labels: [] }).action, "block");
  assert.equal(nextStep({ state: "clean", labels: [] }).action, "none");
  assert.equal(nextStep({ state: "findings", labels: ["blocked:amit"] }).action, "none");
});

const SG_CFG = { dataFolders: ["convex/"], extraHotFiles: ["(^|/)convex\\.json$"] };
const prOf = (head, base = "integration") => ({ head: { ref: head, repo: { full_name: "o/r" } }, base: { ref: base, repo: { full_name: "o/r" } } });
const cf = (files, mergeFix = false) => [{ sha: "a", mergeFix, files }];
t("scope-guard h: component touching convex/ fails unless convex-arch is approved", () => {
  const fm = { ticket: "T-1", type: "component", scope: ["apps/web/components/x/"] };
  const files = [{ filename: "convex/schema.ts" }, { filename: "apps/web/components/x/A.tsx" }];
  const base = { pr: prOf("t/1-t-1"), ticket: 1, fm, files, commitFiles: cf(["convex/schema.ts", "apps/web/components/x/A.tsx"]), config: SG_CFG };
  assert.ok(scopeJudge({ ...base, labels: [] }).problems.some((p) => p.includes("convex-arch")));
  assert.ok(scopeJudge({ ...base, labels: ["convex-arch"], archApproved: false }).problems.some((p) => p.includes("convex-arch")));
  assert.deepEqual(scopeJudge({ ...base, labels: ["convex-arch"], archApproved: true }).problems, []);
  assert.ok(scopeJudge({ ...base, labels: ["convex-arch"], archApproved: true, files: [{ filename: "package.json" }], commitFiles: cf(["package.json"]) }).problems.some((p) => p.includes("hot")));
});
t("scope-guard i: batch PR = union of ticket scopes; convex/ and hot files fail", () => {
  assert.ok(isBatchPR(prOf("batch/f3-1"))); assert.ok(!isBatchPR(prOf("batch/f3-1", "master"))); assert.ok(!isBatchPR(prOf("t/1-x")));
  const tickets = [{ number: 1, fm: { scope: ["apps/web/components/a/"] } }, { number: 2, fm: { scope: ["apps/web/components/b/"] } }];
  const ok = judgeBatch({ pr: prOf("batch/f3-1"), labels: [], tickets, files: [{ filename: "apps/web/components/a/A.tsx" }, { filename: "apps/web/components/b/B.tsx" }], commitFiles: [], config: SG_CFG });
  assert.deepEqual(ok.problems, []);
  const bad = judgeBatch({ pr: prOf("batch/f3-1"), labels: [], tickets, files: [{ filename: "convex/x.ts" }, { filename: "apps/web/other/C.tsx" }, { filename: "package.json" }], commitFiles: [], config: SG_CFG });
  assert.equal(bad.problems.length, 3);
  assert.ok(judgeBatch({ pr: prOf("batch/f3-1"), labels: [], tickets: [{ number: 3, fm: null }], files: [], commitFiles: [], config: SG_CFG }).problems[0].includes("front-matter"));
  assert.deepEqual(judgeBatch({ pr: prOf("batch/f3-1"), labels: ["convex-arch"], archApproved: true, tickets, files: [{ filename: "convex/x.ts" }], commitFiles: [], config: SG_CFG }).problems, []);
});
t("review gate: usage-limit note after the last run = blocked, not clean", () => {
  const run = { name: "Cursor Bugbot", status: "completed", conclusion: "neutral", completed_at: "2026-10-06T01:00:00Z" };
  const note = (at) => ({ user: { login: "cursor[bot]" }, created_at: at, body: "<h3>Bugbot couldn't run - usage limit reached</h3>" });
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [run], comments: [note("2026-10-06T01:05:00Z")] }).state, "blocked");
  assert.equal(bugbotState({ headSha: "abc", checkRuns: [run], comments: [note("2026-10-06T00:55:00Z")] }).state, "clean");
});
t("batch loop: CI gate, readiness (drafts allowed), order, body, one review request", () => {
  const ck = (name, conclusion, id = 1) => ({ id, name, status: "completed", conclusion });
  const green = ["ci", "e2e-preview", "secret-scan", "config-guard", "scope-guard"].map((n, i) => ck(n, "success", i + 1));
  assert.ok(ciGreen(green).ok);
  assert.deepEqual(ciGreen([...green, ck("ci", "failure", 99)]).bad, ["ci=failure"]);
  assert.ok(readiness({ pr: { state: "open", draft: true }, labels: [], checkRuns: green }).ok);
  assert.ok(!readiness({ pr: { state: "open" }, labels: ["blocked:amit"], checkRuns: green }).ok);
  assert.ok(!readiness({ pr: { state: "open" }, labels: [], checkRuns: green.slice(1) }).ok);
  assert.deepEqual(mergeOrder([{ number: 2, fm: { ticket: "X-03", type: "component" } }, { number: 1, fm: { ticket: "X-10", type: "data" } }, { number: 3, fm: { ticket: "X-02", type: "component" } }]).map((x) => x.number), [1, 3, 2]);
  const body = batchBody({ loop: "f3-1", merged: [{ number: 10, ticket: 5, fm: { ticket: "X-01" } }, { number: 11, ticket: 6, fm: { ticket: "X-02" } }], skipped: [] });
  assert.deepEqual(linkedTickets(body), [5, 6]);
  assert.equal(batchBranch("f3-1"), "batch/f3-1"); assert.throws(() => batchBranch("a b"));
  assert.equal(isConflict(new Error("GitHub API POST /merges -> 409 {\"message\":\"Merge conflict\"}")), true);
  assert.equal(isConflict(new Error("GitHub API POST /merges -> 403 forbidden")), false);
  assert.ok(FINALIZE_CLEARS.includes("status:ready") && !FINALIZE_CLEARS.includes("status:done"));
  const head = { headSha: "abc", headDate: "2026-10-06T08:00:00Z" };
  assert.equal(reviewNeeded({ ...head, checkRuns: [], comments: [] }).need, true);
  assert.equal(reviewNeeded({ ...head, checkRuns: [{ name: "Cursor Bugbot", status: "in_progress" }], comments: [] }).need, false);
  assert.equal(reviewNeeded({ ...head, checkRuns: [{ name: "gate Bugbot (one review)", app: { slug: "github-actions" }, status: "in_progress" }], comments: [] }).need, true);
  assert.equal(reviewNeeded({ ...head, checkRuns: [], comments: [{ user: { login: "Division6066" }, body: "@cursor review", created_at: "2026-10-06T08:01:00Z" }] }).need, false);
  assert.equal(reviewNeeded({ ...head, checkRuns: [], comments: [{ user: { login: "Division6066" }, body: "@cursor review", created_at: "2026-10-06T07:00:00Z" }] }).need, true);
});
t("batch fix: finding goes to the ticket that owns the file", () => {
  const tickets = [{ number: 1, fm: { scope: ["apps/web/components/a/"] } }, { number: 2, fm: { scope: ["apps/web/components/b/"] } }];
  assert.equal(ownerTicket([{ path: "apps/web/components/b/B.tsx" }], tickets), 2);
  assert.equal(ownerTicket([{ path: "elsewhere.ts" }], tickets), 1);
});
t("loop routing: browser tests -> cursor/codex, others -> claude; 2..5 per lane", () => {
  const C = (ticket, lane, browser_test) => ({ fm: { ticket, lane, browser_test } });
  const ok = [C("a", "claude", "false"), C("b", "claude", "false"), C("c", "cursor", "true"), C("d", "cursor", "true"), C("e", "codex", "true"), C("f", "codex", "true")];
  assert.deepEqual(loopRouting(ok), []);
  assert.ok(loopRouting([...ok.slice(1), C("x", "claude", "true")]).some((p) => p.includes("needs lane cursor or codex")));
  assert.ok(loopRouting([...ok, C("y", "cursor", "false")]).some((p) => p.includes("goes to lane claude")));
  assert.ok(loopRouting([...ok, C("z", "auto", "false")]).some((p) => p.includes("lane must be")));
  assert.ok(loopRouting(ok.slice(0, 5)).some((p) => p.includes("lane codex has 1")));
});

// Quiet hours (factory/LOOP.md): 22:00-09:00 Asia/Jerusalem nothing new starts.
const IL = (iso) => new Date(iso); // explicit offsets below: +03:00 = IDT (summer), +02:00 = IST (winter)
t("quiet hours: hour is Asia/Jerusalem wall clock in summer and winter (DST-safe)", () => {
  assert.equal(jerusalemHour(IL("2026-10-06T22:00:00+03:00")), 22);
  assert.equal(jerusalemHour(IL("2026-10-06T19:00:00Z")), 22); // 19:00 UTC = 22:00 IDT
  assert.equal(jerusalemHour(IL("2026-12-01T20:00:00Z")), 22); // 20:00 UTC = 22:00 IST
  assert.equal(jerusalemHour(IL("2026-12-01T06:59:00Z")), 8);
});
t("quiet hours: window 22-9 wraps midnight; start inclusive, end exclusive; start == end = none", () => {
  for (const h of [22, 23, 0, 3, 8]) assert.ok(inWindow(h, 22, 9), `hour ${h}`);
  for (const h of [9, 12, 19, 20, 21]) assert.ok(!inWindow(h, 22, 9), `hour ${h}`);
  assert.ok(inWindow(10, 10, 16) && !inWindow(16, 10, 16));
  assert.ok(!inWindow(5, 7, 7));
});
t("quiet hours: defaults 22/9, vars override, bad values fall back with a warning", () => {
  const w = [];
  assert.equal(parseHour("", 22), 22);
  assert.equal(parseHour(" 21 ", 22), 21);
  assert.equal(parseHour("25", 9, w), 9);
  assert.equal(parseHour("nine", 9, w), 9);
  assert.equal(w.length, 2);
  assert.equal(quietHours({ env: {}, now: IL("2026-10-06T23:30:00+03:00") }).quiet, true);
  assert.equal(quietHours({ env: {}, now: IL("2026-10-06T09:00:00+03:00") }).quiet, false);
  assert.equal(quietHours({ env: {}, now: IL("2026-10-06T21:59:00+03:00") }).quiet, false);
  assert.equal(quietHours({ env: { FACTORY_QUIET_START: "20" }, now: IL("2026-10-06T21:00:00+03:00") }).quiet, true);
  assert.equal(quietHours({ env: { FACTORY_QUIET_END: "7" }, now: IL("2026-10-06T08:00:00+03:00") }).quiet, false);
});
t("quiet hours: FACTORY_QUIET_HOURS=off and in-flight exemption never skip; reason says 'quiet hours, skipped'", () => {
  const night = IL("2026-10-07T02:00:00+03:00");
  const q = quietHours({ env: {}, now: night });
  assert.ok(q.quiet && q.reason.startsWith("quiet hours, skipped"));
  assert.equal(quietHours({ env: { FACTORY_QUIET_HOURS: "off" }, now: night }).quiet, false);
  assert.equal(quietHours({ env: { FACTORY_QUIET_HOURS: "OFF " }, now: night }).quiet, false);
  const ex = quietHours({ env: { QUIET_EXEMPT: "true", QUIET_EXEMPT_REASON: "fix run" }, now: night });
  assert.ok(!ex.quiet && ex.reason.includes("fix run"));
});
t("quiet hours: next-tickets dispatches nothing at night (paused + reason), even with FORCE; daytime unchanged", () => {
  const tk = [T(1, "TEMPO-B02-00", "B02", "data", ["convex/"])];
  const env = { ...ENV, FACTORY_QUIET_HOURS: "" };
  const night = pick(tk, { ...env, FORCE: "true" }, IL("2026-10-06T23:00:00+03:00"));
  assert.equal(night.paused, true);
  assert.ok(night.reason.startsWith("quiet hours"));
  assert.equal(night.ready.length, 0);
  const day = pick(tk, env, IL("2026-10-06T13:00:00+03:00"));
  assert.equal(day.paused, false);
  assert.equal(day.ready.length, 1);
});


t("lane-limits: preference var, unknown names ignored, missing lanes appended", () => {
  assert.deepEqual(preference({}), ["claude", "codex", "cursor"]);
  assert.deepEqual(preference({ FACTORY_AGENT_PREFERENCE: "cursor, Codex,foo,cursor" }), ["cursor", "codex", "claude"]);
  assert.deepEqual(preference({ FACTORY_AGENT_PREFERENCE: "codex" }), ["codex", "claude", "cursor"]);
  assert.deepEqual(atLimit({ FACTORY_CURSOR_AT_LIMIT: "TRUE", FACTORY_CODEX_AT_LIMIT: "false" }), { claude: false, codex: false, cursor: true, freebuff: false, opencode: false });
  assert.deepEqual(available({ FACTORY_CLAUDE_AT_LIMIT: "true" }, { codexMode: "manual" }), ["cursor"]);
});
t("lane-limits: cursor at limit -> claude/codex only; codex at limit -> claude, then cursor", () => {
  const cur = { FACTORY_CURSOR_AT_LIMIT: "true" };
  assert.equal(chooseLane({ want: "cursor" }, cur).lane, "claude");
  assert.equal(chooseLane({ kind: "browser", want: "cursor" }, cur).lane, "codex");
  assert.equal(chooseLane({ kind: "browser" }, cur).lane, "codex");
  assert.equal(chooseLane({ counts: { claude: 3, codex: 1 } }, cur).lane, "codex");
  const cod = { FACTORY_CODEX_AT_LIMIT: "true" };
  assert.equal(chooseLane({}, cod).lane, "claude");
  assert.equal(chooseLane({ counts: { claude: 9 } }, cod).lane, "claude"); // cursor is the fallback, not a balancing peer
  assert.equal(chooseLane({ want: "codex" }, cod).lane, "claude");
  assert.equal(chooseLane({ kind: "browser" }, cod).lane, "cursor");
  assert.equal(chooseLane({}, { ...cod, FACTORY_CLAUDE_AT_LIMIT: "true" }).lane, "cursor");
  assert.equal(chooseLane({ kind: "data" }, { FACTORY_CLAUDE_AT_LIMIT: "true" }).lane, "codex");
  assert.equal(chooseLane({ kind: "browser" }, { FACTORY_CODEX_AT_LIMIT: "true", FACTORY_CURSOR_AT_LIMIT: "true" }).lane, "claude");
  assert.equal(ticketKind({ type: "component", browser_test: "true" }), "browser"); assert.equal(ticketKind({ type: "data", browser_test: "true" }), "data");
});
t("lane-limits: all three at limit -> freebuff, then opencode (manual), then blocked:amit; never a paid API lane", () => {
  const all = { FACTORY_CLAUDE_AT_LIMIT: "true", FACTORY_CODEX_AT_LIMIT: "true", FACTORY_CURSOR_AT_LIMIT: "true" };
  for (const kind of ["build", "data", "browser"]) for (const want of [null, "claude", "codex", "cursor"]) {
    const c = chooseLane({ kind, want }, all);
    assert.equal(c.lane, "freebuff"); assert.equal(c.manual, true); assert.match(c.reason, /usage limits/);
    assert.deepEqual(c.labels, ["agent:freebuff", "needs:manual-run"]);
  }
  assert.deepEqual(MANUAL_FALLBACKS, ["freebuff", "opencode"]);
  const oc = chooseLane({}, { ...all, FACTORY_FREEBUFF_AT_LIMIT: "true" });
  assert.equal(oc.lane, "opencode"); assert.equal(oc.manual, true); assert.deepEqual(oc.labels, ["agent:opencode", "needs:manual-run"]);
  const none = chooseLane({ want: "cursor" }, { ...all, FACTORY_FREEBUFF_AT_LIMIT: "true", FACTORY_OPENCODE_AT_LIMIT: "true" });
  assert.equal(none.lane, null); assert.equal(none.blocked, true); assert.deepEqual(none.labels, ["blocked:amit"]); assert.match(none.reason, /usage limits/);
  assert.equal(chooseLane({}, { FACTORY_FREEBUFF_AT_LIMIT: "true", FACTORY_OPENCODE_AT_LIMIT: "true" }).lane, "claude"); // fallbacks only after the 3 lanes
  for (const env of [{}, all, { FACTORY_AGENT_PREFERENCE: "metered,api,copilot,freebuff,opencode" }]) {
    assert.ok(["claude", "codex", "cursor"].includes(chooseLane({}, env === all ? {} : env).lane));
  }
  assert.deepEqual(preference({ FACTORY_AGENT_PREFERENCE: "opencode,freebuff,cursor" }), ["cursor", "claude", "codex"]); // fallbacks can't be promoted
});
t("next-tickets: limits route lanes, pinned lanes, all-at-limit -> manual_fallback without a slot", () => {
  const tk = [T(1, "B02-01", "B02", "component", ["a/"], ["status:ready"], { lane: "cursor", lane_pin: "true" }),
    T(2, "B02-02", "B02", "component", ["b/"], ["status:ready"], { browser_test: "true", lane: "cursor" }),
    T(3, "B02-03", "B02", "component", ["c/"], ["status:ready", "needs:manual-run", "agent:freebuff"])];
  const r = pick(tk, ENV);
  assert.equal(r.ready[0].lane, "cursor"); assert.equal(r.ready[1].lane, "codex"); assert.equal(r.ready.length, 2);
  assert.ok(r.skipped.some((x) => x.issue === 3 && /needs:manual-run/.test(x.reason)));
  const c = pick(tk, { ...ENV, FACTORY_CURSOR_AT_LIMIT: "true" });
  assert.equal(c.ready[0].lane, "claude"); assert.match(c.ready[0].lane_reason, /cursor at usage limit/);
  const all = pick(tk, { ...ENV, FACTORY_MAX_IN_FLIGHT: "2", FACTORY_CLAUDE_AT_LIMIT: "true", FACTORY_CODEX_AT_LIMIT: "true", FACTORY_CURSOR_AT_LIMIT: "true" });
  assert.equal(all.ready.length, 0); assert.equal(all.all_at_limit, true);
  assert.deepEqual(all.manual_fallback.map((x) => [x.issue, x.lane, x.labels.join("+")]), [[1, "freebuff", "agent:freebuff+needs:manual-run"], [2, "freebuff", "agent:freebuff+needs:manual-run"]]);
  const oc = pick(tk, { ...ENV, FACTORY_CLAUDE_AT_LIMIT: "true", FACTORY_CODEX_AT_LIMIT: "true", FACTORY_CURSOR_AT_LIMIT: "true", FACTORY_FREEBUFF_AT_LIMIT: "true" });
  assert.deepEqual(oc.manual_fallback.map((x) => x.labels.join("+")), ["agent:opencode+needs:manual-run", "agent:opencode+needs:manual-run"]);
});

console.log(`all ${n} passed`);
