import { describe, expect, test } from "bun:test";

import {
  MAX_BEARER_TOKEN_LENGTH,
  readBearerToken,
  readBearerTokenFromHeaders,
} from "./bearer-token";

describe("readBearerToken", () => {
  test("returns a Bearer token", () => {
    expect(readBearerToken("Bearer aaa.bbb.ccc")).toEqual({
      ok: true,
      token: "aaa.bbb.ccc",
    });
  });

  test("accepts a lowercase scheme and extra spaces", () => {
    expect(readBearerToken("  bearer   aaa.bbb.ccc  ")).toEqual({
      ok: true,
      token: "aaa.bbb.ccc",
    });
  });

  test("refuses null and blank headers as missing", () => {
    expect(readBearerToken(null)).toEqual({ ok: false, reason: "missing" });
    expect(readBearerToken("   ")).toEqual({ ok: false, reason: "missing" });
  });

  test("refuses a scheme other than Bearer", () => {
    expect(readBearerToken("Basic abc")).toEqual({ ok: false, reason: "not-bearer" });
  });

  test("refuses Bearer without a token", () => {
    expect(readBearerToken("Bearer ")).toEqual({ ok: false, reason: "empty" });
  });

  test("refuses a token over the length limit", () => {
    const token = `a.${"b".repeat(MAX_BEARER_TOKEN_LENGTH)}.c`;
    expect(readBearerToken(`Bearer ${token}`)).toEqual({ ok: false, reason: "too-long" });
  });

  test("refuses malformed token parts and characters", () => {
    expect(readBearerToken("Bearer aaa.bbb")).toEqual({ ok: false, reason: "malformed" });
    expect(readBearerToken("Bearer aaa.bb+.ccc")).toEqual({ ok: false, reason: "malformed" });
  });

  test("reads the authorization header from Headers", () => {
    expect(
      readBearerTokenFromHeaders(new Headers({ authorization: "Bearer aaa.bbb.ccc" })),
    ).toEqual({ ok: true, token: "aaa.bbb.ccc" });
  });
});
