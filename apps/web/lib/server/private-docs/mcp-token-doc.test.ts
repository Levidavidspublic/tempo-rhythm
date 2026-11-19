import { describe, expect, test } from "bun:test";
import {
  isMcpTokenUsable,
  toMcpTokenView,
  validateMcpTokenDoc,
  type McpTokenDoc,
} from "./mcp-token-doc";

const validDoc: McpTokenDoc = {
  name: "Tempo desktop",
  tokenHash: "a".repeat(64),
  prefix: "tempo_abc",
  createdAt: 1_700_000_000_000,
  lastUsedAt: 1_700_000_000_100,
  windowStartMs: 1_700_000_000_000,
  windowCount: 2,
};

describe("MCP token documents", () => {
  test("a valid record passes", () => {
    expect(validateMcpTokenDoc(validDoc)).toEqual({ ok: true, doc: validDoc });
  });

  test("unknown keys, userId, and a raw token key are refused", () => {
    for (const extra of [{ unexpected: true }, { userId: "user-1" }, { token: "made-up" }]) {
      expect(validateMcpTokenDoc({ ...validDoc, ...extra }).ok).toBe(false);
    }
  });

  test("bad names, hashes, and prefixes are refused", () => {
    for (const changes of [
      { name: "   " },
      { name: "n".repeat(81) },
      { tokenHash: "A".repeat(64) },
      { tokenHash: "a".repeat(63) },
      { prefix: "" },
      { prefix: "p".repeat(17) },
    ]) {
      expect(validateMcpTokenDoc({ ...validDoc, ...changes }).ok).toBe(false);
    }
  });

  test("the owner view omits hashes and window fields and reports revocation", () => {
    const view = toMcpTokenView("token-1", { ...validDoc, revokedAt: 1_700_000_000_200 });

    expect(Object.keys(view)).toEqual(["id", "name", "prefix", "createdAt", "lastUsedAt", "revoked"]);
    expect(view.revoked).toBe(true);
  });

  test("a revoked token is not usable", () => {
    expect(isMcpTokenUsable(validDoc)).toBe(true);
    expect(isMcpTokenUsable({ ...validDoc, revokedAt: 1_700_000_000_200 })).toBe(false);
  });
});
