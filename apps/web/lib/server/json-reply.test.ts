import { describe, expect, test } from "bun:test";
import { okReply, refusalReply } from "./json-reply";

describe("JSON replies", () => {
  test("returns an ok body with the requested status", async () => {
    const response = okReply({ saved: true }, 201);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, data: { saved: true } });
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  test("prevents caching an ok reply", () => {
    expect(okReply(null).headers.get("cache-control")).toBe("no-store");
  });

  test("returns only the safe refusal fields", async () => {
    const response = refusalReply({ status: 403, code: "forbidden", copyKey: "reply.forbidden" });

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      ok: false,
      code: "forbidden",
      copyKey: "reply.forbidden",
    });
  });

  test("adds retry metadata only to a retryable 503", async () => {
    const response = refusalReply({
      status: 503,
      code: "unavailable",
      copyKey: "reply.retry",
      retry: true,
    });

    expect(response.headers.get("retry-after")).toBe("1");
    expect(await response.json()).toEqual({
      ok: false,
      code: "unavailable",
      copyKey: "reply.retry",
      retry: true,
    });
  });

  test("challenges bearer authentication on a 401 refusal", () => {
    const response = refusalReply({ status: 401, code: "signed_out", copyKey: "reply.sign-in" });

    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });

  test("rejects a non-success ok status", () => {
    expect(() => okReply(null, 300)).toThrow(TypeError);
  });

  test("rejects a bad refusal status or blank identifier", () => {
    expect(() =>
      refusalReply({ status: 399, code: "bad_request", copyKey: "reply.bad-request" })
    ).toThrow(TypeError);
    expect(() => refusalReply({ status: 400, code: "   ", copyKey: "reply.bad-request" })).toThrow(
      TypeError
    );
    expect(() => refusalReply({ status: 400, code: "bad_request", copyKey: "\t" })).toThrow(
      TypeError
    );
  });
});
