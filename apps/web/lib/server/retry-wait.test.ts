import { describe, expect, test } from "bun:test";

import { BASE_WAIT_MS, MAX_ATTEMPTS, MAX_WAIT_MS, planRetry } from "./retry-wait";

const fixedRandom = () => 1;

describe("planRetry", () => {
  test("stops when the failure is not retryable", () => {
    expect(
      planRetry({ attempt: 1, retry: false, elapsedMs: 0, budgetMs: 8000, random: fixedRandom })
    ).toEqual({ action: "stop", reason: "not-retryable" });
  });

  test("plans the first wait", () => {
    expect(
      planRetry({ attempt: 1, retry: true, elapsedMs: 0, budgetMs: 8000, random: fixedRandom })
    ).toEqual({ action: "wait", waitMs: BASE_WAIT_MS });
  });

  test("doubles the second wait", () => {
    expect(
      planRetry({ attempt: 2, retry: true, elapsedMs: 0, budgetMs: 8000, random: fixedRandom })
    ).toEqual({ action: "wait", waitMs: BASE_WAIT_MS * 2 });
  });

  test("keeps the wait cap at 2000 milliseconds", () => {
    expect(MAX_WAIT_MS).toBe(2000);
  });

  test("stops when all attempts are spent", () => {
    expect(
      planRetry({
        attempt: MAX_ATTEMPTS,
        retry: true,
        elapsedMs: 0,
        budgetMs: 8000,
        random: fixedRandom,
      })
    ).toEqual({ action: "stop", reason: "attempts-spent" });
  });

  test("stops when waiting would spend the remaining budget", () => {
    expect(
      planRetry({ attempt: 1, retry: true, elapsedMs: 7800, budgetMs: 8000, random: fixedRandom })
    ).toEqual({ action: "stop", reason: "budget-spent" });
  });

  test("stops for bad input", () => {
    expect(
      planRetry({ attempt: 0.5, retry: true, elapsedMs: 0, budgetMs: 8000, random: fixedRandom })
    ).toEqual({ action: "stop", reason: "bad-input" });
    expect(
      planRetry({ attempt: 1, retry: true, elapsedMs: -1, budgetMs: 8000, random: fixedRandom })
    ).toEqual({ action: "stop", reason: "bad-input" });
    expect(
      planRetry({
        attempt: 1,
        retry: true,
        elapsedMs: 0,
        budgetMs: Number.NaN,
        random: fixedRandom,
      })
    ).toEqual({ action: "stop", reason: "bad-input" });
  });
});
