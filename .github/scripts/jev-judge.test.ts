import { describe, expect, test } from "bun:test";
import {
  buildQuestions,
  buildState,
  checkReportCoverage,
  evaluate,
  linkedTicketNumber,
  parseScores,
  parseTicketFields,
  splitSteps,
  usageCostLine,
} from "./jev-judge.ts";

describe("buildState", () => {
  const input = {
    issueBody: "Ticket instructions",
    agentsMd: "Agent instructions",
    includeMd: "Style guidelines",
    diff: "PR changes",
    prBody: "DONE: bun test\n20 pass, 0 fail",
    report: "status: done",
  };
  const descriptionHeader =
    "=== PR DESCRIPTION (written by the agent; " +
    "the ticket's EVIDENCE and REPORT fields point here) ===";

  test("puts the PR description between the diff and the REPORT comment", () => {
    expect(buildState(input)).toContain(
      [
        "=== PR DIFF ===",
        input.diff,
        "",
        descriptionHeader,
        input.prBody,
        "",
        "=== AGENT'S REPORT COMMENT ===",
        input.report,
      ].join("\n")
    );
  });

  test("uses a fallback for an empty PR description", () => {
    expect(buildState({ ...input, prBody: "" })).toContain(
      `${descriptionHeader}\n(no PR description)\n\n`
    );
  });

  test("truncates only PR descriptions longer than 20,000 characters", () => {
    const prefix = "a".repeat(20_000);
    expect(buildState({ ...input, prBody: prefix })).toContain(
      `${descriptionHeader}\n${prefix}\n\n=== AGENT'S REPORT COMMENT ===`
    );
    expect(buildState({ ...input, prBody: `${prefix}discarded` })).toContain(
      `${descriptionHeader}\n${prefix}\n... (PR description truncated)\n\n` +
        "=== AGENT'S REPORT COMMENT ==="
    );
  });
});

describe("evaluate", () => {
  test("passes when a-d are at or above the threshold and e is below the cap", () => {
    const result = evaluate({ a: 0.9, b: 0.95, c: 0.85, d: 0.91, e: 0.1 });
    expect(result.pass).toBe(true);
    expect(result.problems).toEqual([]);
  });

  test("fails when an instruction score is below the threshold", () => {
    const result = evaluate({ a: 0.8, b: 0.95, c: 0.9, d: 0.9, e: 0.1 });
    expect(result.pass).toBe(false);
    expect(result.problems.some((p) => p.includes("a (instruction-following)"))).toBe(true);
  });

  test("fails when the massive-violation probability is at the cap", () => {
    const result = evaluate({ a: 0.9, b: 0.9, c: 0.9, d: 0.9, e: 0.5 });
    expect(result.pass).toBe(false);
    expect(result.problems.some((p) => p.includes("e (massive violation)"))).toBe(true);
  });

  test("fails on a missing score", () => {
    const result = evaluate({ a: Number.NaN, b: 0.9, c: 0.9, d: 0.9, e: 0.1 });
    expect(result.pass).toBe(false);
    expect(result.problems.some((p) => p.includes("no score returned"))).toBe(true);
  });
});

describe("parseScores", () => {
  test("maps noul answers into the five scores", () => {
    const scores = parseScores({
      a: { noul: 0.9 },
      b: { noul: 0.85 },
      c: { noul: 0.86 },
      d: { noul: 0.87 },
      e: { noul: 0.1 },
    });
    expect(scores).toEqual({ a: 0.9, b: 0.85, c: 0.86, d: 0.87, e: 0.1 });
  });

  test("returns NaN for a missing answer", () => {
    const scores = parseScores({ a: { noul: 0.9 } });
    expect(Number.isNaN(scores.b)).toBe(true);
  });
});

describe("linkedTicketNumber", () => {
  test("finds Closes #N and the first linked ticket", () => {
    expect(linkedTicketNumber("Closes #123")).toBe(123);
    expect(linkedTicketNumber("fixes #42 and resolves #43")).toBe(42);
  });

  test("returns null when no ticket is linked", () => {
    expect(linkedTicketNumber("no ticket here")).toBe(null);
  });
});

describe("parseTicketFields", () => {
  test("reads STEPS and DONE from front matter", () => {
    const body = [
      "---",
      "GOAL: do a thing",
      "STEPS:",
      "  1. run the map",
      "  2. write the fix",
      "DONE: bun run test",
      "---",
    ].join("\n");
    const fields = parseTicketFields(body);
    expect(fields.done).toBe("bun run test");
    expect(fields.steps).toEqual(["run the map", "write the fix"]);
  });

  test("reads STEPS and DONE from the body when the front matter only holds metadata", () => {
    const body = [
      "---",
      "ticket: TK-23",
      "scope:",
      "  - apps/web/lib/a.ts",
      "---",
      "",
      "```",
      "GOAL:     do a thing",
      "STEPS:",
      "          1. run the map",
      "          2. write the fix",
      "DONE:     `bun test a.test.ts` -> 6 pass, 0 fail",
      "REPORT:   PR description",
      "```",
    ].join("\n");
    const fields = parseTicketFields(body);
    expect(fields.done).toBe("`bun test a.test.ts` -> 6 pass, 0 fail");
    expect(fields.steps).toEqual(["run the map", "write the fix"]);
  });

  test("excludes a closing fence from DONE when no REPORT field follows it", () => {
    const body = [
      "---",
      "ticket: TK-23",
      "---",
      "",
      "```",
      "STEPS:",
      "  1. run the map",
      "  2. write the fix",
      "DONE: bun run test",
      "```",
    ].join("\n");
    const fields = parseTicketFields(body);

    expect(fields).toEqual({
      steps: ["run the map", "write the fix"],
      done: "bun run test",
    });
    expect(checkReportCoverage(fields, "bun run test; ran map and write fix").problems).toEqual([]);
  });
});

describe("splitSteps", () => {
  test("handles numbered and bullet lists and single lines", () => {
    expect(splitSteps("1. alpha\n2. beta")).toEqual(["alpha", "beta"]);
    expect(splitSteps("- alpha\n- beta")).toEqual(["alpha", "beta"]);
    expect(splitSteps("single step")).toEqual(["single step"]);
  });
});

describe("checkReportCoverage", () => {
  const ticket = {
    steps: ["run the map", "export the data"],
    done: "bun run test",
  };

  test("passes when the report lists the DONE command and covers every STEP", () => {
    const report =
      "status: done\nticket: #1\nevidence: bun run test -> ok\nwe ran the map and exported the data";
    expect(checkReportCoverage(ticket, report).problems).toEqual([]);
  });

  test("flags a report that omits the DONE command and a STEP", () => {
    const report = "status: done\nticket: #1\nevidence: bun run typecheck -> ok";
    const result = checkReportCoverage(ticket, report);
    expect(result.problems.some((p) => p.includes("DONE"))).toBe(true);
    expect(result.problems.some((p) => p.includes("STEP"))).toBe(true);
  });
});

describe("buildQuestions", () => {
  test("returns the five noul probability questions", () => {
    const questions = buildQuestions();
    expect(Object.keys(questions).sort()).toEqual(["a", "b", "c", "d", "e"]);
    for (const value of Object.values(questions)) expect(value.type).toBe("noul");
  });
});

describe("usageCostLine", () => {
  test("reports the cost OpenRouter returns", () => {
    expect(usageCostLine({ total_cost: 0.00123456 })).toContain("$0.001235");
  });

  test("falls back to prompt + completion cost when no total is returned", () => {
    expect(usageCostLine({ prompt_cost: 0.0001, completion_cost: 0.0002 })).toContain("$0.000300");
  });

  test("reports tokens without inventing a price when no cost field is returned", () => {
    const line = usageCostLine({
      prompt_tokens: 12,
      completion_tokens: 3,
      total_tokens: 15,
    });
    expect(line).toContain("no cost field returned");
    expect(line).not.toMatch(/\$/);
  });

  test("reports missing usage", () => {
    expect(usageCostLine(undefined)).toContain("not returned");
  });
});
