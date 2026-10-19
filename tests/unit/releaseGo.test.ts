// Unit tests for the `go` release guards in scripts/factory/release-go.mjs (Kitchen PR, 2026-10-19).
// Discovered by the declared test command (`bun run test` -> bun test ... tests/unit). Pure functions only:
// importing the script makes no network or gh calls (gh-api.mjs only reads env vars and defines functions).
import { describe, expect, test } from "bun:test";
import {
  CANDIDATE_AUTHOR,
  candidateRunProblem,
  checkResults,
  goVerdict,
  isGo,
  latestCandidate,
  parseCandidate,
  refusal,
  renderCandidate,
} from "../../scripts/factory/release-go.mjs";

type Loose = Record<string, unknown>;
type Verdict = { ok: boolean; silent: boolean; guard: string; reason: string; sha?: string };

const SHA = "4ff1628902b09469e817c6e8f0bef60da5fc42ad";
const NEWER = "613d2eac0000000000000000000000000000abcd";
const MASTER = "007d28add63476f80e4146948d1f117aff79d9e9";
const RUN = 1234567;
const REPO = { full_name: "Levidavidspublic/tempo-rhythm" };

const candidateBody = (sha: string, state: string, run = RUN) =>
  renderCandidate({ sha, run, runUrl: "https://example.test/run", state, checks: checkResults({ ci: "success", security: "success", acceptance: "success" }).checks, convexChanged: false, masterSha: MASTER });

const facts = (over: Loose = {}): Loose => ({
  body: "go",
  author: "Division6066",
  pr: { state: "open", base: { ref: "master", repo: REPO }, head: { ref: "integration", repo: REPO }, labels: [{ name: "release" }] },
  paused: { pausedAll: "", paused: "" },
  userToken: true,
  candidate: { id: 9, sha: SHA, run: RUN, state: "pass" },
  integrationSha: SHA,
  candidateRun: { id: RUN, path: ".github/workflows/release-go.yml", event: "workflow_run", head_sha: SHA, status: "completed", conclusion: "success" },
  releaseRuns: [{ status: "completed", html_url: "https://example.test/old" }],
  ...over,
});
const verdict = (over: Loose = {}): Verdict => goVerdict(facts(over)) as Verdict;

describe("release-go: go guards", () => {
  test("happy path: every guard holds, returns the candidate SHA", () => {
    expect(verdict()).toEqual({ ok: true, silent: false, guard: "", reason: "", sha: SHA });
  });

  test("wrong text: anything but a trimmed, case-insensitive `go` is ignored silently", () => {
    for (const body of ["go!", "let's go", "gogo", "", "go go", "`go`"]) {
      const v = verdict({ body });
      expect(v.ok).toBe(false);
      expect(v.silent).toBe(true);
      expect(v.guard).toBe("text");
    }
    for (const body of ["go", "Go", "GO", "  go\n", "\tgO "]) expect(isGo(body)).toBe(true);
  });

  test("wrong author: only Division6066 (comment.user.login) may release", () => {
    for (const author of ["someone-else", "division6066-fake", "github-actions[bot]", ""]) {
      const v = verdict({ author });
      expect(v.ok).toBe(false);
      expect(v.silent).toBe(false);
      expect(v.guard).toBe("author");
    }
  });

  test("stale SHA: candidate is for an older integration head", () => {
    const v = verdict({ integrationSha: NEWER });
    expect(v.guard).toBe("stale");
    expect(v.reason).toContain("4ff1628");
    expect(v.reason).toContain("613d2ea");
    expect(verdict({ integrationSha: "" }).guard).toBe("stale");
  });

  test("failed candidate: a fail or pending candidate refuses, so does a run that did not end green", () => {
    expect(verdict({ candidate: { id: 9, sha: SHA, run: RUN, state: "fail" } }).guard).toBe("candidate");
    expect(verdict({ candidate: { id: 9, sha: SHA, run: RUN, state: "pending" } }).reason).toContain("still running");
    expect(verdict({ candidate: null }).guard).toBe("candidate");
    const run = facts().candidateRun as Loose;
    expect(verdict({ candidateRun: { ...run, conclusion: "failure" } }).guard).toBe("candidate-run");
    expect(verdict({ candidateRun: { ...run, status: "in_progress", conclusion: null } }).guard).toBe("candidate-run");
    expect(verdict({ candidateRun: null }).guard).toBe("candidate-run");
  });

  test("paused factory: FACTORY_PAUSED_ALL or FACTORY_PAUSED refuses", () => {
    expect(verdict({ paused: { pausedAll: "true", paused: "" } }).guard).toBe("paused");
    expect(verdict({ paused: { pausedAll: "", paused: "true" } }).guard).toBe("paused");
    expect(verdict({ paused: { pausedAll: "false", paused: "false" } }).ok).toBe(true);
  });

  test("other guards: not the Release PR, missing token, release already running", () => {
    const pr = facts().pr as Loose;
    expect(verdict({ pr: { ...pr, labels: [] } }).guard).toBe("release-pr");
    expect(verdict({ pr: { ...pr, state: "closed" } }).guard).toBe("release-pr");
    expect(verdict({ pr: { ...pr, base: { ref: "integration", repo: REPO } } }).guard).toBe("release-pr");
    expect(verdict({ pr: { ...pr, head: { ref: "integration", repo: { full_name: "fork/tempo-rhythm" } } } }).guard).toBe("release-pr");
    expect(verdict({ userToken: false }).guard).toBe("token");
    const busy = verdict({ releaseRuns: [{ status: "in_progress", html_url: "https://example.test/live" }] });
    expect(busy.guard).toBe("busy");
    expect(busy.reason).toContain("https://example.test/live");
  });

  test("guard order: a stranger learns nothing past the author guard", () => {
    expect(verdict({ author: "someone-else", paused: { pausedAll: "true" }, candidate: null }).guard).toBe("author");
  });

  test("refusal reply names the guard and says nothing started", () => {
    const text = refusal(verdict({ author: "someone-else" }));
    expect(text).toContain("(author)");
    expect(text).toContain("Nothing was started");
  });
});

describe("release-go: candidate comment", () => {
  test("round trip: marker holds sha, run and state", () => {
    expect(parseCandidate(candidateBody(SHA, "pass"))).toEqual({ sha: SHA, run: RUN, state: "pass" });
    expect(parseCandidate("hello")).toBeNull();
    expect(parseCandidate(`text first\n${candidateBody(SHA, "pass")}`)).toBeNull();
    expect(parseCandidate('<!-- release-candidate {"sha":"abc","run":1,"state":"pass"} -->')).toBeNull();
  });

  test("only github-actions[bot] comments count, newest first", () => {
    const comments = [
      { id: 1, user: { login: CANDIDATE_AUTHOR }, updated_at: "2026-10-19T08:00:00Z", body: candidateBody(SHA, "fail") },
      { id: 2, user: { login: "Division6066" }, updated_at: "2026-10-19T10:00:00Z", body: candidateBody(NEWER, "pass") },
      { id: 3, user: { login: CANDIDATE_AUTHOR }, updated_at: "2026-10-19T09:00:00Z", body: candidateBody(SHA, "pass") },
    ];
    expect(latestCandidate(comments)).toEqual({ id: 3, sha: SHA, run: RUN, state: "pass" });
    expect(latestCandidate([comments[1]])).toBeNull();
  });

  test("pass comment says `go`; pending and fail do not; never triggers Bugbot", () => {
    const pass = candidateBody(SHA, "pass");
    expect(pass).toContain("Comment `go` to release this commit.");
    expect(pass).toContain(SHA);
    expect(pass).toContain("no: `convex/` is the same as master");
    expect(candidateBody(SHA, "pending")).not.toContain("Comment `go` to release this commit.");
    expect(candidateBody(SHA, "fail")).not.toContain("Comment `go` to release this commit.");
    const withConvex = renderCandidate({ sha: SHA, run: RUN, runUrl: "u", state: "pass", checks: {}, convexChanged: "true", masterSha: MASTER, previewUrl: "https://tempo-web-abc.vercel.app" });
    expect(withConvex).toContain("precious-wildcat-890");
    expect(withConvex).toContain("https://tempo-web-abc.vercel.app");
    for (const s of ["pass", "pending", "fail"]) expect(candidateBody(SHA, s)).not.toMatch(/@cursor|bugbot run|cursor review/i);
  });

  test("check results: all success = pass; any other job result = fail", () => {
    expect(checkResults({ ci: "success", security: "success", acceptance: "success" }).state).toBe("pass");
    const r = checkResults({ ci: "success", security: "cancelled", acceptance: "failure" });
    expect(r.state).toBe("fail");
    expect(r.checks).toEqual({ ci: "pass", security: "fail", acceptance: "fail" });
    expect(checkResults({}).state).toBe("fail");
  });

  test("candidate run must be a release-go candidate run on that SHA", () => {
    const run = facts().candidateRun as Loose;
    expect(candidateRunProblem(run, SHA)).toBeNull();
    expect(candidateRunProblem({ ...run, path: ".github/workflows/release-go.yml@refs/heads/integration" }, SHA)).toBeNull();
    expect(candidateRunProblem({ ...run, path: ".github/workflows/ci.yml" }, SHA)).toContain("not a release-go.yml run");
    expect(candidateRunProblem({ ...run, event: "issue_comment" }, SHA)).toContain("not a candidate check");
    expect(candidateRunProblem({ ...run, head_sha: NEWER }, SHA)).toContain("tested");
  });
});
