export const MAX_ATTEMPTS = 3;
export const BASE_WAIT_MS = 200;
export const MAX_WAIT_MS = 2000;

type RetryWaitInput = {
  attempt: number;
  retry: boolean;
  elapsedMs: number;
  budgetMs: number;
  random?: () => number;
};

export type RetryWaitPlan =
  | { action: "wait"; waitMs: number }
  | {
      action: "stop";
      reason: "not-retryable" | "attempts-spent" | "budget-spent" | "bad-input";
    };

/** Plans a retry without performing any wait or other side effect. */
export function planRetry({
  attempt,
  retry,
  elapsedMs,
  budgetMs,
  random = Math.random,
}: RetryWaitInput): RetryWaitPlan {
  if (!retry) {
    return { action: "stop", reason: "not-retryable" };
  }

  if (!Number.isInteger(attempt) || attempt < 1 || !isValidTime(elapsedMs) || !isValidTime(budgetMs)) {
    return { action: "stop", reason: "bad-input" };
  }

  if (attempt >= MAX_ATTEMPTS) {
    return { action: "stop", reason: "attempts-spent" };
  }

  const exponentialWaitMs = Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** (attempt - 1));
  const randomValue = Math.min(1, Math.max(0, random()));
  const waitMs = Math.round(exponentialWaitMs * (0.5 + randomValue * 0.5));

  if (elapsedMs + waitMs >= budgetMs) {
    return { action: "stop", reason: "budget-spent" };
  }

  return { action: "wait", waitMs };
}

function isValidTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
