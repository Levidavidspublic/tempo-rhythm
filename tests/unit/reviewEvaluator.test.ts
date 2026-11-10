// Unit tests for aiReviewState() in scripts/factory/review-gate.mjs. Discovered by the declared test command
// (`bun test convex apps/web/lib tests/unit`, factory/SLOTS.md). The evaluator is pure: importing it makes no
// network or gh calls (gh-api.mjs only reads env vars and defines functions). The same cases also run as a
// plain script: `node scripts/factory/test-review-evaluator.mjs`.
import { describe, expect, test } from "bun:test";
import { aiReviewState, SUPPORTED_AI_PROVIDERS } from "../../scripts/factory/review-gate.mjs";

type Loose = Record<string, unknown>;
type Fixture = Loose & { expected: Loose; observed: Loose; result: Loose & { tuple: Loose } };
type Verdict = { state: string; findings: unknown[]; detail: string };

const run = (input: unknown): Verdict => aiReviewState(input) as Verdict;

const HEAD = "007d28add63476f80e4146948d1f117aff79d9e9";
const BASE = "1a2b3c4d5e6f7081920314253647586970819203";
const TUPLE_KEYS = ["repo", "pr", "headSha", "baseSha", "requestId"] as const;
const identity: Loose = { repo: "tempo/tempo-rhythm", pr: 700, headSha: HEAD, baseSha: BASE, requestId: "req-1" };
const without = (o: Loose, key: string): Loose => {
  const c = { ...o };
  delete c[key];
  return c;
};

const clean = (): Fixture => ({
  expected: { ...identity },
  observed: { ...identity },
  otherFindings: [],
  competingReview: false,
  result: { provider: "claude", status: "completed", evidenceKind: "verified-provider", tuple: { ...identity }, findings: [] },
});

// Never throws and never returns "clean" for this input; returns the verdict.
const notClean = (input: unknown): Verdict => {
  let r: Verdict | undefined;
  expect(() => {
    r = run(input);
  }).not.toThrow();
  expect(r?.state).not.toBe("clean");
  return r as Verdict;
};

const withResult = (patch: Loose): Fixture => {
  const f = clean();
  f.result = { ...f.result, ...patch } as Fixture["result"];
  return f;
};

describe("aiReviewState: clean", () => {
  test("exact tuple match, verified evidence, no findings anywhere", () => {
    expect(SUPPORTED_AI_PROVIDERS.includes("claude")).toBe(true);
    const r = run(clean());
    expect(r.state).toBe("clean");
    expect(r.findings).toEqual([]);
    expect(r.detail).toContain("claude");
  });
});

describe("aiReviewState: request identity", () => {
  test("every tuple field mismatch between expected and observed is pending", () => {
    for (const key of TUPLE_KEYS) {
      const f = clean();
      f.observed = { ...f.observed, [key]: key === "pr" ? 999 : `other-${key}` };
      const r = run(f);
      expect(r.state).toBe("pending");
      expect(r.detail).toContain(key);
    }
  });

  test("abbreviated (short) head or base SHA is pending", () => {
    for (const key of ["headSha", "baseSha"] as const) {
      const f = clean();
      const short = String(identity[key]).slice(0, 7);
      f.expected = { ...f.expected, [key]: short };
      f.observed = { ...f.observed, [key]: short };
      expect(run(f).state).toBe("pending");
    }
  });

  test("a tuple field missing from expected, observed, or result.tuple is never an accepted match", () => {
    for (const key of TUPLE_KEYS) {
      const all = clean();
      all.expected = without(all.expected, key);
      all.observed = without(all.observed, key);
      all.result = { ...all.result, tuple: without(all.result.tuple, key) } as Fixture["result"];
      const r = notClean(all);
      expect(r.state).toBe("pending");
      expect(r.detail).toContain(key);

      const fo = clean();
      fo.observed = without(fo.observed, key);
      expect(notClean(fo).state).toBe("pending");
      const fe = clean();
      fe.expected = without(fe.expected, key);
      expect(notClean(fe).state).toBe("pending");
      expect(notClean(withResult({ tuple: without(identity, key) })).state).toBe("pending");
    }
  });

  test("tuple fields of the wrong type or empty are pending even when identical on every side", () => {
    const bad: Record<string, unknown[]> = {
      repo: [123, "", null, {}],
      pr: ["700", 0, -1, 1.5, Number.NaN, null, Number.POSITIVE_INFINITY],
      headSha: [123, "", null],
      baseSha: [123, "", null],
      requestId: [123, "", null, {}],
    };
    for (const [key, values] of Object.entries(bad)) {
      for (const v of values) {
        const f = clean();
        f.expected = { ...f.expected, [key]: v };
        f.observed = { ...f.observed, [key]: v };
        f.result = { ...f.result, tuple: { ...f.result.tuple, [key]: v } };
        expect(notClean(f).state).toBe("pending");
      }
    }
  });

  test("missing, null, or non-object expected / observed / result.tuple is pending", () => {
    for (const v of [undefined, null, "x", 7, []]) {
      expect(notClean({ ...clean(), expected: v }).state).toBe("pending");
      expect(notClean({ ...clean(), observed: v }).state).toBe("pending");
      expect(notClean(withResult({ tuple: v })).state).toBe("pending");
    }
  });

  test("the review result's own tuple not matching the request is pending", () => {
    expect(run(withResult({ tuple: { ...identity, pr: 1 } })).state).toBe("pending");
  });
});

describe("aiReviewState: provider and evidence", () => {
  test("unsupported or missing provider is pending", () => {
    expect(run(withResult({ provider: "gemini" })).state).toBe("pending");
    expect(run(withResult({ provider: undefined })).state).toBe("pending");
  });

  test("unsupported evidence kinds (reaction, generic summary, Actions success, self-attestation) are pending", () => {
    for (const evidenceKind of ["reaction", "summary", "actions-success", "self-attestation", undefined]) {
      expect(run(withResult({ evidenceKind })).state).toBe("pending");
    }
  });

  test("incomplete, error, and malformed review data is pending", () => {
    for (const status of ["incomplete", "error", "malformed"]) {
      expect(run(withResult({ status })).state).toBe("pending");
    }
  });

  test("a missing result is pending", () => {
    const f = clean();
    f.result = undefined as unknown as Fixture["result"];
    expect(run(f).state).toBe("pending");
  });

  test("a malformed result is never clean", () => {
    for (const v of ["completed", 7, true, []]) {
      expect(notClean({ ...clean(), result: v }).state).toBe("pending");
    }
  });
});

describe("aiReviewState: findings", () => {
  const withOther = (other: Loose): Fixture => {
    const f = clean();
    f.otherFindings = [other];
    return f;
  };

  test("P2, unknown severity, and outdated-but-unresolved findings from another reviewer block clean", () => {
    expect(run(withOther({ resolved: true, severity: "P2" })).state).toBe("findings");
    expect(run(withOther({ resolved: true, severity: "unknown" })).state).toBe("findings");
    expect(run(withOther({ resolved: true, severity: undefined })).state).toBe("findings");
    expect(run(withOther({ resolved: false, outdated: true, severity: "P1" })).state).toBe("findings");
    // Resolved + a recognized non-P2 severity + not outdated: does not block.
    expect(run(withOther({ resolved: true, severity: "P1" })).state).toBe("clean");
  });

  test("unresolved findings from an already-used reviewer (Cursor) block clean", () => {
    const r = run(withOther({ resolved: false, severity: "P1", reviewer: "cursor[bot]" }));
    expect(r.state).toBe("findings");
    expect(r.findings.length).toBe(1);
  });

  test("unresolved findings in the AI reviewer's own result block clean", () => {
    expect(run(withResult({ findings: [{ resolved: false, severity: "P1" }] })).state).toBe("findings");
  });

  test("otherFindings missing, null, or not an array is pending (no silent [] fallback)", () => {
    const missing = clean();
    delete missing.otherFindings;
    expect(notClean(missing).state).toBe("pending");
    for (const v of [null, {}, "none", 0, 1, true, { length: 0 }]) {
      expect(notClean({ ...clean(), otherFindings: v }).state).toBe("pending");
    }
  });

  test("result.findings missing, null, or not an array is pending (no silent [] fallback)", () => {
    const missing = clean();
    missing.result = without(missing.result, "findings") as Fixture["result"];
    expect(notClean(missing).state).toBe("pending");
    for (const v of [null, {}, "none", 0, 1, true, { length: 0 }]) {
      expect(notClean(withResult({ findings: v })).state).toBe("pending");
    }
  });

  test("arrays containing null or non-object entries do not throw and are not clean", () => {
    for (const entry of [null, undefined, 0, 1, "P1", true, [], [{ resolved: true, severity: "P1" }]]) {
      expect(notClean({ ...clean(), otherFindings: [entry] }).state).toBe("pending");
      expect(notClean(withResult({ findings: [entry] })).state).toBe("pending");
      // A valid-looking resolved finding next to a malformed entry must not rescue the collection.
      expect(notClean({ ...clean(), otherFindings: [{ resolved: true, severity: "P1" }, entry] }).state).toBe("pending");
    }
  });

  test("only resolved === true counts as resolved; wrong-typed resolved or severity blocks", () => {
    for (const resolved of ["false", "true", "yes", 1, 0, null, undefined, {}, [], false]) {
      expect(notClean(withOther({ resolved, severity: "P1" })).state).toBe("findings");
      expect(notClean(withResult({ findings: [{ resolved, severity: "P1" }] })).state).toBe("findings");
    }
    for (const severity of [1, null, {}, ["P1"], "p1", "P4"]) {
      expect(notClean(withOther({ resolved: true, severity })).state).toBe("findings");
    }
    // Positive control: resolved === true with a recognized non-P2 severity is the only non-blocking shape.
    const ok = withOther({ resolved: true, severity: "P3" });
    ok.result = { ...ok.result, findings: [{ resolved: true, severity: "P0" }] } as Fixture["result"];
    expect(run(ok).state).toBe("clean");
  });
});

describe("aiReviewState: competingReview must be explicit boolean false", () => {
  test("omitted competingReview is unknown and never clean", () => {
    const omitted = clean();
    delete omitted.competingReview;
    expect("competingReview" in omitted).toBe(false);
    const r = notClean(omitted);
    expect(r.state).toBe("pending");
    expect(r.detail).toContain("competingReview");
  });

  test("explicitly undefined competingReview is never clean", () => {
    expect(notClean({ ...clean(), competingReview: undefined }).state).toBe("pending");
  });

  test("an active competing review prevents clean", () => {
    expect(run({ ...clean(), competingReview: true }).state).toBe("pending");
  });

  test("any non-false value (true, strings, 0, null, objects) is never clean", () => {
    for (const v of [true, "false", "", 0, null, undefined, {}]) {
      expect(notClean({ ...clean(), competingReview: v }).state).toBe("pending");
    }
  });

  test("positive control: explicit boolean false is accepted", () => {
    expect(run({ ...clean(), competingReview: false }).state).toBe("clean");
  });
});

describe("aiReviewState: usage_limit is authenticated before it blocks", () => {
  const usageLimit = (patch: Loose = {}): Fixture => withResult({ status: "usage_limit", ...patch });

  test("supported provider + verified evidence + bound tuple is blocked", () => {
    for (const provider of SUPPORTED_AI_PROVIDERS) {
      for (const evidenceKind of ["verified-provider", "native-result"]) {
        const r = run(usageLimit({ provider, evidenceKind, findings: undefined }));
        expect(r.state).toBe("blocked");
        expect(r.findings).toEqual([]);
        expect(r.detail).toContain(provider);
      }
    }
  });

  test("an unsupported or missing provider is pending, not blocked", () => {
    for (const provider of ["gemini", "", undefined, null, 7, {}]) {
      expect(notClean(usageLimit({ provider })).state).toBe("pending");
    }
  });

  test("unverified evidence (reaction, summary, Actions success, self-attestation) is pending, not blocked", () => {
    for (const evidenceKind of ["reaction", "summary", "actions-success", "self-attestation", undefined, null]) {
      expect(notClean(usageLimit({ evidenceKind })).state).toBe("pending");
    }
  });

  test("a mismatched, partial, or absent result tuple is pending, not blocked", () => {
    for (const key of TUPLE_KEYS) {
      expect(notClean(usageLimit({ tuple: { ...identity, [key]: key === "pr" ? 999 : `other-${key}` } })).state).toBe("pending");
      expect(notClean(usageLimit({ tuple: without(identity, key) })).state).toBe("pending");
    }
    for (const tuple of [undefined, null, "x", 7, []]) {
      expect(notClean(usageLimit({ tuple })).state).toBe("pending");
    }
  });

  test("the request identity and competingReview must also be sound before it blocks", () => {
    const mismatched = usageLimit();
    mismatched.observed = { ...mismatched.observed, requestId: "req-other" };
    expect(notClean(mismatched).state).toBe("pending");
    expect(notClean({ ...usageLimit(), competingReview: undefined }).state).toBe("pending");
  });
});

describe("aiReviewState: fail closed", () => {
  test("never throws on non-object input, empty input, or hostile getters", () => {
    for (const input of [undefined, null, 0, "x", true, [], {}, { expected: null, observed: null }]) {
      expect(notClean(input).state).toBe("pending");
    }
    const hostile = clean();
    Object.defineProperty(hostile, "otherFindings", {
      get() {
        throw new Error("boom");
      },
    });
    expect(notClean(hostile).state).toBe("pending");
    expect(notClean(withResult({ status: Symbol("bad") })).state).toBe("pending");
  });
});
