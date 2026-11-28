// factory-release-pr (Phase J2). Opens or updates ONE PR integration → master.
// Title: Release YYYY-MM-DD in Asia/Jerusalem. Body lists PRs merged into
// integration since the master tip. Does not merge. Does not push to master.
// Merges on public tempo use the GitHub merge queue.
import { pathToFileURL } from "node:url";
import { gh, repoParts, summary, linkedTickets } from "./gh-api.mjs";

export function israelDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function releaseTitle(now = new Date()) {
  return `Release ${israelDate(now)}`;
}

export function isReleaseTitle(title) {
  return /^Release \d{4}-\d{2}-\d{2}$/.test(title || "");
}

// GitHub squash/merge subjects only. Avoids incidental "#123" mentions in commit bodies.
export function prNumbersFromMessage(message) {
  const first = String(message || "").split("\n")[0];
  const merge = first.match(/^Merge pull request #(\d+)\b/);
  if (merge) return [Number(merge[1])];
  const squash = first.match(/\(#(\d+)\)\s*$/);
  if (squash) return [Number(squash[1])];
  return [];
}

export function renderReleaseBody({ date, masterSha, ahead, truncated, rows }) {
  const lines = [
    `## Release ${date} (Asia/Jerusalem)`,
    "",
    "This workflow does not merge and does not push to `master`. Merges on public tempo use the GitHub merge queue.",
    "Required checks stay required. This workflow does not change branch protection.",
    "",
    `Since master tip \`${masterSha}\`. Commits on \`integration\` not in \`master\`: ${ahead}${truncated ? " (compare API truncated the commit list)" : ""}.`,
    "",
    "### Pull requests and linked issues merged into integration",
  ];
  if (!rows.length) lines.push("- None found (no pull-request numbers on these commits).");
  else for (const row of rows) {
    const links = row.closes.length ? ` (links ${row.closes.map((n) => `#${n}`).join(", ")})` : "";
    lines.push(`- #${row.number} ${row.title}${links}`);
  }
  lines.push(
    "",
    "Opened or updated by factory-release-pr.",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  const { owner, repo } = repoParts();
  const date = israelDate();
  const title = `Release ${date}`;
  const compare = await gh(`/repos/${owner}/${repo}/compare/master...integration`);
  const ahead = compare.ahead_by ?? compare.total_commits ?? 0;
  if (!ahead) {
    await summary(["integration is not ahead of master. No release PR."]);
    return;
  }
  const commits = compare.commits || [];
  const truncated = (compare.total_commits || 0) > commits.length;
  const numbers = [];
  for (const commit of commits) {
    for (const n of prNumbersFromMessage(commit.commit && commit.commit.message)) {
      if (!numbers.includes(n)) numbers.push(n);
    }
  }
  const rows = [];
  for (const number of numbers.slice(0, 100)) {
    const pr = await gh(`/repos/${owner}/${repo}/pulls/${number}`, { allow404: true });
    if (!pr) {
      rows.push({ number, title: "(pull request details unavailable)", closes: [] });
      continue;
    }
    rows.push({ number, title: pr.title, closes: linkedTickets(pr.body || "") });
  }
  const masterSha = compare.base_commit && compare.base_commit.sha ? compare.base_commit.sha : "UNKNOWN";
  const body = renderReleaseBody({ date, masterSha, ahead, truncated, rows });
  const query = new URLSearchParams({ state: "open", base: "master", head: `${owner}:integration` });
  const open = await gh(`/repos/${owner}/${repo}/pulls?${query}`);
  const release = (open || []).filter((pr) => isReleaseTitle(pr.title));
  const other = (open || []).filter((pr) => !isReleaseTitle(pr.title));
  if (release.length) {
    const pr = release[0];
    await gh(`/repos/${owner}/${repo}/pulls/${pr.number}`, { method: "PATCH", body: { body } });
    const lines = [`Updated release PR #${pr.number}. Did not merge. Did not push to master.`];
    if (release.length > 1) lines.push(`Warning: ${release.length} open Release PRs; updated #${pr.number} only.`);
    await summary(lines);
    return;
  }
  if (other.length) {
    await summary([`Open integration → master PR #${other[0].number} is not a Release PR. Not opening a second. Not merging.`]);
    process.exit(1);
  }
  const created = await gh(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: { title, head: "integration", base: "master", body },
  });
  await summary([`Opened ${created.html_url}. Did not merge. Did not push to master.`]);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (err) => {
    await summary([`FAIL: ${err.message}`]);
    process.exit(1);
  });
}
