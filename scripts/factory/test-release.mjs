// Unit tests for release-gate.mjs (Phase H release workflow; pure functions, no API).
// Run: node scripts/factory/test-release.mjs
import assert from "node:assert/strict";
import { allowedMergeMethods, preflightBlockers, mergeStateVerdict, judgeHealth, isProductionDeployment, releaseCommit, renderBody, MARKER as RELEASE_MARKER } from "./release-gate.mjs";

let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

t("release: merge methods = repo settings ∩ ruleset ∩ linear history", () => {
  const repo = { allow_merge_commit: false, allow_squash_merge: true, allow_rebase_merge: false };
  const rules = [{ type: "pull_request", parameters: { allowed_merge_methods: ["merge", "squash", "rebase"] } }];
  assert.deepEqual(allowedMergeMethods({ repo, rules, linear: true }), ["squash"]);
  assert.deepEqual(allowedMergeMethods({ repo: { ...repo, allow_merge_commit: true }, rules, linear: false }), ["merge", "squash"]);
  assert.deepEqual(allowedMergeMethods({ repo: { ...repo, allow_merge_commit: true }, rules, linear: true }), ["squash"]);
});
t("release: preflight blockers (update rule, behind+strict, conflicts, hotfix, method, token)", () => {
  const base = { rules: [], behindBy: 0, conflicts: 0, mergeTree: "t", xTree: "t", allowed: ["merge"], method: "merge", userToken: true };
  assert.deepEqual(preflightBlockers(base), []);
  assert.equal(preflightBlockers({ ...base, rules: [{ type: "update" }] }).length, 1);
  assert.deepEqual(preflightBlockers({ ...base, rules: [{ type: "update" }], canBypassLive: "always" }), []);
  const strict = [{ type: "required_status_checks", parameters: { strict_required_status_checks_policy: true } }];
  assert.ok(preflightBlockers({ ...base, rules: strict, behindBy: 1 })[0].includes("behind"));
  assert.deepEqual(preflightBlockers({ ...base, behindBy: 1 }), []);
  assert.ok(preflightBlockers({ ...base, conflicts: 40 })[0].includes("40 conflicting"));
  assert.ok(preflightBlockers({ ...base, mergeTree: "a", xTree: "b" })[0].includes("hotfix"));
  assert.ok(preflightBlockers({ ...base, allowed: ["squash"] })[0].includes('"merge" is not allowed'));
  assert.ok(preflightBlockers({ ...base, userToken: false })[0].includes("FACTORY_BATCH_TOKEN"));
});
t("release: mergeable_state, health, production deployment, commit marker", () => {
  assert.equal(mergeStateVerdict("clean"), "ready");
  assert.equal(mergeStateVerdict("unstable"), "ready");
  assert.equal(mergeStateVerdict("blocked"), "wait");
  assert.equal(mergeStateVerdict("behind"), "fail");
  assert.equal(mergeStateVerdict("dirty"), "fail");
  const sha = "007d28add63476f80e4146948d1f117aff79d9e9";
  assert.ok(judgeHealth(200, JSON.stringify({ ok: true, service: "tempo-web", commit: "007d28a" }), sha).ok);
  assert.ok(!judgeHealth(200, JSON.stringify({ ok: true, service: "tempo-web", commit: "1234567" }), sha).ok);
  assert.ok(!judgeHealth(403, "Forbidden", sha).ok);
  assert.ok(isProductionDeployment({ environment: "Production", creator: { login: "vercel[bot]" } }));
  assert.ok(!isProductionDeployment({ environment: "Preview", creator: { login: "vercel[bot]" } }));
  assert.ok(!isProductionDeployment({ environment: "Production", creator: { login: "github-actions[bot]" } }));
  const c = releaseCommit({ date: "2026-10-06", number: 700, xSha: sha, runUrl: "u" });
  assert.equal(c.title, "Release 2026-10-06 (#700)");
  assert.ok(c.message.endsWith(RELEASE_MARKER));
  const body = renderBody({ date: "2026-10-06", xSha: sha, masterSha: "m", ahead: 2, behind: 0, rows: [{ number: 5, title: "x", links: [3] }], runUrl: "u", dryRun: true });
  assert.ok(body.includes("dry run") && body.includes("#5 x (links #3)") && !/\bcloses\b/i.test(body));
});

console.log(`all ${n} passed`);
