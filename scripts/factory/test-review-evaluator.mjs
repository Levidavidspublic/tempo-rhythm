// Unit tests for aiReviewState() in review-gate.mjs (pure; no I/O, no API).
// Run: node scripts/factory/test-review-evaluator.mjs
import assert from "node:assert/strict";
import { aiReviewState, SUPPORTED_AI_PROVIDERS } from "./review-gate.mjs";

let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

const HEAD = "007d28add63476f80e4146948d1f117aff79d9e9";
const BASE = "1a2b3c4d5e6f7081920314253647586970819203";
const identity = { repo: "tempo/tempo-rhythm", pr: 700, headSha: HEAD, baseSha: BASE, requestId: "req-1" };
const clean = () => ({
  expected: { ...identity },
  observed: { ...identity },
  otherFindings: [],
  result: { provider: "claude", status: "completed", evidenceKind: "verified-provider", tuple: { ...identity }, findings: [] },
});

t("clean: exact tuple match, verified evidence, no findings anywhere", () => {
  assert.equal(SUPPORTED_AI_PROVIDERS.includes("claude"), true);
  const r = aiReviewState(clean());
  assert.equal(r.state, "clean");
  assert.deepEqual(r.findings, []);
  assert.ok(r.detail.includes("claude"));
});

t("pending: every tuple field mismatch between expected and observed", () => {
  for (const key of ["repo", "pr", "headSha", "baseSha", "requestId"]) {
    const f = clean();
    f.observed = { ...f.observed, [key]: key === "pr" ? 999 : `other-${key}` };
    const r = aiReviewState(f);
    assert.equal(r.state, "pending", key);
    assert.ok(r.detail.includes(key), r.detail);
  }
});

t("pending: abbreviated (short) head or base SHA", () => {
  const f1 = clean(); f1.expected = { ...f1.expected, headSha: HEAD.slice(0, 7) }; f1.observed = { ...f1.observed, headSha: HEAD.slice(0, 7) };
  assert.equal(aiReviewState(f1).state, "pending");
  const f2 = clean(); f2.expected = { ...f2.expected, baseSha: BASE.slice(0, 7) }; f2.observed = { ...f2.observed, baseSha: BASE.slice(0, 7) };
  assert.equal(aiReviewState(f2).state, "pending");
});

t("pending: unsupported or missing provider", () => {
  const f = clean(); f.result = { ...f.result, provider: "gemini" };
  assert.equal(aiReviewState(f).state, "pending");
  const f2 = clean(); f2.result = { ...f2.result, provider: undefined };
  assert.equal(aiReviewState(f2).state, "pending");
});

t("pending: unsupported evidence kinds (reaction, generic summary, Actions success, self-attestation)", () => {
  for (const evidenceKind of ["reaction", "summary", "actions-success", "self-attestation", undefined]) {
    const f = clean(); f.result = { ...f.result, evidenceKind };
    assert.equal(aiReviewState(f).state, "pending", String(evidenceKind));
  }
});

t("pending: review result's own tuple does not match the expected/observed request", () => {
  const f = clean(); f.result = { ...f.result, tuple: { ...identity, pr: 1 } };
  assert.equal(aiReviewState(f).state, "pending");
});

t("findings: P2 severity, unknown severity, and outdated-but-unresolved findings from another reviewer all block clean", () => {
  const withOther = (other) => { const f = clean(); f.otherFindings = [other]; return f; };
  assert.equal(aiReviewState(withOther({ resolved: true, severity: "P2" })).state, "findings");
  assert.equal(aiReviewState(withOther({ resolved: true, severity: "unknown" })).state, "findings");
  assert.equal(aiReviewState(withOther({ resolved: true, severity: undefined })).state, "findings");
  assert.equal(aiReviewState(withOther({ resolved: false, outdated: true, severity: "P1" })).state, "findings");
  // Resolved + a recognized non-P2 severity + not outdated: does not block.
  assert.equal(aiReviewState(withOther({ resolved: true, severity: "P1" })).state, "clean");
});

t("findings: unresolved findings from an already-used reviewer, including Cursor, block clean", () => {
  const f = clean(); f.otherFindings = [{ resolved: false, severity: "P1", reviewer: "cursor[bot]" }];
  const r = aiReviewState(f);
  assert.equal(r.state, "findings");
  assert.equal(r.findings.length, 1);
});

t("findings: unresolved findings in the AI reviewer's own result block clean", () => {
  const f = clean(); f.result = { ...f.result, findings: [{ resolved: false, severity: "P1" }] };
  const r = aiReviewState(f);
  assert.equal(r.state, "findings");
});

t("pending: active competing review prevents clean", () => {
  const f = clean(); f.competingReview = true;
  assert.equal(aiReviewState(f).state, "pending");
});

t("blocked: provider usage limit", () => {
  const f = clean(); f.result = { ...f.result, status: "usage_limit" };
  assert.equal(aiReviewState(f).state, "blocked");
});

t("pending: incomplete, error, and malformed review data", () => {
  for (const status of ["incomplete", "error", "malformed"]) {
    const f = clean(); f.result = { ...f.result, status };
    assert.equal(aiReviewState(f).state, "pending", status);
  }
});

t("pending: missing result (genuinely missing/in-flight)", () => {
  const f = clean(); f.result = undefined;
  assert.equal(aiReviewState(f).state, "pending");
});

// ---- Fail-closed hardening: malformed input can never yield "clean" and never throws. ----
const notClean = (f, label) => {
  let r;
  assert.doesNotThrow(() => { r = aiReviewState(f); }, `${label}: threw`);
  assert.notEqual(r.state, "clean", `${label}: returned clean`);
  return r;
};

t("pending: a tuple field missing from expected, observed, and result.tuple is never an accepted match (undefined !== a value)", () => {
  for (const key of ["repo", "pr", "headSha", "baseSha", "requestId"]) {
    const strip = (o) => { const c = { ...o }; delete c[key]; return c; };
    const f = clean(); f.expected = strip(f.expected); f.observed = strip(f.observed); f.result = { ...f.result, tuple: strip(f.result.tuple) };
    const r = notClean(f, `all three tuples omit ${key}`);
    assert.equal(r.state, "pending", key);
    assert.ok(r.detail.includes(key), r.detail);
    const fo = clean(); fo.observed = strip(fo.observed);
    assert.equal(notClean(fo, `observed omits ${key}`).state, "pending", key);
    const fe = clean(); fe.expected = strip(fe.expected);
    assert.equal(notClean(fe, `expected omits ${key}`).state, "pending", key);
    const fr = clean(); fr.result = { ...fr.result, tuple: strip(fr.result.tuple) };
    assert.equal(notClean(fr, `result.tuple omits ${key}`).state, "pending", key);
  }
});

t("pending: tuple fields of the wrong type or empty, even when identical on every side", () => {
  const bad = { repo: [123, "", null, {}], pr: ["700", 0, -1, 1.5, NaN, null, Infinity], headSha: [123, "", null], baseSha: [123, "", null], requestId: [123, "", null, {}] };
  for (const [key, values] of Object.entries(bad)) {
    for (const v of values) {
      const f = clean();
      f.expected = { ...f.expected, [key]: v }; f.observed = { ...f.observed, [key]: v }; f.result = { ...f.result, tuple: { ...f.result.tuple, [key]: v } };
      assert.equal(notClean(f, `${key}=${String(v)}`).state, "pending", `${key}=${String(v)}`);
    }
  }
});

t("pending: missing/null/non-object expected, observed, result.tuple", () => {
  for (const v of [undefined, null, "x", 7, []]) {
    const fe = clean(); fe.expected = v;
    assert.equal(notClean(fe, "expected").state, "pending");
    const fo = clean(); fo.observed = v;
    assert.equal(notClean(fo, "observed").state, "pending");
    const fr = clean(); fr.result = { ...fr.result, tuple: v };
    assert.equal(notClean(fr, "result.tuple").state, "pending");
  }
});

t("pending: otherFindings missing, null, or not an array (no silent [] fallback)", () => {
  const missing = clean(); delete missing.otherFindings;
  assert.equal(notClean(missing, "otherFindings missing").state, "pending");
  for (const v of [null, {}, "none", 0, 1, true, { length: 0 }]) {
    const f = clean(); f.otherFindings = v;
    assert.equal(notClean(f, `otherFindings=${JSON.stringify(v)}`).state, "pending");
  }
});

t("pending: result.findings missing, null, or not an array (no silent [] fallback)", () => {
  const missing = clean(); delete missing.result.findings;
  assert.equal(notClean(missing, "result.findings missing").state, "pending");
  for (const v of [null, {}, "none", 0, 1, true, { length: 0 }]) {
    const f = clean(); f.result = { ...f.result, findings: v };
    assert.equal(notClean(f, `result.findings=${JSON.stringify(v)}`).state, "pending");
  }
});

t("pending: arrays containing null or non-object entries do not throw and are not clean", () => {
  for (const entry of [null, undefined, 0, 1, "P1", true, [], [{ resolved: true, severity: "P1" }]]) {
    const fo = clean(); fo.otherFindings = [entry];
    assert.equal(notClean(fo, `otherFindings entry ${String(entry)}`).state, "pending");
    const fr = clean(); fr.result = { ...fr.result, findings: [entry] };
    assert.equal(notClean(fr, `result.findings entry ${String(entry)}`).state, "pending");
    // A valid-looking resolved finding next to a malformed entry must not rescue the collection.
    const fm = clean(); fm.otherFindings = [{ resolved: true, severity: "P1" }, entry];
    assert.equal(notClean(fm, `mixed otherFindings ${String(entry)}`).state, "pending");
  }
});

t("findings: only resolved === true counts as resolved; wrong-typed resolved or severity blocks", () => {
  for (const resolved of ["false", "true", "yes", 1, 0, null, undefined, {}, [], false]) {
    const fo = clean(); fo.otherFindings = [{ resolved, severity: "P1" }];
    assert.equal(notClean(fo, `otherFindings resolved=${String(resolved)}`).state, "findings", `resolved=${String(resolved)}`);
    const fr = clean(); fr.result = { ...fr.result, findings: [{ resolved, severity: "P1" }] };
    assert.equal(notClean(fr, `result.findings resolved=${String(resolved)}`).state, "findings", `resolved=${String(resolved)}`);
  }
  for (const severity of [1, null, {}, ["P1"], "p1", "P4"]) {
    const f = clean(); f.otherFindings = [{ resolved: true, severity }];
    assert.equal(notClean(f, `severity=${JSON.stringify(severity)}`).state, "findings", JSON.stringify(severity));
  }
  // Positive control: resolved === true with a recognized non-P2 severity is the only non-blocking shape.
  const ok = clean(); ok.otherFindings = [{ resolved: true, severity: "P3" }]; ok.result.findings = [{ resolved: true, severity: "P0" }];
  assert.equal(aiReviewState(ok).state, "clean");
});

t("pending: competingReview other than boolean false, and a malformed result, are never clean", () => {
  for (const v of [true, "false", "", 0, null, {}]) {
    const f = clean(); f.competingReview = v;
    assert.equal(notClean(f, `competingReview=${JSON.stringify(v)}`).state, "pending");
  }
  for (const v of ["completed", 7, true, []]) {
    const f = clean(); f.result = v;
    assert.equal(notClean(f, `result=${JSON.stringify(v)}`).state, "pending");
  }
});

t("never throws: non-object input, empty input, and hostile getters fail closed", () => {
  for (const input of [undefined, null, 0, "x", true, [], {}, { expected: null, observed: null }]) {
    assert.equal(notClean(input, `input=${JSON.stringify(input)}`).state, "pending");
  }
  const hostile = clean();
  Object.defineProperty(hostile, "otherFindings", { get() { throw new Error("boom"); } });
  assert.equal(notClean(hostile, "throwing getter").state, "pending");
  const sym = clean(); sym.result = { ...sym.result, status: Symbol("bad") };
  assert.equal(notClean(sym, "symbol status").state, "pending");
});

console.log(`all ${n} passed`);
