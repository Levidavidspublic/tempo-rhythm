import { describe, expect, mock, test } from "bun:test";
import { ConvexError } from "convex/values";
import { parsePlanFromModelContent, planBrainDump } from "./brain_dump";

test("planning exposes friendly configuration copy without a DeepInfra key or network call", async () => {
  const originalApiKey = process.env.DEEPINFRA_API_KEY;
  const originalFetch = globalThis.fetch;
  const fetchMock = mock(() => Promise.reject(new Error("Unexpected network call")));
  try {
    delete process.env.DEEPINFRA_API_KEY;
    globalThis.fetch = fetchMock;

    const error = await planBrainDump("Pay rent and call mom").catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<string>).data).toBe(
      "Planning is not configured here yet. Use local sorting or try again later.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.DEEPINFRA_API_KEY;
    else process.env.DEEPINFRA_API_KEY = originalApiKey;
  }
});

describe("parsePlanFromModelContent", () => {
  test("parses a clean JSON plan", () => {
    const json = JSON.stringify({
      summary: "Start with rent, then call mom.",
      priorities: [
        { title: "Pay rent", reason: "Deadline tonight.", urgency: "now" },
        { title: "Call mom", reason: "Promised yesterday.", urgency: "soon" },
      ],
    });
    const plan = parsePlanFromModelContent(json);
    expect(plan.summary).toContain("rent");
    expect(plan.priorities.length).toBe(2);
    expect(plan.priorities[0]?.urgency).toBe("now");
    expect(plan.priorities[1]?.urgency).toBe("soon");
  });

  test("unwraps a fenced ```json``` block", () => {
    const fenced = "```json\n" +
      JSON.stringify({
        summary: "All clear.",
        priorities: [{ title: "Send email", reason: "Open loop.", urgency: "now" }],
      }) +
      "\n```";
    const plan = parsePlanFromModelContent(fenced);
    expect(plan.priorities.length).toBe(1);
    expect(plan.priorities[0]?.title).toBe("Send email");
  });

  test("throws friendly error on non-JSON content", () => {
    expect(() => parsePlanFromModelContent("hello not json")).toThrow(/plan/i);
  });

  test("throws on empty summary", () => {
    const json = JSON.stringify({
      summary: "   ",
      priorities: [{ title: "Pay rent", reason: "Deadline.", urgency: "now" }],
    });
    expect(() => parsePlanFromModelContent(json)).toThrow(/incomplete/i);
  });

  test("throws when priorities array is missing", () => {
    const json = JSON.stringify({ summary: "Plan." });
    expect(() => parsePlanFromModelContent(json)).toThrow(/incomplete/i);
  });

  test("throws when no valid priority items remain after filtering", () => {
    const json = JSON.stringify({
      summary: "Plan.",
      priorities: [
        { title: "", reason: "blank", urgency: "now" },
        { title: "Title", reason: "", urgency: "now" },
        { title: "Title", reason: "Reason", urgency: "whenever" },
      ],
    });
    expect(() => parsePlanFromModelContent(json)).toThrow(/no clear items/i);
  });

  test("caps to 6 priorities even if model returns more", () => {
    const json = JSON.stringify({
      summary: "Plan.",
      priorities: Array.from({ length: 12 }, (_, i) => ({
        title: `Task ${i}`,
        reason: "Because.",
        urgency: "soon",
      })),
    });
    const plan = parsePlanFromModelContent(json);
    expect(plan.priorities.length).toBe(6);
  });

  test("skips invalid urgency values but keeps valid ones", () => {
    const json = JSON.stringify({
      summary: "Plan.",
      priorities: [
        { title: "Bad", reason: "Reason.", urgency: "asap" },
        { title: "Good", reason: "Reason.", urgency: "later" },
      ],
    });
    const plan = parsePlanFromModelContent(json);
    expect(plan.priorities.length).toBe(1);
    expect(plan.priorities[0]?.urgency).toBe("later");
  });

  test("strips C0 control characters from title and reason", () => {
    const json = JSON.stringify({
      summary: "Plan.",
      priorities: [
        {
          title: "Pay\u0000rent\u0001",
          reason: "Bad\u0007 chars",
          urgency: "now",
        },
      ],
    });
    const plan = parsePlanFromModelContent(json);
    expect(plan.priorities.length).toBe(1);
    const first = plan.priorities[0];
    expect(first).toBeDefined();
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting absence of C0/C1 controls
    const controlChars = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;
    if (first) {
      expect(controlChars.test(first.title)).toBe(false);
      expect(controlChars.test(first.reason)).toBe(false);
    }
  });

  test("truncates extremely long titles to <= 200 chars", () => {
    const json = JSON.stringify({
      summary: "Plan.",
      priorities: [
        {
          title: "x".repeat(500),
          reason: "Reason.",
          urgency: "now",
        },
      ],
    });
    const plan = parsePlanFromModelContent(json);
    const first = plan.priorities[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.title.length).toBeLessThanOrEqual(200);
    }
  });

  test("rejects non-object root JSON", () => {
    expect(() => parsePlanFromModelContent("[1,2,3]")).toThrow(/incomplete/i);
    expect(() => parsePlanFromModelContent("\"just a string\"")).toThrow(/incomplete/i);
  });
});
