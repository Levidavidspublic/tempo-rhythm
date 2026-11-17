// merge-train (Phase 04 Step 7) - the merge agent. Writes with the Factory App token (GH_TOKEN):
// merges made with the App token start the push workflows on integration; GITHUB_TOKEN merges
// would not, and R15 forbids them.
// Factory PRs = open PRs into integration labelled `factory` (never found by branch name).
// Order: per batch that HAS a data ticket, the data PR first, then component PRs in ticket order;
// a component never merges before its batch's data ticket is status:done. Batches without a data
// ticket skip that rule. Per PR: skip blocked:amit and merge-fixing; behind -> update-branch
// (REST PUT /pulls/{n}/update-branch) and wait; a CANCELLED required run (concurrency) -> re-run
// it; pending -> wait; red -> do nothing (the failure rule reacts); green -> squash-merge,
// ticket status:done, preserve the branch. Real merges require the repository's automatic
// branch deletion setting to be explicitly false. normal mode never MERGES hold:stress-test (still updates).
// At most one merge per run (the next PR must be updated onto the new integration and re-checked:
// strict required checks). stress mode: hold PRs too, strictly one at a time, removes the hold
// label as it starts each one, records actual vs expected_merge for overlap_test tickets, and
// dispatches factory-nightly (full E2E on integration's preview) when no PR is left.
// Update conflicts -> blocked:amit + a comment listing the conflicting PR's files (both sides
// stay; no work is dropped).
// Usage: node merge-train.mjs [--dry-run] [--mode normal|stress] [--batch <id>]
// Env: GH_TOKEN, GITHUB_REPOSITORY.
import {gh, ghAll, repoParts, summary, linkedTickets} from './gh-api.mjs';
import {
  labelNames,
  allTickets,
  addLabels,
  removeLabel,
  comment,
  truthy,
  BASE,
} from './factory-lib.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const MODE = args.includes('--mode')
  ? args[args.indexOf('--mode') + 1]
  : 'normal';
const BATCH = args.includes('--batch') ? args[args.indexOf('--batch') + 1] : '';
const log = [];
const say = s => {
  log.push(s);
  console.log(s);
};
const act = async (what, fn) => {
  say(`${DRY ? '[dry-run] would ' : ''}${what}`);
  if (!DRY) return fn();
};

export function order(prs) {
  // prs: [{ number, fm, labels }] -> sorted: batch, data first, then ticket id
  return [...prs].sort(
    (a, b) =>
      String(a.fm.batch).localeCompare(String(b.fm.batch)) ||
      (a.fm.type === 'data' ? 0 : 1) - (b.fm.type === 'data' ? 0 : 1) ||
      String(a.fm.ticket).localeCompare(String(b.fm.ticket), undefined, {
        numeric: true,
      }),
  );
}

async function requiredChecks(owner, repo) {
  const rules = await gh(`/repos/${owner}/${repo}/rules/branches/${BASE}`);
  const names = new Set();
  for (const r of rules)
    if (r.type === 'required_status_checks')
      for (const c of r.parameters.required_status_checks) names.add(c.context);
  return [...names];
}

// -> { state: green|pending|red|cancelled, detail, cancelledRuns: [runId] }
async function checkState(owner, repo, sha, required) {
  const runs = await ghAll(
    `/repos/${owner}/${repo}/commits/${sha}/check-runs`,
    j => j.check_runs,
  );
  const statuses = await gh(`/repos/${owner}/${repo}/commits/${sha}/status`);
  const out = {state: 'green', detail: [], cancelledRuns: []};
  for (const name of required) {
    const mine = runs.filter(r => r.name === name);
    const st = statuses.statuses.find(s => s.context === name);
    if (!mine.length && !st) {
      out.state = out.state === 'red' ? 'red' : 'pending';
      out.detail.push(`${name}: missing`);
      continue;
    }
    if (mine.some(r => r.conclusion === 'cancelled')) {
      for (const r of mine.filter(x => x.conclusion === 'cancelled')) {
        const m = (r.html_url || '').match(/runs\/(\d+)/);
        if (m) out.cancelledRuns.push(Number(m[1]));
      }
      if (out.state === 'green') out.state = 'cancelled';
      out.detail.push(`${name}: cancelled run present`);
    }
    if (
      mine.some(r => r.status !== 'completed') ||
      (st && st.state === 'pending')
    ) {
      if (out.state !== 'red') out.state = 'pending';
      out.detail.push(`${name}: running`);
      continue;
    }
    if (
      mine.some(r =>
        ['failure', 'timed_out', 'action_required'].includes(r.conclusion),
      ) ||
      (st && ['failure', 'error'].includes(st.state))
    ) {
      out.state = 'red';
      out.detail.push(`${name}: failed`);
    }
  }
  return out;
}

async function main() {
  const {owner, repo} = repoParts();
  if (!['normal', 'stress'].includes(MODE))
    throw new Error('--mode must be normal or stress');
  say(
    `merge-train ${DRY ? '(dry run) ' : ''}mode=${MODE}${BATCH ? ` batch=${BATCH}` : ''} on ${owner}/${repo}`,
  );
  const required = await requiredChecks(owner, repo);
  say(`required checks on ${BASE}: ${required.join(', ') || 'none'}`);
  const tickets = await allTickets(owner, repo);
  const byNumber = new Map(tickets.map(t => [t.issue.number, t]));
  const dataDone = new Map(); // batch -> true/false (only batches that HAVE a data ticket)
  for (const t of tickets)
    if (t.fm.type === 'data')
      dataDone.set(
        String(t.fm.batch),
        labelNames(t.issue).includes('status:done'),
      );

  const open = await ghAll(
    `/repos/${owner}/${repo}/pulls?state=open&base=${BASE}`,
  );
  const factory = [];
  for (const p of open) {
    const labels = labelNames(p);
    if (!labels.includes('factory')) continue;
    const [n] = linkedTickets(p.body);
    const t = byNumber.get(n);
    const fm = t ? t.fm : null;
    if (!fm) {
      say(`#${p.number}: factory label but no ticket front-matter -> skip`);
      continue;
    }
    if (BATCH && String(fm.batch) !== BATCH) continue;
    factory.push({pr: p, number: p.number, labels, fm, ticket: n});
  }
  const queue = order(factory);
  say(
    `factory PRs (${queue.length}), merge order: ${queue.map(q => `#${q.number}[${q.fm.ticket} ${q.fm.type}]`).join(' -> ') || 'none'}`,
  );
  if (!factory.length && !open.length) say('no open PRs into integration.');
  for (const p of open.filter(x => !labelNames(x).includes('factory')))
    say(
      `#${p.number}: not a factory PR (no \`factory\` label) -> not touched (${p.title})`,
    );

  let merged = false;
  const overlapResults = [];
  for (const q of queue) {
    const id = `#${q.number} ${q.fm.ticket}`;
    if (q.labels.includes('blocked:amit')) {
      say(`${id}: blocked:amit -> skip`);
      continue;
    }
    if (q.labels.includes('merge-fixing')) {
      say(`${id}: merge-fix running -> wait`);
      continue;
    }
    const batch = String(q.fm.batch);
    const needsData =
      q.fm.type !== 'data' && dataDone.has(batch) && !dataDone.get(batch);
    if (needsData) {
      say(
        `${id}: batch ${batch} data ticket not merged yet -> wait (component never merges before its data PR)`,
      );
      continue;
    }
    const pr = await gh(`/repos/${owner}/${repo}/pulls/${q.number}`);
    const cmp = await gh(
      `/repos/${owner}/${repo}/compare/${BASE}...${pr.head.sha}`,
    );
    const held = q.labels.includes('hold:stress-test');
    if (cmp.behind_by > 0) {
      try {
        await act(`update ${id} (behind ${BASE} by ${cmp.behind_by})`, () =>
          gh(`/repos/${owner}/${repo}/pulls/${q.number}/update-branch`, {
            method: 'PUT',
            body: {expected_head_sha: pr.head.sha},
          }),
        );
      } catch (e) {
        if (/merge conflict|422/i.test(e.message)) {
          const files = (
            await ghAll(`/repos/${owner}/${repo}/pulls/${q.number}/files`)
          ).map(f => f.filename);
          await act(`label ${id} blocked:amit (update conflict)`, async () => {
            await addLabels(owner, repo, q.number, ['blocked:amit']);
            await comment(
              owner,
              repo,
              q.number,
              `Factory merge agent: updating this PR onto \`${BASE}\` conflicts. Both sides are kept (no work dropped); needs Amit.\n\nThis PR's files:\n${files.map(f => `- \`${f}\``).join('\n')}\n\nCompare: ${cmp.html_url}`,
            );
          });
          if (truthy(q.fm.overlap_test))
            overlapResults.push({
              ticket: q.fm.ticket,
              expected: q.fm.expected_merge,
              actual: 'conflict',
            });
        } else throw e;
      }
      if (MODE === 'stress') break; // strictly one at a time
      continue;
    }
    const cs = await checkState(owner, repo, pr.head.sha, required);
    if (cs.state === 'cancelled') {
      for (const r of cs.cancelledRuns)
        await act(`re-run cancelled run ${r} on ${id}`, () =>
          gh(`/repos/${owner}/${repo}/actions/runs/${r}/rerun`, {
            method: 'POST',
          }),
        );
      continue;
    }
    if (cs.state === 'pending') {
      say(`${id}: checks running (${cs.detail.join('; ')}) -> wait`);
      if (MODE === 'stress') break;
      continue;
    }
    if (cs.state === 'red') {
      say(
        `${id}: checks red (${cs.detail.join('; ')}) -> nothing (failure rule reacts)`,
      );
      continue;
    }
    if (held && MODE === 'normal') {
      say(
        `${id}: green but hold:stress-test -> kept up to date, not merged (normal mode)`,
      );
      continue;
    }
    if (merged) {
      say(`${id}: green; waits for the next round (one merge per run)`);
      continue;
    }
    if (!DRY) {
      let repository;
      try {
        repository = await gh(`/repos/${owner}/${repo}`);
      } catch {
        say(
          `${id}: branch preservation cannot be verified -> blocked; repository automatic branch deletion must be explicitly disabled`,
        );
        continue;
      }
      if (repository?.delete_branch_on_merge !== false) {
        say(
          `${id}: branch preservation is not confirmed -> blocked; repository automatic branch deletion must be explicitly disabled`,
        );
        continue;
      }
      // Check at the merge boundary, before releasing a hold or changing ticket status.
      // GitHub has no atomic merge-and-setting assertion: an administrator can still
      // change this setting concurrently after the read. Never change it ourselves.
    }
    if (held)
      await act(`remove hold:stress-test from ${id}`, () =>
        removeLabel(owner, repo, q.number, 'hold:stress-test'),
      );
    await act(`squash-merge ${id} (${pr.title})`, () =>
      gh(`/repos/${owner}/${repo}/pulls/${q.number}/merge`, {
        method: 'PUT',
        body: {merge_method: 'squash', sha: pr.head.sha},
      }),
    );
    await act(`label ticket #${q.ticket} status:done`, async () => {
      await addLabels(owner, repo, q.ticket, ['status:done']);
      await removeLabel(owner, repo, q.ticket, 'status:in-pr');
    });
    say(`${id}: preserve branch ${pr.head.ref}`);
    if (truthy(q.fm.overlap_test)) {
      // an update-branch leaves a merge commit (2 parents) in the PR: that is the "rebase" outcome
      const commits = await ghAll(
        `/repos/${owner}/${repo}/pulls/${q.number}/commits`,
        j => j,
        250,
      );
      overlapResults.push({
        ticket: q.fm.ticket,
        expected: q.fm.expected_merge || 'clean',
        actual: commits.some(c => (c.parents || []).length > 1)
          ? 'rebase'
          : 'clean',
      });
    }
    merged = true;
    if (MODE === 'stress') break;
  }
  if (overlapResults.length)
    say(
      `overlap results: ${overlapResults.map(r => `${r.ticket} expected ${r.expected} got ${r.actual}${r.expected === r.actual ? ' OK' : ' MISMATCH'}`).join('; ')}`,
    );
  if (
    MODE === 'stress' &&
    !queue.some(q => !q.labels.includes('blocked:amit'))
  ) {
    await act(
      "dispatch factory-nightly.yml (full E2E on integration's preview; stress run done)",
      () =>
        gh(
          `/repos/${owner}/${repo}/actions/workflows/factory-nightly.yml/dispatches`,
          {method: 'POST', body: {ref: BASE}},
        ),
    );
  }
  await summary(['## merge-train', ...log.map(l => `- ${l}`)]);
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch(async e => {
    await summary([`FAIL: ${e.message}`]);
    process.exitCode = 1;
  });
