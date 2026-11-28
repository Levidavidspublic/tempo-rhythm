// Bugbot → lane fix loop (B-5). Pre-queue only. For one factory PR: if Bugbot has unresolved findings,
// dispatch the PR's lane (factory-lane-<lane>, issue_number = the linked ticket, fix_note = the findings)
// to fix them on the SAME branch. At most 3 attempts per PR (labels review-fix:1..3); then blocked:amit.
// Bugbot "couldn't run" → blocked:amit once. Clean or pending → nothing.
// Batch loop (factory/LOOP.md): Bugbot reviews ONLY the loop's batch PR (head batch/<loop-id>). For a batch PR
// the fix goes to the batch branch itself: factory-lane-claude is dispatched with target_branch=batch/<loop-id>
// and issue_number = the loop ticket whose scope owns the first finding (Claude = non-browser lane; CI still
// runs Playwright on the batch PR). Same 3-attempt budget, counted on the batch PR, then blocked:amit.
// Env: GH_TOKEN (github.token is enough: labels, comments, workflow_dispatch; no PR or merge), GITHUB_REPOSITORY,
//      PR_NUMBER, DRY_RUN=1 to print only.
import { gh, repoParts, summary, linkedTickets } from "./gh-api.mjs";
import { labelNames, addLabels, comment, frontMatter, scopeOf } from "./factory-lib.mjs";
import { isBatchPR, inFolders } from "./scope-guard.mjs";
import { fetchBugbot, findingsNote } from "./review-gate.mjs";

export function nextStep({ state, labels }) {
  const tries = [1, 2, 3].filter((n) => labels.includes(`review-fix:${n}`)).length;
  if (labels.includes("blocked:amit")) return { action: "none", why: "blocked:amit" };
  if (state === "blocked") return { action: "block", why: "Bugbot couldn't run on this PR" };
  if (state !== "findings") return { action: "none", why: `Bugbot ${state}` };
  if (tries >= 3) return { action: "block", why: "3 Bugbot fix attempts used" };
  return { action: "fix", attempt: tries + 1 };
}

function isFactoryPr(pr, labels) {
  const ref = pr.head?.ref || "";
  return labels.includes("factory") || /^factory\//.test(ref) || /^t\//.test(ref) || isBatchPR(pr);
}

// Batch PR: the ticket whose scope contains the first finding's file (else the first linked ticket).
export function ownerTicket(findings, tickets) {
  for (const f of findings) {
    const t = tickets.find((x) => x.fm && inFolders(f.path || "", scopeOf(x.fm)));
    if (t) return t.number;
  }
  return tickets[0]?.number ?? null;
}

async function main() {
  const { owner, repo } = repoParts();
  const n = Number(process.env.PR_NUMBER);
  const dry = process.env.DRY_RUN === "1";
  const r = await fetchBugbot(owner, repo, n);
  const labels = labelNames(r.pr);
  const lines = [`## review-fix #${n}`, `Bugbot: ${r.state} — ${r.detail}`];
  if (!isFactoryPr(r.pr, labels)) { lines.push("Not a factory PR → nothing."); return summary(lines); }
  const step = nextStep({ state: r.state, labels });
  lines.push(`Next: ${step.action}${step.attempt ? ` (attempt ${step.attempt}/3)` : ""} — ${step.why || ""}`);
  const batch = isBatchPR(r.pr);
  let [ticket] = linkedTickets(r.pr.body);
  if (step.action === "fix" && batch) {
    const tickets = [];
    for (const t of linkedTickets(r.pr.body)) {
      const issue = await gh(`/repos/${owner}/${repo}/issues/${t}`, { allow404: true });
      if (issue && !issue.pull_request) tickets.push({ number: t, fm: frontMatter(issue.body) });
    }
    ticket = ownerTicket(r.findings, tickets);
    if (!ticket) { lines.push("Batch PR links no tickets → cannot dispatch a lane."); return summary(lines); }
    const note = findingsNote(r.findings).replace("stay inside the ticket scope", `fix them on the batch branch ${r.pr.head.ref}; stay inside the scopes of the batch's tickets; never touch convex/`);
    lines.push(`Batch PR: dispatch factory-lane-claude on ${r.pr.head.ref} (ticket #${ticket}) with ${r.findings.length} finding(s).`);
    if (!dry) {
      await addLabels(owner, repo, n, [`review-fix:${step.attempt}`]);
      await gh(`/repos/${owner}/${repo}/actions/workflows/factory-lane-claude.yml/dispatches`, { method: "POST", body: { ref: "integration", inputs: { issue_number: String(ticket), fix_note: note, target_branch: r.pr.head.ref } } });
    }
    return summary(lines);
  }
  if (step.action === "fix") {
    if (!ticket) { lines.push("No linked ticket (Closes #N) → cannot dispatch a lane."); return summary(lines); }
    const issue = await gh(`/repos/${owner}/${repo}/issues/${ticket}`);
    const lane = [...labelNames(issue), ...labels].find((l) => /^lane:(claude|codex|cursor)$/.test(l))?.slice(5) || "claude";
    lines.push(`Dispatch factory-lane-${lane} for ticket #${ticket} with ${r.findings.length} finding(s).`);
    if (!dry) {
      await addLabels(owner, repo, n, [`review-fix:${step.attempt}`]);
      await gh(`/repos/${owner}/${repo}/actions/workflows/factory-lane-${lane}.yml/dispatches`, { method: "POST", body: { ref: "integration", inputs: { issue_number: String(ticket), fix_note: findingsNote(r.findings) } } });
    }
  } else if (step.action === "block" && !dry) {
    await addLabels(owner, repo, n, ["blocked:amit"]);
    await comment(owner, repo, n, `Factory review gate: ${step.why}. Labelled blocked:amit.${r.state === "blocked" ? " Bugbot reviews bot-authored PRs only when a Cursor team covers this repo." : ""}`);
  }
  return summary(lines);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(async (e) => { await summary([`FAIL: ${e.message}`]); process.exit(1); });
