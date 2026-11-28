import { describe, expect, test } from "bun:test";
import { createRateLimiter, isSameOrigin, parseWaitlistBody, waitlistDocumentId } from "./waitlist";

describe("waitlist input", () => {
  test("accepts an email and normalises it", () => {
    expect(parseWaitlistBody({ email: "  Dana@Example.COM " })).toEqual({
      kind: "join",
      email: "dana@example.com",
    });
  });

  test("rejects what is not an email", () => {
    for (const body of [
      null,
      "x",
      {},
      { email: 5 },
      { email: "" },
      { email: "dana" },
      { email: "a@b" },
      { email: "a b@c.d" },
    ]) {
      expect(parseWaitlistBody(body)).toEqual({ kind: "invalid" });
    }
    expect(parseWaitlistBody({ email: `${"a".repeat(250)}@b.co` })).toEqual({ kind: "invalid" });
  });

  test("a filled company field is dropped without an error", () => {
    expect(parseWaitlistBody({ email: "dana@example.com", company: "Acme" })).toEqual({
      kind: "ignore",
    });
    expect(parseWaitlistBody({ email: "dana@example.com", company: "  " })).toEqual({
      kind: "join",
      email: "dana@example.com",
    });
  });

  test("the same email is always the same document", async () => {
    const id = await waitlistDocumentId("dana@example.com");
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(await waitlistDocumentId("dana@example.com")).toBe(id);
    expect(await waitlistDocumentId("other@example.com")).not.toBe(id);
  });
});

describe("waitlist request guards", () => {
  test("origin must match the host when it is sent", () => {
    expect(isSameOrigin(null, "www.tempoflow.dev")).toBe(true);
    expect(isSameOrigin("https://www.tempoflow.dev", "www.tempoflow.dev")).toBe(true);
    expect(isSameOrigin("https://elsewhere.example", "www.tempoflow.dev")).toBe(false);
    expect(isSameOrigin("not a url", "www.tempoflow.dev")).toBe(false);
    expect(isSameOrigin("https://www.tempoflow.dev", null)).toBe(false);
  });

  test("the limiter allows a few, then waits for the window", () => {
    const allow = createRateLimiter(2, 1000);
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 10)).toBe(true);
    expect(allow("a", 20)).toBe(false);
    expect(allow("b", 20)).toBe(true);
    expect(allow("a", 1011)).toBe(true);
  });
});
