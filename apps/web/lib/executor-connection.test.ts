import { describe, expect, test } from "bun:test";
import {
  CARD_MAX_APPS,
  confirmNotice,
  connectErrorKey,
  convexErrorCode,
  disconnectNotice,
  type ExecutorPhase,
  executorLookupOf,
  executorPhase,
  executorRow,
  formatDay,
  lookupAllowed,
  lookupErrorOutcome,
  lookupOutcome,
  readExecutorReturn,
  recoverConfirm,
  returnNotice,
  safeAuthorizationUrl,
  toolCountKey,
} from "./executor-connection";
import { MESSAGES, type MessageKey } from "./i18n";

const PHASES: ExecutorPhase[] = [
  "loading",
  "not_connected",
  "connecting",
  "connected",
  "needs_reauth",
  "not_answering",
  "paused",
  "not_set_up",
];

describe("executorPhase", () => {
  test("no answer yet is loading", () => {
    expect(executorPhase(undefined)).toBe("loading");
    expect(executorPhase(null)).toBe("loading");
  });
  test("Executor switched off on the deployment, with no connection, is 'not set up'", () => {
    expect(executorPhase({ status: "unavailable", enabled: false })).toBe("not_set_up");
    expect(executorPhase({ status: "connected", enabled: false })).toBe("not_set_up");
  });
  test("switched off with a connection still kept is 'paused', so Disconnect stays possible", () => {
    expect(executorPhase({ status: "unavailable", enabled: false, connectedAt: 1 })).toBe("paused");
  });
  test("unavailable with Executor on means a live connection that didn't answer", () => {
    expect(executorPhase({ status: "unavailable", enabled: true })).toBe("not_answering");
  });
  test("the other statuses pass through", () => {
    expect(executorPhase({ status: "not_connected", enabled: true })).toBe("not_connected");
    expect(executorPhase({ status: "connecting", enabled: true })).toBe("connecting");
    expect(executorPhase({ status: "connected", enabled: true })).toBe("connected");
    expect(executorPhase({ status: "needs_reauth", enabled: true })).toBe("needs_reauth");
  });
  test("an unknown status reads as not connected", () => {
    expect(executorPhase({ status: "revoking" as never, enabled: true })).toBe("not_connected");
  });
});

describe("executorRow: the label and button per state", () => {
  test("not connected: Connect Executor", () => {
    const row = executorRow("not_connected");
    expect(row.badge?.label).toBe("exec.badge.off");
    expect(row.primary).toEqual({ action: "connect", label: "exec.connect", disabled: false });
    expect(row.disconnect).toBe(false);
  });
  test("connecting: Start again, no Disconnect", () => {
    const row = executorRow("connecting");
    expect(row.detail).toBe("exec.detail.connecting");
    expect(row.primary?.label).toBe("exec.startAgain");
    expect(row.disconnect).toBe(false);
  });
  test("connected: the times line and Disconnect only", () => {
    const row = executorRow("connected");
    expect(row.badge?.tone).toBe("done");
    expect(row.primary).toBeNull();
    expect(row.disconnect).toBe(true);
    expect(row.times).toBe(true);
  });
  test("needs reauth: Reconnect, and Disconnect stays possible", () => {
    const row = executorRow("needs_reauth");
    expect(row.detail).toBe("exec.detail.reauth");
    expect(row.primary).toEqual({ action: "reconnect", label: "exec.reconnect", disabled: false });
    expect(row.disconnect).toBe(true);
  });
  test("not answering: says nothing changed, Disconnect stays possible", () => {
    const row = executorRow("not_answering");
    expect(row.detail).toBe("exec.detail.quiet");
    expect(row.disconnect).toBe(true);
  });
  test("not set up: 'Not set up yet' and an inert Connect", () => {
    const row = executorRow("not_set_up");
    expect(row.badge?.label).toBe("exec.badge.notSetUp");
    expect(row.primary?.disabled).toBe(true);
    expect(row.disconnect).toBe(false);
  });
  test("paused: Disconnect only, and no lookup chip", () => {
    const row = executorRow("paused");
    expect(row.badge?.label).toBe("exec.badge.paused");
    expect(row.detail).toBe("exec.detail.paused");
    expect(row.primary).toBeNull();
    expect(row.disconnect).toBe(true);
    expect(lookupAllowed("paused")).toBe(false);
  });
  test("loading shows no button", () => {
    expect(executorRow("loading").primary).toBeNull();
    expect(executorRow("loading").disconnect).toBe(false);
  });
  test("every key a row names exists in both languages", () => {
    for (const phase of PHASES) {
      const row = executorRow(phase);
      const keys = [row.badge?.label, row.detail, row.primary?.label].filter(Boolean) as MessageKey[];
      for (const key of keys) {
        expect(MESSAGES.en[key]?.length ?? 0).toBeGreaterThan(0);
        expect(MESSAGES.he[key]?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});

describe("lookupAllowed: the coach chip", () => {
  test("only with a live connection", () => {
    const allowed = PHASES.filter(lookupAllowed);
    expect(allowed).toEqual(["connected", "not_answering"]);
  });
});

describe("formatDay", () => {
  test("no time, no line", () => {
    expect(formatDay(undefined, "en")).toBeNull();
    expect(formatDay(Number.NaN, "en")).toBeNull();
  });
  test("a time becomes a date with its year", () => {
    const ms = Date.UTC(2026, 9, 16, 12);
    expect(formatDay(ms, "en")).toContain("2026");
    expect(formatDay(ms, "he")).toContain("2026");
  });
});

describe("readExecutorReturn: ?executor=…", () => {
  test("nothing to do without the parameter", () => {
    expect(readExecutorReturn("")).toBeNull();
    expect(readExecutorReturn("?lang=he")).toBeNull();
  });
  test("each value Tempo sends is read and removed", () => {
    for (const value of ["connected", "denied", "expired", "error"] as const) {
      expect(readExecutorReturn(`?executor=${value}`)).toEqual({ outcome: value, nonce: null, search: "" });
    }
  });
  test("other parameters stay", () => {
    expect(readExecutorReturn("?lang=he&executor=connected&x=1")).toEqual({
      outcome: "connected",
      nonce: null,
      search: "?lang=he&x=1",
    });
    expect(readExecutorReturn("executor=denied")?.search).toBe("");
  });
  test("an unknown value is removed without a word", () => {
    expect(readExecutorReturn("?executor=<script>")).toEqual({ outcome: null, nonce: null, search: "" });
  });
  test("confirm with a nonce: both leave the address bar, the nonce is kept for the call", () => {
    // The callback's nonce is 32 random bytes in base64url: 43 characters.
    const nonce = "Zm9vYmFyYmF6cXV4LV9fZm9vYmFyYmF6cXV4LV9fZm9v".slice(0, 43);
    expect(readExecutorReturn(`?executor=confirm&n=${nonce}`)).toEqual({ outcome: "confirm", nonce, search: "" });
    expect(readExecutorReturn("?executor=confirm&n=abcDEF123_-xyz00")).toEqual({
      outcome: "confirm",
      nonce: "abcDEF123_-xyz00",
      search: "",
    });
    expect(readExecutorReturn("?lang=he&executor=confirm&n=0123456789abcdef")).toEqual({
      outcome: "confirm",
      nonce: "0123456789abcdef",
      search: "?lang=he",
    });
  });
  test("confirm without a usable nonce is a calm error, and the bad nonce still leaves", () => {
    expect(readExecutorReturn("?executor=confirm")).toEqual({ outcome: "error", nonce: null, search: "" });
    expect(readExecutorReturn("?executor=confirm&n=")).toEqual({ outcome: "error", nonce: null, search: "" });
    expect(readExecutorReturn("?executor=confirm&n=short")).toEqual({ outcome: "error", nonce: null, search: "" });
    expect(readExecutorReturn("?executor=confirm&n=has%20space%20inside")).toEqual({
      outcome: "error",
      nonce: null,
      search: "",
    });
    expect(readExecutorReturn("?executor=confirm&n=abc.def~ghi.jkl~mno")?.nonce).toBeNull();
    expect(readExecutorReturn(`?executor=confirm&n=${"a".repeat(129)}`)?.nonce).toBeNull();
  });
  test("`n` is only taken with confirm", () => {
    expect(readExecutorReturn("?executor=connected&n=0123456789abcdef")).toEqual({
      outcome: "connected",
      nonce: null,
      search: "?n=0123456789abcdef",
    });
  });
});

describe("notices", () => {
  test("each return has a line in both languages", () => {
    for (const value of ["connected", "denied", "expired", "error"] as const) {
      const key = returnNotice(value).text;
      expect(MESSAGES.en[key].length).toBeGreaterThan(0);
      expect(MESSAGES.he[key].length).toBeGreaterThan(0);
    }
    expect(returnNotice("connected").tone).toBe("done");
  });
  test("confirm answers: connected, expired, mismatch, else the general line", () => {
    expect(confirmNotice({ status: "connected" }).text).toBe("exec.back.connected");
    expect(confirmNotice({ status: "expired" }).text).toBe("exec.back.linkExpired");
    expect(confirmNotice({ status: "mismatch" }).text).toBe("exec.back.mismatch");
    expect(confirmNotice({ status: "error" }).text).toBe("exec.back.error");
    expect(confirmNotice({ status: "constructor" }).text).toBe("exec.back.error");
    expect(confirmNotice(null).text).toBe("exec.back.error");
    expect(confirmNotice("connected").text).toBe("exec.back.error");
  });
  test("disconnect says whether Executor revoked too", () => {
    expect(disconnectNotice(true).text).toBe("exec.disconnected");
    expect(disconnectNotice(false).text).toBe("exec.disconnectedHere");
  });
});

describe("recoverConfirm: a confirm whose reply never came", () => {
  const connecting = { status: "connecting", enabled: true } as const;
  const connectedAt = (ms: number) => ({ status: "connected", enabled: true, connectedAt: ms }) as const;

  test("the live status reads a new connection: the confirm landed, say connected", () => {
    expect(recoverConfirm(connecting, connectedAt(2_000), false)).toBe("connected");
    expect(recoverConfirm(undefined, connectedAt(2_000), false)).toBe("connected");
    // Also after the one Try again.
    expect(recoverConfirm(connecting, connectedAt(2_000), true)).toBe("connected");
    // A reconnect over an older connection: only a different connectedAt counts.
    expect(recoverConfirm(connectedAt(1_000), connectedAt(2_000), false)).toBe("connected");
  });
  test("the staged tokens may still be waiting: offer one Try again with the same nonce", () => {
    expect(recoverConfirm(connecting, connecting, false)).toBe("retry");
    expect(recoverConfirm(connecting, undefined, false)).toBe("retry");
    expect(recoverConfirm(undefined, null, false)).toBe("retry");
    // The older connection still shows and hides the staged one.
    expect(recoverConfirm(connectedAt(1_000), connectedAt(1_000), false)).toBe("retry");
  });
  test("nothing left to confirm, or the Try again was used: the error line, no button", () => {
    for (const status of ["not_connected", "needs_reauth", "unavailable"] as const) {
      expect(recoverConfirm(connecting, { status, enabled: true }, false)).toBe("final");
    }
    expect(recoverConfirm(connecting, { status: "unavailable", enabled: false }, false)).toBe("final");
    expect(recoverConfirm(connecting, connecting, true)).toBe("final");
    expect(recoverConfirm(connectedAt(1_000), connectedAt(1_000), true)).toBe("final");
    expect(recoverConfirm(connecting, undefined, true)).toBe("final");
  });
});

describe("errors", () => {
  test("ConvexError codes are read by shape", () => {
    expect(convexErrorCode({ data: { code: "rate_limited" } })).toBe("rate_limited");
    expect(convexErrorCode({ data: "text" })).toBeNull();
    expect(convexErrorCode(new Error("Server Error"))).toBeNull();
    expect(convexErrorCode(null)).toBeNull();
  });
  test("connect errors get Tempo's own calm words", () => {
    expect(connectErrorKey({ data: { code: "rate_limited" } })).toBe("exec.err.rateLimited");
    expect(connectErrorKey({ data: { code: "unavailable" } })).toBe("exec.err.unavailable");
    expect(connectErrorKey(new Error("raw server text"))).toBe("exec.err.connect");
  });
});

describe("safeAuthorizationUrl", () => {
  test("https opens", () => {
    expect(safeAuthorizationUrl("https://executor.sh/oauth/authorize?client_id=x")).toBe(
      "https://executor.sh/oauth/authorize?client_id=x",
    );
  });
  test("http only on this machine", () => {
    expect(safeAuthorizationUrl("http://localhost:4000/authorize")).toBe("http://localhost:4000/authorize");
    expect(safeAuthorizationUrl("http://evil.example/authorize")).toBeNull();
  });
  test("anything else is refused", () => {
    expect(safeAuthorizationUrl("javascript:alert(1)")).toBeNull();
    expect(safeAuthorizationUrl("data:text/html,hi")).toBeNull();
    expect(safeAuthorizationUrl("/relative")).toBeNull();
    expect(safeAuthorizationUrl(undefined)).toBeNull();
  });
});

describe("lookup outcomes (research doc §4.7)", () => {
  test("replied says nothing more: the answer is in the thread", () => {
    expect(lookupOutcome("replied")).toBeNull();
  });
  test("each other status has a line and the right follow-up", () => {
    expect(lookupOutcome("unavailable")).toEqual({ text: "exec.look.unavailable", action: "retry" });
    expect(lookupOutcome("needs_reauth")).toEqual({ text: "exec.look.reauth", action: "settings" });
    expect(lookupOutcome("rate_limited")).toEqual({ text: "exec.look.rateLimited", action: null });
    expect(lookupOutcome("not_connected")).toEqual({ text: "exec.look.notConnected", action: "settings" });
    expect(lookupOutcome("busy")).toEqual({ text: "exec.look.busy", action: "retry" });
    expect(lookupOutcome("strange" as never)).toEqual({ text: "exec.look.error", action: "retry" });
  });
  test("a blank query and other throws", () => {
    expect(lookupErrorOutcome({ data: { code: "invalid_query" } })).toEqual({ text: "exec.look.empty", action: null });
    expect(lookupErrorOutcome(new Error("x"))).toEqual({ text: "exec.look.error", action: "retry" });
  });
});

describe("executorLookupOf: the answer card", () => {
  test("names and counts from toolCalls.executorLookup", () => {
    const card = executorLookupOf({
      executorLookup: {
        query: "my calendar",
        apps: [
          { name: "Google Calendar", toolCount: 3 },
          { name: "Gmail", toolCount: 5 },
        ],
        total: 8,
      },
    });
    expect(card).toEqual({
      query: "my calendar",
      apps: [
        { name: "Google Calendar", toolCount: 3 },
        { name: "Gmail", toolCount: 5 },
      ],
      total: 8,
    });
  });
  test("any other message draws no card", () => {
    expect(executorLookupOf(undefined)).toBeNull();
    expect(executorLookupOf(null)).toBeNull();
    expect(executorLookupOf({ coachProposal: { kind: "task" } })).toBeNull();
    expect(executorLookupOf({ executorLookup: "raw" })).toBeNull();
    expect(executorLookupOf({ executorLookup: [] })).toBeNull();
  });
  test("only string names and whole counts are kept: nothing else of the object can show", () => {
    const card = executorLookupOf({
      executorLookup: {
        query: 42,
        apps: [
          { name: "  Notion\n\tdocs  ", toolCount: 2, token: "secret-value", path: "notion.search" },
          { name: { nested: true }, toolCount: 1 },
          { name: "Drive", toolCount: -1 },
          { name: "Sheets", toolCount: 1.5 },
          { name: "", toolCount: 1 },
          "Slack",
        ],
        total: 1,
      },
    });
    expect(card).toEqual({ query: "", apps: [{ name: "Notion docs", toolCount: 2 }], total: 2 });
    expect(JSON.stringify(card)).not.toContain("secret-value");
    expect(JSON.stringify(card)).not.toContain("notion.search");
  });
  test("long names are cut, and at most the backend's 10 apps are listed", () => {
    const apps = Array.from({ length: 14 }, (_, i) => ({ name: `App ${i} ${"x".repeat(60)}`, toolCount: 1 }));
    const card = executorLookupOf({ executorLookup: { query: "q", apps, total: 14 } });
    expect(card?.apps.length).toBe(CARD_MAX_APPS);
    expect(Array.from(card?.apps[0]?.name ?? "").length).toBeLessThanOrEqual(40);
    expect(card?.total).toBe(14);
  });
  test("a total with no named apps still shows; no total falls back to the listed sum", () => {
    expect(executorLookupOf({ executorLookup: { query: "q", apps: [], total: 6 } })?.total).toBe(6);
    expect(executorLookupOf({ executorLookup: { query: "q", apps: [{ name: "A", toolCount: 2 }] } })?.total).toBe(2);
    expect(executorLookupOf({ executorLookup: { query: "q", apps: [], total: 0 } })).toEqual({
      query: "q",
      apps: [],
      total: 0,
    });
  });
  test("tool counts read naturally in both languages", () => {
    expect(toolCountKey(1, "row")).toBe("exec.card.tool1");
    expect(toolCountKey(3, "row")).toBe("exec.card.tools");
    expect(toolCountKey(1, "total")).toBe("exec.card.total1");
    expect(toolCountKey(0, "total")).toBe("exec.card.total");
    expect(MESSAGES.en["exec.card.tools"].replace("{n}", "3")).toBe("3 tools");
    expect(MESSAGES.he["exec.card.tools"]).toContain("{n}");
  });
});

describe("copy", () => {
  test("every Executor string is calm: no exclamation marks, no raw codes", () => {
    for (const lang of ["en", "he"] as const) {
      for (const [key, text] of Object.entries(MESSAGES[lang])) {
        if (!key.startsWith("exec.")) continue;
        expect(text.includes("!")).toBe(false);
        expect(/client_id|access_token|refresh_token|nonce/i.test(text)).toBe(false);
      }
    }
  });
  test("the Integrations notice no longer says nothing is connected", () => {
    expect(MESSAGES.en["set.integ.nTitle"]).not.toContain("Nothing is connected");
    expect(MESSAGES.he["set.integ.nTitle"]).not.toBe("שום דבר עוד לא מחובר.");
  });
});
