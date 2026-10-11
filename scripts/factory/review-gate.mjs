// Review gate (B-5 = Cursor Bugbot, interim). Pre-queue only — Bugbot is not a merge-queue required check.
// bugbotState() is pure; fetchBugbot() reads GitHub. Used by review-fix.mjs (Bugbot → lane fix loop).
// "clean"    = a completed Bugbot check run on the head SHA without a failure conclusion AND no unresolved
//              Bugbot review thread.
// "findings" = at least one unresolved review thread started by Bugbot (cursor[bot]).
// "pending"  = Bugbot check running, or no Bugbot result for the head commit yet.
// "blocked"  = Bugbot answered that it can't run (e.g. "GitHub account mismatch": the PR author is a bot and
//              no Cursor team covers the repo) → needs Amit, never auto-fixed.
import { gh, ghAll } from "./gh-api.mjs";

export const BUGBOT_LOGINS = ["cursor[bot]", "cursor"];
const isBugbotUser = (u) => !!u && BUGBOT_LOGINS.includes(u.login || u);
// GitHub Actions jobs are never Bugbot: the release gate's own job is named "gate Bugbot (one review)".
export const isBugbotRun = (r) => r.app?.slug !== "github-actions" && (/bugbot/i.test(r.name || "") || (r.app && /cursor/i.test(r.app.slug || "") && /review|bug/i.test(r.name || "")));

export function bugbotState({ headSha, checkRuns = [], threads = [], comments = [] }) {
  const blockedNote = comments.filter((c) => isBugbotUser(c.user) && /couldn.?t run|account mismatch|usage limit/i.test(c.body || "")).pop();
  const findings = threads.filter((t) => !t.isResolved && !t.isOutdated && isBugbotUser(t.author));
  if (findings.length) return { state: "findings", findings, detail: `${findings.length} unresolved Bugbot thread(s)` };
  const runs = checkRuns.filter(isBugbotRun);
  if (runs.some((r) => r.status !== "completed")) return { state: "pending", findings: [], detail: "Bugbot running" };
  const done = runs.filter((r) => r.status === "completed");
  if (done.some((r) => ["failure", "timed_out", "action_required"].includes(r.conclusion))) return { state: "findings", findings: [], detail: "Bugbot check failed (see its check run)" };
  // A "couldn't run" / "usage limit reached" note posted AFTER the newest completed run means the latest
  // request did not produce a review: blocked, not clean (2026-10-06: usage-limit runs ended neutral).
  const lastDone = done.map((r) => Date.parse(r.completed_at || 0) || 0).sort((a, b) => b - a)[0] || 0;
  if (blockedNote && done.length && (Date.parse(blockedNote.created_at || 0) || 0) > lastDone) return { state: "blocked", findings: [], detail: `Bugbot couldn't run after its last check run: ${(blockedNote.body || "").split("\n")[0].replace(/<[^>]+>/g, "").slice(0, 120)}` };
  if (done.length) return { state: "clean", findings: [], detail: `Bugbot ${done.map((r) => r.conclusion).join(",")} on ${String(headSha).slice(0, 7)}` };
  if (blockedNote) return { state: "blocked", findings: [], detail: `Bugbot couldn't run: ${(blockedNote.body || "").split("\n")[0].replace(/<[^>]+>/g, "").slice(0, 120)}` };
  return { state: "pending", findings: [], detail: "no Bugbot result for the head commit yet" };
}

export async function fetchBugbot(owner, repo, number) {
  const pr = await gh(`/repos/${owner}/${repo}/pulls/${number}`);
  const checkRuns = await ghAll(`/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs`, (j) => j.check_runs);
  const comments = await ghAll(`/repos/${owner}/${repo}/issues/${number}/comments`);
  const q = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved isOutdated path line comments(first:1){nodes{author{login} body url}}}}}}}`;
  const g = await gh("/graphql", { method: "POST", body: { query: q, variables: { o: owner, r: repo, n: Number(number) } } });
  const nodes = g?.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
  const threads = nodes.map((t) => { const c = t.comments.nodes[0] || {}; return { isResolved: t.isResolved, isOutdated: t.isOutdated, path: t.path, line: t.line, author: c.author ? { login: c.author.login === "cursor" ? "cursor[bot]" : c.author.login } : null, body: c.body || "", url: c.url }; });
  return { pr, ...bugbotState({ headSha: pr.head.sha, checkRuns, threads, comments }) };
}

export function findingsNote(findings, max = 12000) {
  const s = ["BUGBOT REVIEW FINDINGS (fix every one; stay inside the ticket scope):", ...findings.map((f, i) => `${i + 1}. ${f.path}${f.line ? ":" + f.line : ""}\n${(f.body || "").slice(0, 1500)}`)].join("\n\n");
  return s.slice(0, max);
}

// ---------- aiReviewState (unused primitive; not wired into any gate) ----------
// aiReviewState() is pure, like bugbotState() above, but for an independent AI reviewer (Codex/Claude)
// instead of Bugbot. It judges a pre-collected result; it never calls an API and it cannot authenticate
// arbitrary JSON. A future I/O adapter — not written here — owns: checking the reviewer actor is who it
// claims (real provider webhook/App identity, not a spoofable comment body), paginating threads/comments
// to collect `otherFindings` completely, binding the result to the live PR/request (not a stale or
// forged one), and re-reading refs immediately before judging so headSha/baseSha are fresh, not cached.
// This function only trusts what the caller already verified and put in its input shape.
export const SUPPORTED_AI_PROVIDERS = ["codex", "claude"];
// "verified-provider" = the adapter confirmed the result came from the provider's own authenticated
// channel (App/bot identity, signed webhook, native API read-back). "native-result" = the adapter read
// the provider's own structured result object (not a human-style chat message) for that exact request.
// Everything else (a 👍/👀 reaction, a generic "Completed"/"Done" summary comment, a green Actions job,
// or the PR author asserting their own code is clean) is not evidence this function will accept.
const VERIFIED_AI_EVIDENCE_KINDS = ["verified-provider", "native-result"];
const FULL_SHA_RE = /^[0-9a-f]{40}$/i;
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === "string" && v.length > 0;
// Every tuple field must be present with the right type on BOTH sides. `undefined === undefined` must
// never count as a match, or an adapter that drops a field would produce an unbound approval.
const TUPLE_FIELD_VALID = {
  repo: isNonEmptyString,
  pr: (v) => Number.isSafeInteger(v) && v > 0,
  headSha: isNonEmptyString,
  baseSha: isNonEmptyString,
  requestId: isNonEmptyString,
};
const TUPLE_KEYS = Object.keys(TUPLE_FIELD_VALID);

// Returns the first tuple key that is missing/mistyped on either side or differs, else null.
function tupleMismatchKey(expected, observed) {
  if (!isObject(expected) || !isObject(observed)) return TUPLE_KEYS[0];
  return TUPLE_KEYS.find((k) => !TUPLE_FIELD_VALID[k](expected[k]) || !TUPLE_FIELD_VALID[k](observed[k]) || expected[k] !== observed[k]) || null;
}

// A finding blocks clean unless it is explicitly resolved (`resolved === true`; a truthy string like
// "false" is not resolution) AND carries a recognized non-P2 severity. An outdated thread that was never
// resolved still counts — unlike bugbotState, which lets the gate's own Bugbot ignore outdated threads.
// Unknown severity or any wrong field type is treated as the worst case, not the best.
function blocksClean(f) {
  return f.resolved !== true || f.severity === "P2" || !["P0", "P1", "P3"].includes(f.severity);
}

// A findings collection is usable only if it is a real array whose every entry is a plain object.
// Missing/null/non-array collections or null/non-object entries mean the evidence is incomplete or
// malformed, which is never clean (and must not throw). No `|| []` fallback: an omitted collection can
// mean the evidence was never collected or paginated.
const isWellFormedFindings = (list) => Array.isArray(list) && list.every(isObject);

const notClean = (detail) => ({ state: "pending", findings: [], detail });

function evaluate({ expected, observed, result, otherFindings, competingReview = false }) {
  const idKey = tupleMismatchKey(expected, observed);
  if (idKey) return notClean(`${idKey} missing, wrong type, or mismatched between the expected and freshly observed request identity`);
  if (!FULL_SHA_RE.test(expected.headSha) || !FULL_SHA_RE.test(expected.baseSha)) {
    return notClean("headSha/baseSha must be the full 40-character SHA, not an abbreviated one");
  }

  if (!isWellFormedFindings(otherFindings)) return notClean("otherFindings must be an array of finding objects (missing/null/non-array or non-object entries are never clean)");
  const blocking = otherFindings.filter(blocksClean);
  if (blocking.length) return { state: "findings", findings: blocking, detail: `${blocking.length} unresolved/P2/unknown-severity finding(s) from an already-used reviewer block clean` };

  if (competingReview !== false) return notClean("another review is active on this request (or competingReview is not a boolean false); can't call it clean yet");

  if (result === undefined || result === null) return notClean("no independent AI review result yet");
  if (!isObject(result)) return notClean("review result is not an object (malformed results are never clean)");
  if (result.status === "usage_limit") return { state: "blocked", findings: [], detail: `${result.provider || "provider"} usage limit reached` };
  if (result.status !== "completed") {
    return notClean(`review data is ${result.status || "missing"} (incomplete/error/malformed results are never clean)`);
  }
  if (!SUPPORTED_AI_PROVIDERS.includes(result.provider)) return notClean(`unsupported provider: ${result.provider || "none"}`);
  if (!VERIFIED_AI_EVIDENCE_KINDS.includes(result.evidenceKind)) {
    return notClean(`evidence "${result.evidenceKind || "none"}" is not verified-provider/native-result evidence (no bare reactions, generic summaries, Actions success, or author self-attestation)`);
  }
  if (tupleMismatchKey(expected, result.tuple)) return notClean("the review result's own tuple is missing, malformed, or does not match the expected/observed request");

  if (!isWellFormedFindings(result.findings)) return notClean("result.findings must be an array of finding objects (missing/null/non-array or non-object entries are never clean)");
  const own = result.findings.filter(blocksClean);
  if (own.length) return { state: "findings", findings: own, detail: `${own.length} unresolved finding(s) from ${result.provider}` };

  return { state: "clean", findings: [], detail: `${result.provider} gave a verified clean result on ${expected.headSha.slice(0, 7)}` };
}

// Public entry point. Fail closed: any malformed input (including a non-object argument or a hostile
// getter) yields a non-clean state instead of throwing.
export function aiReviewState(input) {
  try {
    return evaluate(isObject(input) ? input : {});
  } catch {
    return notClean("evaluator could not read the input safely (malformed input); never clean");
  }
}
