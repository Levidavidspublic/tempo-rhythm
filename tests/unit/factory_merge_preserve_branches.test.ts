import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const script = join(root, "scripts/factory/merge-train.mjs");
const checks = ["ci", "e2e-preview", "secret-scan", "config-guard", "scope-guard"];

// Run the shipped CLI; only its external GitHub boundary is replaced. Removing
// the setting guard or restoring head deletion must fail these behavioral tests.
// Fixtures are retained in the OS temp directory; no cleanup deletes branches/files.
const preload = String.raw`
import { readFileSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
const scenario = JSON.parse(readFileSync(process.env.FIXTURE_SCENARIO, 'utf8'));
const trace = { calls: [], merges: [], branchDeletes: [], statusDone: [], holdsRemoved: [], updates: [], reruns: [], networkAttempts: 0, unexpected: [] };
process.on('exit', () => writeFileSync(process.env.FIXTURE_TRACE, JSON.stringify(trace)));
const deny = () => { trace.networkAttempts++; throw new Error('Real network denied by merge-train test'); };
net.Socket.prototype.connect = deny;
tls.connect = deny;
http.request = http.get = https.request = https.get = deny;
dgram.createSocket = deny;
globalThis.WebSocket = class { constructor() { deny(); } };
syncBuiltinESMExports();
const prefix = '/repos/fixture-owner/fixture-repo';
const head = (n) => 'f'.repeat(39) + String(n);
const issue = (n, type = 'component') => ({ number: n, state: 'open', labels: ['status:in-pr'], body: '---\nticket: T-' + n + '\nbatch: fixture\ntype: ' + type + '\n---\n' });
const pr = (n) => ({ number: n, title: 'Fixture ' + n, body: 'Closes #' + n, labels: ['factory', ...(scenario.held ? ['hold:stress-test'] : []), ...(scenario.blocked ? ['blocked:amit'] : []), ...(scenario.fixing ? ['merge-fixing'] : [])], head: { sha: head(n), ref: 't/' + n + '-fixture' }, base: { ref: 'integration' } });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  const method = options.method || 'GET';
  const path = url.pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  trace.calls.push({ method, path, query: url.search, body });
  if (url.origin !== 'https://api.github.com') deny();
  if (method === 'GET' && path === prefix + '/rules/branches/integration') return response([{ type: 'required_status_checks', parameters: { required_status_checks: scenario.checks.map(context => ({ context })) } }]);
  if (method === 'GET' && path === prefix + '/issues' && url.searchParams.get('state') === 'all') return response([issue(1), ...(scenario.two ? [issue(2)] : []), ...(scenario.dataPending ? [issue(3, 'data')] : [])]);
  if (method === 'GET' && path === prefix + '/pulls' && url.searchParams.get('base') === 'integration') return response([pr(1), ...(scenario.two ? [pr(2)] : [])]);
  if (method === 'GET' && /^\/repos\/fixture-owner\/fixture-repo\/pulls\/[12]$/.test(path)) return response(pr(Number(path.split('/').at(-1))));
  if (method === 'GET' && path.startsWith(prefix + '/compare/integration...')) return response({ behind_by: scenario.behind ? 1 : 0, html_url: 'https://github.com/fixture-owner/fixture-repo/compare/fixture' });
  if (method === 'GET' && path.endsWith('/check-runs')) return response({ check_runs: scenario.checks.filter(name => name !== scenario.missing).map(name => ({ name, status: scenario.pending === name ? 'in_progress' : 'completed', conclusion: scenario.red === name ? 'failure' : scenario.cancelled === name ? 'cancelled' : 'success', html_url: 'https://github.com/fixture-owner/fixture-repo/actions/runs/123' })) });
  if (method === 'GET' && path.endsWith('/status')) return response({ statuses: [] });
  if (method === 'GET' && path === prefix) {
    if (scenario.setting === 'http-error') return response({ message: 'Fixture forbidden' }, 403);
    if (scenario.setting === 'read-error') throw new Error('Fixture metadata unavailable');
    if (scenario.setting === 'malformed-json') return new Response('not-json', { status: 200 });
    return response(scenario.setting === 'absent' ? {} : { delete_branch_on_merge: scenario.setting });
  }
  if (method === 'PUT' && path.endsWith('/update-branch')) { trace.updates.push({ path, body }); return response({ message: 'Fixture updated' }, 202); }
  if (method === 'POST' && path === prefix + '/actions/runs/123/rerun') { trace.reruns.push(path); return response({ message: 'Fixture rerun accepted' }, 201); }
  if (method === 'PUT' && /\/pulls\/[12]\/merge$/.test(path)) { trace.merges.push({ path, body }); return response({ merged: true, sha: 'a'.repeat(40) }); }
  if (method === 'POST' && /\/issues\/[12]\/labels$/.test(path)) { trace.statusDone.push({ path, body }); return response([]); }
  if (method === 'DELETE' && /\/issues\/[12]\/labels\/status%3Ain-pr$/.test(path)) return new Response(null, { status: 204 });
  if (method === 'DELETE' && /\/issues\/[12]\/labels\/hold%3Astress-test$/.test(path)) { trace.holdsRemoved.push(path); return new Response(null, { status: 204 }); }
  if (method === 'DELETE' && path.startsWith(prefix + '/git/refs/heads/')) { trace.branchDeletes.push(path); return new Response(null, { status: 204 }); }
  trace.unexpected.push({ method, path });
  throw new Error('Unexpected mocked request: ' + method + ' ' + path);
};
`;

type Scenario = {
  setting?: unknown;
  two?: boolean;
  held?: boolean;
  blocked?: boolean;
  fixing?: boolean;
  dataPending?: boolean;
  behind?: boolean;
  missing?: string;
  pending?: string;
  red?: string;
  cancelled?: string;
};

type Trace = {
  calls: { method: string; path: string; query: string; body: unknown }[];
  merges: { path: string; body: unknown }[];
  branchDeletes: string[];
  statusDone: { path: string; body: unknown }[];
  holdsRemoved: string[];
  updates: { path: string; body: unknown }[];
  reruns: string[];
  networkAttempts: number;
  unexpected: { method: string; path: string }[];
};

function run(scenario: Scenario, args: string[] = []) {
  const directory = mkdtempSync(join(tmpdir(), "tempo-merge-preserve-"));
  const preloadPath = join(directory, "preload.mjs");
  const scenarioPath = join(directory, "scenario.json");
  const tracePath = join(directory, "trace.json");
  writeFileSync(preloadPath, preload);
  writeFileSync(scenarioPath, JSON.stringify({ checks, setting: false, ...scenario }));
  const child = spawnSync("node", ["--import", pathToFileURL(preloadPath).href, script, ...args], {
    cwd: root,
    env: {
      PATH: process.env.PATH ?? "",
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      GH_TOKEN: "synthetic-merge-train-test-token",
      GITHUB_REPOSITORY: "fixture-owner/fixture-repo",
      FIXTURE_SCENARIO: scenarioPath,
      FIXTURE_TRACE: tracePath,
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  expect(child.error).toBeUndefined();
  expect(child.status).toBe(0);
  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as Trace;
  expect(trace.networkAttempts).toBe(0);
  expect(trace.unexpected).toEqual([]);
  return { trace, output: child.stdout + child.stderr };
}

const mutations = (trace: Trace) => trace.calls.filter((call) => call.method !== "GET");
const metadataReads = (trace: Trace) => trace.calls.filter((call) => call.path === "/repos/fixture-owner/fixture-repo");

describe("factory CLI preserves branches before merging", () => {
  for (const setting of [true, "absent", null, "false", 0, {}, "http-error", "read-error", "malformed-json"]) {
    test(`blocks merges and ticket writes unless branch deletion is explicitly disabled: ${JSON.stringify(setting)}`, () => {
      const { trace, output } = run({ setting, held: true }, ["--mode", "stress"]);
      expect(metadataReads(trace)).toHaveLength(1);
      expect(mutations(trace)).toEqual([]);
      expect(trace.merges).toEqual([]);
      expect(trace.statusDone).toEqual([]);
      expect(trace.holdsRemoved).toEqual([]);
      expect(trace.branchDeletes).toEqual([]);
      expect(output).toMatch(/branch|delet/i);
      expect(output).toMatch(/block|skip|preserv/i);
    });
  }

  test("merges one green current head, updates its ticket, and retains every branch", () => {
    const { trace, output } = run({ two: true });
    expect(trace.merges).toEqual([{ path: "/repos/fixture-owner/fixture-repo/pulls/1/merge", body: { merge_method: "squash", sha: "f".repeat(39) + "1" } }]);
    expect(trace.statusDone).toEqual([{ path: "/repos/fixture-owner/fixture-repo/issues/1/labels", body: { labels: ["status:done"] } }]);
    expect(trace.branchDeletes).toEqual([]);
    expect(metadataReads(trace)).toHaveLength(1);
    const mergeIndex = trace.calls.findIndex((call) => call.path.endsWith("/merge"));
    expect(trace.calls[mergeIndex - 1]?.path).toBe("/repos/fixture-owner/fixture-repo");
    expect(output).toContain("one merge per run");
  });

  test("stress mode checks preservation before releasing the hold", () => {
    const { trace } = run({ held: true }, ["--mode", "stress"]);
    expect(trace.holdsRemoved).toHaveLength(1);
    expect(trace.merges).toHaveLength(1);
    expect(trace.branchDeletes).toEqual([]);
    const holdIndex = trace.calls.findIndex((call) => call.path.endsWith("/hold%3Astress-test"));
    expect(trace.calls[holdIndex - 1]?.path).toBe("/repos/fixture-owner/fixture-repo");
    expect(trace.calls[holdIndex + 1]?.path).toBe("/repos/fixture-owner/fixture-repo/pulls/1/merge");
  });

  test("dry run remains read-only even when the repository would delete heads", () => {
    const { trace, output } = run({ setting: true, held: true }, ["--mode", "stress", "--dry-run"]);
    expect(mutations(trace)).toEqual([]);
    expect(trace.branchDeletes).toEqual([]);
    expect(output).toContain("[dry-run] would squash-merge");
  });

  for (const scenario of [
    { missing: "ci" },
    { pending: "e2e-preview" },
    { red: "secret-scan" },
    { held: true },
    { blocked: true },
    { fixing: true },
    { dataPending: true },
  ]) {
    test(`preservation setting does not bypass an existing gate: ${JSON.stringify(scenario)}`, () => {
      const { trace } = run(scenario);
      expect(mutations(trace)).toEqual([]);
      expect(trace.merges).toEqual([]);
      expect(metadataReads(trace)).toEqual([]);
    });
  }

  test("behind-head update is retained without merging or changing ticket status", () => {
    const { trace } = run({ setting: true, behind: true });
    expect(trace.updates).toEqual([{ path: "/repos/fixture-owner/fixture-repo/pulls/1/update-branch", body: { expected_head_sha: "f".repeat(39) + "1" } }]);
    expect(trace.merges).toEqual([]);
    expect(trace.statusDone).toEqual([]);
    expect(trace.branchDeletes).toEqual([]);
    expect(metadataReads(trace)).toEqual([]);
  });

  test("cancelled required run is rerun without merging or altering its ticket", () => {
    const { trace } = run({ cancelled: "config-guard" });
    expect(trace.reruns).toEqual(["/repos/fixture-owner/fixture-repo/actions/runs/123/rerun"]);
    expect(trace.merges).toEqual([]);
    expect(trace.statusDone).toEqual([]);
    expect(trace.branchDeletes).toEqual([]);
    expect(metadataReads(trace)).toEqual([]);
  });
});
