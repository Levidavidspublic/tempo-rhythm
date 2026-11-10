// deploy-live plan + real path (Phase J2).
// Default (no args) prints the plan and exits. It never deploys.
// `node scripts/factory/deploy-live-plan.mjs deploy` is the only real path,
// and it still refuses unless shouldDeploy() says deploy and DEPLOY_LIVE_CONFIRM=yes.
// Live keys are read from the process env (the Production environment job). Never printed.
import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const GITHUB_ENVIRONMENT = "Production";
export const VERCEL_PROJECT = "tempo-web";
export const LIVE_DEPLOYMENT = "precious-wildcat-890";
export const LIVE_KEY_TARGET = "prod:precious-wildcat-890";
export const SMOKE_URL = "https://tempoflow.dev";
export const SMOKE_HEALTH_URL = "https://tempoflow.dev/api/health";
export const VERCEL_CLI = "vercel@62.2.0";

export const CONVEX_ROLLBACK_STEPS = [
  "Convex live rollback is manual. This workflow does not run it.",
  "1. Convex dashboard → production deployment precious-wildcat-890 → Deployments → Promote the previous deployment.",
  "2. Or check out the last known-good commit and run `npx convex deploy` with a deploy key whose target prefix is prod:precious-wildcat-890.",
  "3. Do not paste the deploy key into logs, chat, or the issue.",
].join("\n");

export function planText() {
  return [
    "deploy-live plan (no deploy on this step)",
    `GitHub Environment: ${GITHUB_ENVIRONMENT} (this repo has "Production", not lowercase "production")`,
    `Vercel production project: ${VERCEL_PROJECT}`,
    `Convex live deployment: ${LIVE_DEPLOYMENT} (key target ${LIVE_KEY_TARGET})`,
    `Smoke: GET ${SMOKE_URL} and GET ${SMOKE_HEALTH_URL}`,
    "Live keys are read only in the Production environment job: VERCEL_TOKEN, CONVEX_DEPLOY_KEY_LIVE.",
    "VERCEL_ORG_ID and VERCEL_PROJECT_ID come from that same job (environment secret, else environment variable).",
    "dry_run exits before that job. A real deploy never runs while this step's decision is dry_run.",
  ].join("\n");
}

export function readEnv(env = process.env) {
  return {
    eventName: env.EVENT_NAME || "",
    ref: env.REF || "",
    dryRun: env.DRY_RUN || "",
    pausedAll: env.PAUSED_ALL || env.FACTORY_PAUSED_ALL || "",
    force: env.FORCE || "",
    actor: env.ACTOR || "",
  };
}

function truthy(value) {
  return value === true || value === "true";
}

function isPerson(actor) {
  return typeof actor === "string" && actor.length > 0 && !actor.endsWith("[bot]");
}

// Real deploy only on push to master, or workflow_dispatch from master with dry_run=false.
// dry_run always exits 0 and never deploys. FACTORY_PAUSED_ALL refuses a real deploy
// unless workflow_dispatch force=true from a person (not a [bot] login).
export function shouldDeploy({ eventName, ref, dryRun, pausedAll, force, actor }) {
  if (truthy(dryRun)) return { action: "dry_run", exitCode: 0, reason: "dry_run is true" };
  const pushMaster = eventName === "push" && ref === "refs/heads/master";
  const manualLive = eventName === "workflow_dispatch" && (dryRun === false || dryRun === "false");
  if (manualLive && ref !== "refs/heads/master") {
    return { action: "refuse", exitCode: 1, reason: "manual live deploy must be dispatched from master" };
  }
  if (!pushMaster && !manualLive) {
    return { action: "dry_run", exitCode: 0, reason: "real deploy only on push to master, or workflow_dispatch from master with dry_run=false" };
  }
  if (truthy(pausedAll)) {
    const allowed = manualLive && truthy(force) && isPerson(actor);
    if (!allowed) {
      return {
        action: "refuse",
        exitCode: 1,
        reason: "FACTORY_PAUSED_ALL is true; real deploy refused (force is person-only on workflow_dispatch)",
      };
    }
  }
  return { action: "deploy", exitCode: 0, reason: pushMaster ? "push to master" : "workflow_dispatch dry_run=false from master" };
}

// Check the deploy-key prefix in memory. Never include the key or the actual prefix in the error.
export function assertLiveKeyTarget(key) {
  if (!key) return { ok: false, error: "Secret CONVEX_DEPLOY_KEY_LIVE is not set on the Production environment." };
  const pipe = key.indexOf("|");
  if (pipe <= 0) return { ok: false, error: "CONVEX_DEPLOY_KEY_LIVE is not a deployment deploy key (no '<kind>:<name>|' prefix); refusing." };
  const target = key.slice(0, pipe);
  if (target !== LIVE_KEY_TARGET) return { ok: false, error: `CONVEX_DEPLOY_KEY_LIVE does not target ${LIVE_KEY_TARGET}; refusing to deploy.` };
  return { ok: true };
}

export function judgeSmoke(rootStatus, healthStatus, healthBody) {
  if (rootStatus < 200 || rootStatus >= 300) return { ok: false, detail: `GET ${SMOKE_URL} -> ${rootStatus}` };
  let parsed = null;
  try { parsed = JSON.parse(healthBody); } catch { parsed = null; }
  if (healthStatus < 200 || healthStatus >= 300 || !parsed || parsed.ok !== true || parsed.service !== "tempo-web") {
    return { ok: false, detail: `GET ${SMOKE_HEALTH_URL} -> ${healthStatus}` };
  }
  return { ok: true, detail: "smoke ok" };
}

export function scrub(text, secrets) {
  let out = String(text);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out;
}

function secretValues() {
  return [process.env.VERCEL_TOKEN, process.env.CONVEX_DEPLOY_KEY_LIVE, process.env.CONVEX_DEPLOY_KEY].filter(Boolean);
}

function note(text) {
  const safe = scrub(text, secretValues());
  process.stdout.write(safe.endsWith("\n") ? safe : `${safe}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${safe}\n`);
}

function setOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function required(name, value) {
  if (value) return true;
  note(`::error::${name} is unset. Set it on the GitHub Environment ${GITHUB_ENVIRONMENT}. Live keys must not come from a plain repo or org secret.`);
  return false;
}

function runCmd(cmd, args, extraEnv) {
  const secrets = secretValues();
  if (extraEnv.CONVEX_DEPLOY_KEY) secrets.push(extraEnv.CONVEX_DEPLOY_KEY);
  if (extraEnv.VERCEL_TOKEN) secrets.push(extraEnv.VERCEL_TOKEN);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const write = (chunk, stream) => {
      const text = scrub(String(chunk), secrets);
      out += text;
      stream.write(text);
    };
    child.stdout.on("data", (chunk) => write(chunk, process.stdout));
    child.stderr.on("data", (chunk) => write(chunk, process.stderr));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

async function vercelApi(path, token, teamId) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Vercel API ${path.split("?")[0]} -> ${res.status}`);
  return res.json();
}

async function rollbackVercel(uid, env) {
  note(`Rolling Vercel production back to ${uid}. Convex is not rolled back.`);
  await runCmd("bun", ["x", VERCEL_CLI, "rollback", uid, "--non-interactive"], env);
}

async function openSmokeIssue(detail) {
  const { gh, repoParts } = await import("./gh-api.mjs");
  const { owner, repo } = repoParts();
  const title = "Live deploy smoke failed";
  const body = [
    detail,
    "",
    `Run: ${process.env.RUN_URL || "UNKNOWN"}`,
    `SHA: ${process.env.GITHUB_SHA || "UNKNOWN"}`,
    "",
    "Vercel production rollback to the previous deployment was attempted.",
    "",
    CONVEX_ROLLBACK_STEPS,
  ].join("\n");
  const q = encodeURIComponent(`repo:${owner}/${repo} is:issue is:open in:title "Live deploy smoke failed"`);
  const found = await gh(`/search/issues?q=${q}`);
  const existing = (found.items || []).find((item) => item.title === title);
  if (existing) {
    await gh(`/repos/${owner}/${repo}/issues/${existing.number}/comments`, { method: "POST", body: { body } });
    note(`Updated issue #${existing.number}`);
    return;
  }
  const created = await gh(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: { title, body, assignees: process.env.AMIT ? [process.env.AMIT] : [] },
  });
  note(`Opened issue #${created.number}`);
}

async function runDeploy() {
  if (process.env.DEPLOY_LIVE_CONFIRM !== "yes") {
    note("::error::refusing deploy: DEPLOY_LIVE_CONFIRM is not yes");
    process.exit(1);
  }
  const decision = shouldDeploy(readEnv());
  if (decision.action !== "deploy") {
    note(planText());
    note(decision.reason);
    process.exit(decision.exitCode || 1);
  }
  const key = process.env.CONVEX_DEPLOY_KEY_LIVE || "";
  const keyCheck = assertLiveKeyTarget(key);
  if (!keyCheck.ok) {
    note(`::error::${keyCheck.error}`);
    process.exit(1);
  }
  note(`Key targets ${LIVE_KEY_TARGET}.`);
  const token = process.env.VERCEL_TOKEN || "";
  const orgId = process.env.VERCEL_ORG_ID || process.env.VERCEL_ORG_ID_VAR || "";
  const projectId = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID_VAR || "";
  if (!required("VERCEL_TOKEN", token) || !required("VERCEL_ORG_ID", orgId) || !required("VERCEL_PROJECT_ID", projectId)) process.exit(1);
  const vercelEnv = { VERCEL_TOKEN: token, VERCEL_ORG_ID: orgId, VERCEL_PROJECT_ID: projectId, CI: "1" };
  const listed = await vercelApi(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=1&state=READY`, token, orgId);
  const prev = listed.deployments && listed.deployments[0];
  if (!prev || !prev.uid) {
    note("::error::No READY production deployment to roll back to; refusing to deploy.");
    process.exit(1);
  }
  note(`Previous production deployment: ${prev.uid}`);
  try {
    await runCmd("bun", ["x", VERCEL_CLI, "deploy", "--prod", "--yes"], vercelEnv);
  } catch (err) {
    note(`::error::Vercel production deploy failed (${scrub(err.message, secretValues())}). No Convex deploy. No rollback (production was not moved by this step).`);
    process.exit(1);
  }
  try {
    await runCmd("bun", ["x", "convex", "deploy"], { CONVEX_DEPLOY_KEY: key });
  } catch (err) {
    note(`::error::Convex deploy failed (${scrub(err.message, secretValues())}). Rolling Vercel back. Convex rollback is not run.`);
    try { await rollbackVercel(prev.uid, vercelEnv); } catch (rollbackErr) {
      note(`::error::Vercel rollback failed (${scrub(rollbackErr.message, secretValues())}).`);
    }
    note(CONVEX_ROLLBACK_STEPS);
    process.exit(1);
  }
  const root = await fetch(SMOKE_URL);
  const health = await fetch(SMOKE_HEALTH_URL);
  const healthBody = await health.text();
  const smoke = judgeSmoke(root.status, health.status, healthBody);
  if (smoke.ok) {
    note(smoke.detail);
    return;
  }
  note(`::error::${smoke.detail}`);
  try { await rollbackVercel(prev.uid, vercelEnv); } catch (rollbackErr) {
    note(`::error::Vercel rollback failed (${scrub(rollbackErr.message, secretValues())}).`);
  }
  try { await openSmokeIssue(smoke.detail); } catch (issueErr) {
    note(`::error::Could not open the smoke-failed issue (${scrub(issueErr.message, secretValues())}).`);
  }
  note(CONVEX_ROLLBACK_STEPS);
  process.exit(1);
}

async function main() {
  const decision = shouldDeploy(readEnv());
  if (process.argv[2] !== "deploy") {
    note(planText());
    note(`decision: ${decision.action} (${decision.reason})`);
    setOutput("deploy", decision.action === "deploy" ? "true" : "false");
    process.exit(decision.exitCode);
  }
  await runDeploy();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    note(`::error::${scrub(err.message, secretValues())}`);
    process.exit(1);
  });
}
