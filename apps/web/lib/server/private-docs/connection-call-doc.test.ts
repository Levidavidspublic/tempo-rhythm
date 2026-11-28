import { expect, test } from "bun:test";

import {
  callViewsNewestFirst,
  toConnectionCallView,
  validateConnectionCallDoc,
  type ConnectionCallDoc,
} from "./connection-call-doc";

const toolCall: ConnectionCallDoc = {
  connectionId: "connection-1",
  kind: "tool_call",
  tool: "search",
  path: "/search",
  decision: "approved",
  outcome: "ok",
  inputDigest: "a".repeat(64),
  resultBytes: 128,
  durationMs: 25,
  messageId: "message-1",
  createdAt: 100,
  updatedAt: 101,
};

test("a valid tool call and a valid disconnect pass", () => {
  expect(validateConnectionCallDoc(toolCall)).toEqual({ ok: true, doc: toolCall });

  const disconnect: ConnectionCallDoc = {
    connectionId: "connection-2",
    kind: "disconnect",
    outcome: "revoked",
    createdAt: 200,
    updatedAt: 200,
  };
  expect(validateConnectionCallDoc(disconnect)).toEqual({ ok: true, doc: disconnect });
});

test("unknown keys, userId, input and result are refused", () => {
  for (const key of ["unexpected", "userId", "input", "result"]) {
    expect(validateConnectionCallDoc({ ...toolCall, [key]: "forbidden" })).toEqual({
      ok: false,
      reason: `unknown key: ${key}`,
    });
  }
});

test("bad enums, a tool call with no tool and a bad digest are refused", () => {
  expect(validateConnectionCallDoc({ ...toolCall, kind: "request" }).ok).toBeFalse();
  expect(validateConnectionCallDoc({ ...toolCall, decision: "pending" }).ok).toBeFalse();
  expect(validateConnectionCallDoc({ ...toolCall, outcome: "success" }).ok).toBeFalse();
  expect(validateConnectionCallDoc({ ...toolCall, tool: "" }).ok).toBeFalse();
  expect(validateConnectionCallDoc({ ...toolCall, tool: undefined }).ok).toBeFalse();
  expect(validateConnectionCallDoc({ ...toolCall, inputDigest: "A".repeat(64) }).ok).toBeFalse();
});

test("toConnectionCallView exposes only the owner's history fields", () => {
  const view = toConnectionCallView("call-1", toolCall);

  expect(Object.keys(view).sort()).toEqual(
    ["createdAt", "decision", "durationMs", "id", "kind", "outcome", "tool"].sort()
  );
  for (const hidden of ["inputDigest", "path", "resultBytes", "messageId", "connectionId"]) {
    expect(hidden in view).toBeFalse();
  }
});

test("callViewsNewestFirst orders, breaks ties, skips deleted rows and preserves input", () => {
  const rows = [
    { id: "b", doc: { ...toolCall, createdAt: 200 } },
    { id: "deleted", doc: { ...toolCall, createdAt: 300, deletedAt: 301 } },
    { id: "old", doc: { ...toolCall, createdAt: 100 } },
    { id: "a", doc: { ...toolCall, createdAt: 200 } },
  ] satisfies { id: string; doc: ConnectionCallDoc }[];
  const originalRows = [...rows];

  expect(callViewsNewestFirst(rows).map(({ id }) => id)).toEqual(["a", "b", "old"]);
  expect(rows).toEqual(originalRows);
});
