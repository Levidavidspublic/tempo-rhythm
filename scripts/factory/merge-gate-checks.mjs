// Pure selection for merge-gate "2 checks". No GitHub calls.
// GitHub's check-runs filter=latest does not collapse to one run per name, so an
// older cancelled or failed attempt stays on the SHA. The greatest id is the
// latest attempt (ids increase for re-runs). A newer failure still fails.

export const SELF_CHECKS = new Set([
  "merge-gate",
  "1 scope",
  "2 checks",
  "5 coderabbit",
  "5b fallback review",
  "6 merge",
]);

export function latestRunPerName(runs) {
  const byName = new Map();
  for (const run of runs) {
    const prev = byName.get(run.name);
    if (!prev || run.id > prev.id) byName.set(run.name, run);
  }
  return [...byName.values()];
}

export function isCountedCheck(run) {
  return !SELF_CHECKS.has(run.name) && !/^merge-gate/.test(run.name);
}

export function selectChecks(runs) {
  return latestRunPerName(runs).filter(isCountedCheck);
}

// Names the integration ruleset requires, plus google-style (gate 3).
// waitFor must not return until each of these has a run.
export const REQUIRED_CHECK_NAMES = [
  "ci",
  "e2e-preview",
  "secret-scan",
  "config-guard",
  "scope-guard",
  "google-style",
];

export function partitionWait(runs, requiredNames = []) {
  const pending = runs.filter((c) => c.status !== "completed");
  const present = new Set(runs.map((c) => c.name));
  const missing = requiredNames.filter((name) => !present.has(name));
  return {
    pending,
    missing,
    ready:
      pending.length === 0 &&
      missing.length === 0 &&
      (runs.length > 0 || requiredNames.length === 0),
  };
}

import { pathToFileURL } from "node:url";

export function isMergeGateEntry(moduleUrl, argvPath) {
  if (!argvPath) return false;
  return moduleUrl === pathToFileURL(argvPath).href;
}
