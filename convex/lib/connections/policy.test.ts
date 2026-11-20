import { describe, expect, test } from "bun:test";
import { classifyExecutorTool, coachMayRun, searchArgumentName } from "./policy";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false };

describe("the Executor tool policy (doc §4.1)", () => {
  test("auto: an allow-listed tool that the server marks read-only and not destructive", () => {
    expect(classifyExecutorTool("search", READ_ONLY)).toBe("auto");
    expect(classifyExecutorTool("describe", READ_ONLY)).toBe("auto");
    expect(classifyExecutorTool("integrations", { readOnlyHint: true })).toBe("auto");
  });

  test("blocked: execute and skills, whatever their hints say", () => {
    expect(classifyExecutorTool("execute")).toBe("blocked");
    expect(classifyExecutorTool("execute", READ_ONLY)).toBe("blocked");
    expect(classifyExecutorTool("skills", { readOnlyHint: true, idempotentHint: true })).toBe("blocked");
  });

  test("card: call, invoke, resume, unknown tools, and any tool with missing or writing hints", () => {
    expect(classifyExecutorTool("call", READ_ONLY)).toBe("card");
    expect(classifyExecutorTool("invoke", { readOnlyHint: false, destructiveHint: true })).toBe("card");
    expect(classifyExecutorTool("resume")).toBe("card");
    expect(classifyExecutorTool("something_new", READ_ONLY)).toBe("card");
    // Missing hints count as writing (MCP defaults: not read-only, destructive).
    expect(classifyExecutorTool("search")).toBe("card");
    expect(classifyExecutorTool("search", {})).toBe("card");
    expect(classifyExecutorTool("search", { readOnlyHint: true, destructiveHint: true })).toBe("card");
  });

  test("in B07 the coach runs only an auto search or describe; call, execute, skills and the rest are refused", () => {
    expect(coachMayRun("search", READ_ONLY)).toBe(true);
    expect(coachMayRun("describe", READ_ONLY)).toBe(true);
    for (const name of ["call", "execute", "skills", "resume", "invoke", "integrations", "anything"]) {
      expect(coachMayRun(name, READ_ONLY)).toBe(false);
    }
    expect(coachMayRun("search")).toBe(false);
    expect(coachMayRun("search", { readOnlyHint: false })).toBe(false);
  });

  test("search's argument name is read from its input schema, defensively", () => {
    expect(searchArgumentName(undefined)).toBe("query");
    expect(searchArgumentName({ type: "object" })).toBe("query");
    expect(searchArgumentName({ type: "object", properties: { query: { type: "string" }, page: { type: "number" } } })).toBe(
      "query",
    );
    expect(searchArgumentName({ type: "object", properties: { q: { type: "string" } }, required: ["q"] })).toBe("q");
    expect(
      searchArgumentName({
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        required: ["a", "b"],
      }),
    ).toBeNull();
    expect(searchArgumentName({ type: "object", properties: { n: { type: "number" } }, required: ["n"] })).toBeNull();
  });
});
