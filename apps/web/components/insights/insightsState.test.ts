import { describe, expect, test } from "bun:test";
import { deriveInsightsState, type InsightsStateInput } from "./insightsState";

const filled = {
  tasksOpen: 3,
  tasksCompletedThisWeek: 1,
  habitsTotal: 2,
  goalsActive: 1,
};
const emptySummary = { tasksOpen: 0, tasksCompletedThisWeek: 0, habitsTotal: 0, goalsActive: 0 };

const base: InsightsStateInput = {
  isAuthLoading: false,
  isAuthenticated: true,
  profile: { _id: "u1" },
  summary: filled,
  failed: false,
};

describe("deriveInsightsState", () => {
  test("auth still loading", () => {
    expect(deriveInsightsState({ ...base, isAuthLoading: true })).toBe("loading");
  });
  test("signed out", () => {
    expect(
      deriveInsightsState({ ...base, isAuthenticated: false, profile: undefined, summary: undefined }),
    ).toBe("signed-out");
  });
  test("profile loading", () => {
    expect(deriveInsightsState({ ...base, profile: undefined, summary: undefined })).toBe("loading");
  });
  test("auth done and profile null is never the skeleton", () => {
    expect(deriveInsightsState({ ...base, profile: null, summary: undefined })).not.toBe("loading");
    expect(deriveInsightsState({ ...base, profile: null, summary: undefined })).toBe("signed-out");
  });
  test("summary loading", () => {
    expect(deriveInsightsState({ ...base, summary: undefined })).toBe("loading");
  });
  test("empty", () => {
    expect(deriveInsightsState({ ...base, summary: emptySummary })).toBe("empty");
  });
  test("ready", () => {
    expect(deriveInsightsState(base)).toBe("ready");
  });
  test("error wins over every loading state", () => {
    expect(deriveInsightsState({ ...base, failed: true })).toBe("error");
    expect(
      deriveInsightsState({ ...base, isAuthLoading: true, profile: undefined, summary: undefined, failed: true }),
    ).toBe("error");
  });
  test("auth dropped mid-load leaves the skeleton", () => {
    expect(
      deriveInsightsState({ ...base, isAuthenticated: false, profile: undefined, summary: undefined }),
    ).not.toBe("loading");
  });
  test("summary undefined past the timeout is an error", () => {
    expect(deriveInsightsState({ ...base, summary: undefined, failed: true })).toBe("error");
  });
  test("summary null is an error, never the skeleton", () => {
    expect(deriveInsightsState({ ...base, summary: null })).toBe("error");
  });
});
