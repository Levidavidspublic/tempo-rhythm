// Tiny GitHub REST helper for factory scripts. No dependencies (Node 20+ fetch).
// Token comes from GH_TOKEN (the workflow's github.token). Never logs it.
const API = process.env.GITHUB_API_URL || "https://api.github.com";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";

export async function gh(path, { method = "GET", body, allow404 = false } = {}) {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (allow404 && res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Follows page=N until a page comes back short. pick(json) returns the array.
export async function ghAll(path, pick = (j) => j, max = 3000) {
  const out = [];
  for (let page = 1; out.length < max; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const items = pick(await gh(`${path}${sep}per_page=100&page=${page}`));
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

export function repoParts() {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY is not set");
  return { owner, repo };
}

export async function summary(lines) {
  const text = lines.join("\n") + "\n";
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, text);
  }
}

// "Closes #12", "fixes #3", "Resolved: #7" ... same-repo references only.
export function linkedTickets(body) {
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s+#(\d+)\b/gi;
  return [...new Set([...(body || "").matchAll(re)].map((m) => Number(m[1])))];
}

// Promotion PR = Amit's integration -> live-branch PR.
export function isPromotion(pr) {
  return ["master", "main"].includes(pr.base.ref) && pr.head.ref === "integration" &&
    pr.head.repo && pr.head.repo.full_name === pr.base.repo.full_name;
}
