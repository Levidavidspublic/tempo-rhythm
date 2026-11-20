import { expect, test } from "bun:test";
import {
  canConfirm,
  canUseForCall,
  toConnectionView,
  validateConnectionDoc,
  type ConnectionDoc,
} from "./connection-doc";

const valid: ConnectionDoc = {
  provider: "executor",
  status: "connected",
  mcpUrl: "https://example.com/mcp",
  issuer: "https://example.com",
  clientRowId: "client-1",
  connectedAt: 100,
  createdAt: 90,
  updatedAt: 100,
};

test("a valid connection document passes", () => {
  expect(validateConnectionDoc(valid)).toEqual({ ok: true, doc: valid });
});

test("unknown and token keys are refused", () => {
  for (const key of ["", "other", "userId", "accessToken", "refreshToken"]) {
    expect(validateConnectionDoc({ ...valid, [key]: "nope" })).toMatchObject({ ok: false });
  }
});

test("bad status, provider, and non-https URLs are refused", () => {
  expect(validateConnectionDoc({ ...valid, status: "connecting" })).toMatchObject({ ok: false });
  expect(validateConnectionDoc({ ...valid, provider: "other" })).toMatchObject({ ok: false });
  expect(validateConnectionDoc({ ...valid, mcpUrl: "http://example.com/mcp" })).toMatchObject({
    ok: false,
  });
  expect(validateConnectionDoc({ ...valid, issuer: "not a URL" })).toMatchObject({ ok: false });
});

test("only connected and unavailable live rows can be used for calls", () => {
  const statuses: ConnectionDoc["status"][] = [
    "pending_confirm",
    "connected",
    "needs_reauth",
    "unavailable",
    "revoking",
    "disconnected",
  ];
  expect(statuses.map((status) => canUseForCall({ ...valid, status }))).toEqual([
    false,
    true,
    false,
    true,
    false,
    false,
  ]);
  expect(canUseForCall({ ...valid, deletedAt: 101 })).toBe(false);
});

test("only an unexpired pending row with a nonce can be confirmed", () => {
  const pending: ConnectionDoc = {
    ...valid,
    status: "pending_confirm",
    confirmNonceHash: "hash",
    confirmExpiresAt: 200,
  };
  expect(canConfirm(pending, 199)).toBe(true);
  expect(canConfirm(pending, 200)).toBe(false);
  expect(canConfirm({ ...pending, status: "connected" }, 199)).toBe(false);
});

test("the owner view contains only status-safe keys", () => {
  const view = toConnectionView("connection-1", {
    ...valid,
    accountLabel: "Work",
    lastUsedAt: 101,
    lastErrorAt: 102,
    confirmNonceHash: "hash",
    refreshLeaseToken: "lease",
    refreshLeaseUntil: 200,
  });
  expect(Object.keys(view).sort()).toEqual(
    ["id", "provider", "status", "accountLabel", "connectedAt", "lastUsedAt", "lastErrorAt"].sort()
  );
});
