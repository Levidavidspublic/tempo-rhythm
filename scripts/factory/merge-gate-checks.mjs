// Pure selection for merge-gate "2 checks". No GitHub calls.
// GitHub's check-runs filter=latest does not collapse to one run per name, so an
// older cancelled or failed attempt stays on the SHA. The greatest id is the
// latest attempt (ids increase for re-runs). A newer failure still fails.

export const SELF_CHECKS = new Set([
  'merge-gate',
  '1 scope',
  '2 checks',
  '4 jev judge',
  '5 coderabbit',
  '5b fallback review',
  '6 merge',
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
