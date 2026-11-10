// Codex lane (Phase 04 Step 5b). Codex is started by an "@codex ..." comment posted as Amit
// (secret CODEX_MENTION_PAT: fine-grained, Issues + Pull requests write ONLY, no Contents).
// Codex uses the model set in Codex settings (record: vars.FACTORY_MODEL_CODEX). Never an OpenAI key (R4).
// Modes (repo/org variable FACTORY_CODEX_MODE, default "pr"):
//   pr     - default. The lane creates t/<issue>-<slug> from integration with one empty commit
//            (GH_TOKEN = github.token, contents:write; a ref is not a PR, so R15 holds), opens a
//            DRAFT PR "Closes #<issue>" as the CODEX_MENTION_PAT user, and posts the
//            "@codex implement ..." comment ON THAT PR as the same user. No Factory App.
//            (Codex ignores @codex on issues; it only starts tasks from PR comments - 2026-10-06.)
//   issue  - legacy: comment "@codex <lane prompt>" on the ticket issue (Codex ignores it).
//   manual - C: nothing is posted; Amit starts Codex from the Codex web app. The dispatcher gives
//            Codex's share to the other lanes (next-tickets.mjs reads the same variable).
// Retry (FIX_NOTE set): "@codex fix the failing check; stay in scope" + the log goes on the PR.
// Env: GH_TOKEN (github.token: reads, branch + empty commit), MENTION_TOKEN (CODEX_MENTION_PAT: PR + comments),
//      GITHUB_REPOSITORY, ISSUE_NUMBER, CODEX_MODE, FIX_NOTE.
import { gh, repoParts, summary } from "./gh-api.mjs";
import { frontMatter, renderLanePrompt, findTicketPR, BASE, assertDispatchable, ticketBranch } from "./factory-lib.mjs";

const API = process.env.GITHUB_API_URL || "https://api.github.com";
// Calls the API as the CODEX_MENTION_PAT user (never logs the token).
async function asAmit(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${process.env.MENTION_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} as CODEX_MENTION_PAT user -> ${res.status} ${await res.text()}`);
  return res.json();
}
async function postAsAmit(owner, repo, n, body) {
  return (await asAmit(`/repos/${owner}/${repo}/issues/${n}/comments`, { body })).html_url;
}

const { owner, repo } = repoParts();
const n = Number(process.env.ISSUE_NUMBER);
const mode = process.env.CODEX_MODE || "pr";
if (!["issue", "pr", "manual"].includes(mode)) throw new Error(`FACTORY_CODEX_MODE must be issue | pr | manual (got ${mode})`);
if (mode === "manual") { await summary([`Codex mode is manual: nothing posted for #${n}. Amit starts the Codex task by hand.`]); process.exit(0); }
if (!process.env.MENTION_TOKEN) { await summary(["PARKED: secret CODEX_MENTION_PAT is not set."]); process.exit(1); }

const issue = await gh(`/repos/${owner}/${repo}/issues/${n}`);
assertDispatchable(issue);
const fm = frontMatter(issue.body);
if (!fm || !fm.ticket || !/^[A-Za-z0-9._-]+$/.test(fm.ticket)) throw new Error(`#${n} has no valid front-matter ticket id`);
const prompt = await renderLanePrompt({ issueUrl: issue.html_url, issueNumber: n, ticketId: fm.ticket });
let pr = await findTicketPR(owner, repo, n);

if (process.env.FIX_NOTE) {
  if (!pr) throw new Error(`retry for #${n} but no open PR links it`);
  const url = await postAsAmit(owner, repo, pr.number, `@codex fix the failing check; stay in scope (ticket ${issue.html_url}, rules in AGENTS.md "Factory rules"). Push to this PR's branch.\n\n<details><summary>failing log (last 150 lines)</summary>\n\n\`\`\`\n${process.env.FIX_NOTE}\n\`\`\`\n</details>`);
  await summary([`Retry comment: ${url}`]); process.exit(0);
}

let target = n;
let body = `@codex ${prompt}`;
if (mode === "pr") {
  if (!pr) {
    const branch = ticketBranch(n, fm.ticket);
    const existing = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, { allow404: true });
    if (!existing) {
      const base = await gh(`/repos/${owner}/${repo}/git/ref/heads/${BASE}`);
      const head = await gh(`/repos/${owner}/${repo}/git/commits/${base.object.sha}`);
      const commit = await gh(`/repos/${owner}/${repo}/git/commits`, { method: "POST", body: { message: `[${fm.ticket}] scaffold (empty commit for the Codex lane)`, tree: head.tree.sha, parents: [base.object.sha] } });
      await gh(`/repos/${owner}/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
    }
    pr = await asAmit(`/repos/${owner}/${repo}/pulls`, { title: `[${fm.ticket}] ${issue.title.replace(/^\[[^\]]*\]\s*/, "")}`.slice(0, 250), head: branch, base: BASE, draft: true, body: `Closes #${n}\n\nCodex lane draft PR (${fm.ticket}). Codex implements the ticket on this branch; REPORT, EVIDENCE and "Test results (cloud agent sandbox)" get filled in before it leaves draft.` });
  }
  target = pr.number;
  body = `@codex implement issue #${n} (${fm.ticket}) on this PR's branch \`${pr.head.ref}\`. Push your commits to this branch and fill in this PR's body; do not open a second PR (this replaces step 6 below).\n\n` +
    `Before finishing, run the "Testing (cloud agents)" steps in AGENTS.md (step 0: make sure Bun is 1.3.9) and post the results under "Test results (cloud agent sandbox)". Google Fonts or Playwright CDN download failures are sandbox UNKNOWN, not code failures.\n\n${prompt}`;
}
const url = await postAsAmit(owner, repo, target, body);
await summary([`Codex lane (${mode}) for #${n} ${fm.ticket}: ${url}`]);
