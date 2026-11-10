// Cursor lane. Phase E3 (2026-10-05): API-gate only on tempo (no Factory App).
// Mode = CURSOR_MODE / vars.FACTORY_CURSOR_MODE:
//   api - POST https://api.cursor.com/v1/agents with secret CURSOR_API_KEY,
//       lane prompt + ticket text, repo https://github.com/<repo>, startingRef t/<issue>-<slug>
//       (pre-created from integration) with workOnCurrentBranch, autoCreatePR true.
//       Model = vars.FACTORY_MODEL_CURSOR (+ vars.FACTORY_MODEL_CURSOR_PARAMS "k=v,k=v").
//   automation - re-adds label run:cursor (legacy; Automation still DISABLED on tempo).
// Trigger: workflow factory-lane-cursor on label run:cursor or workflow_dispatch.
// Env: GH_TOKEN (github.token OK for labels/comments/branch refs), CURSOR_API_KEY,
//      GITHUB_REPOSITORY, ISSUE_NUMBER, CURSOR_MODE, MODEL, MODEL_PARAMS, FIX_NOTE,
//      DRY_RUN=1 (print the API body, send nothing).
// If Cursor autoCreatePR author fails Bugbot: Division6066 re-opens (STANDING-RULE-E1).
import { gh, repoParts, summary } from "./gh-api.mjs";
import { frontMatter, renderLanePrompt, findTicketPR, addLabels, removeLabel, comment, BASE, assertDispatchable, ticketBranch } from "./factory-lib.mjs";

export function agentBody({ prompt, model, params, repoUrl, ref, prUrl, name }) {
  const body = { prompt: { text: prompt }, name: name.slice(0, 100), autoCreatePR: !prUrl, workOnCurrentBranch: true };
  if (model) {
    body.model = { id: model };
    const p = (params || "").split(",").map((s) => s.trim()).filter(Boolean).map((kv) => { const [id, value] = kv.split("="); return { id: id.trim(), value: (value ?? "").trim() }; });
    if (p.length) body.model.params = p;
  }
  body.repos = [prUrl ? { url: repoUrl, prUrl } : { url: repoUrl, startingRef: ref }];
  return body;
}


async function setCursorLaneLabels(owner, repo, n) {
  const issue = await gh(`/repos/${owner}/${repo}/issues/${n}`);
  const existing = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name));
  for (const lab of existing) {
    if (/^lane:/.test(lab) && lab !== "lane:cursor") await removeLabel(owner, repo, n, lab);
  }
  await addLabels(owner, repo, n, ["status:dispatched", "lane:cursor"]);
  await removeLabel(owner, repo, n, "status:ready");
}

async function main() {
  const { owner, repo } = repoParts();
  const n = Number(process.env.ISSUE_NUMBER);
  const mode = process.env.CURSOR_MODE || "api";
  if (!["automation", "api"].includes(mode)) throw new Error(`FACTORY_CURSOR_MODE must be automation | api (got ${mode})`);
  const dry = process.env.DRY_RUN === "1";
  const issue = await gh(`/repos/${owner}/${repo}/issues/${n}`);
  assertDispatchable(issue);
  const fm = frontMatter(issue.body);
  if (!fm || !fm.ticket || !/^[A-Za-z0-9._-]+$/.test(fm.ticket)) throw new Error(`#${n} has no valid front-matter ticket id`);
  const pr = await findTicketPR(owner, repo, n);
  const fix = process.env.FIX_NOTE || "";

  if (mode === "automation") {
    if (fix && pr && !dry) await comment(owner, repo, pr.number, `Failure-rule retry for the Cursor lane: fix the failing check; stay in scope; push to this PR's branch.\n\n<details><summary>failing log (last 150 lines)</summary>\n\n\`\`\`\n${fix}\n\`\`\`\n</details>`);
    if (!dry) {
      await removeLabel(owner, repo, n, "run:cursor");
      await addLabels(owner, repo, n, ["run:cursor"]);
      await setCursorLaneLabels(owner, repo, n);
    }
    await summary([`Cursor lane (automation) for #${n} ${fm.ticket}: label run:cursor ${dry ? "would be " : ""}re-added. The Cursor Automation picks it up.`]);
    return;
  }

  // api mode
  let prompt = await renderLanePrompt({ issueUrl: issue.html_url, issueNumber: n, ticketId: fm.ticket });
  prompt += `\n\n<ticket number="${n}" title=${JSON.stringify(issue.title)}>\n${issue.body || ""}\n</ticket>\n`;
  if (fix) prompt += `\nRETRY: a required check failed on ${pr ? pr.html_url : "the PR"}. Fix the failing check; stay in scope. Push to the PR branch; do not open a new PR.\n<failing-log>\n${fix}\n</failing-log>\n`;
  const branch = ticketBranch(n, fm.ticket);
  if (!pr && !dry) {
    const existing = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, { allow404: true });
    if (!existing) {
      const base = await gh(`/repos/${owner}/${repo}/git/ref/heads/${BASE}`);
      await gh(`/repos/${owner}/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: base.object.sha } });
    }
  }
  const body = agentBody({ prompt, model: process.env.MODEL, params: process.env.MODEL_PARAMS, repoUrl: `https://github.com/${owner}/${repo}`, ref: branch, prUrl: fix && pr ? pr.html_url : "", name: `[${fm.ticket}] ${issue.title}` });
  if (dry) { console.log(JSON.stringify({ ...body, prompt: { text: body.prompt.text.slice(0, 120) + "..." } }, null, 2)); return; }
  if (!process.env.CURSOR_API_KEY) { await summary(["PARKED: secret CURSOR_API_KEY is not set."]); process.exit(1); }
  const res = await fetch("https://api.cursor.com/v1/agents", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.CURSOR_API_KEY}:`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Cursor API ${res.status}: ${text.slice(0, 500)}`);
  const { agent } = JSON.parse(text);
  // Bookkeeping: exclusive lane:cursor + status:dispatched (Bugbot E3).
  await setCursorLaneLabels(owner, repo, n);
  await comment(owner, repo, n, `Cursor lane (API) started for ${fm.ticket}: ${agent.url} (model ${process.env.MODEL || "default"}).`);
  await summary([`Cursor agent ${agent.id}: ${agent.url}`]);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(async (e) => { await summary([`FAIL: ${e.message}`]); process.exit(1); });
