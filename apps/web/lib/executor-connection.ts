/**
 * Executor connection, web side (TEMPO-B07-08, #1007): pure helpers for the Settings row, the
 * OAuth return notice, and the coach's "Look in my apps" chip and result card.
 * Design: docs/research/EXECUTOR-IN-TEMPO.md §2.5, §4.3, §4.7, §5.5 (branch t/977-executor-research).
 * Backend contract: convex/connections.ts and coach.lookUpInExecutor (#989).
 *
 * Nothing here reads or writes browser storage: the connection's state lives only in Convex.
 * Nothing here ever holds a token, a code or a client id; the card shows app names and counts only.
 */
import type { MessageKey } from "./i18n";

/** `connections.status({ provider: "executor" }).status`. */
export type ExecutorStatus = "not_connected" | "connecting" | "connected" | "needs_reauth" | "unavailable";

/** What `connections.status` returns (never a secret). */
export type ExecutorStatusView = {
  status: ExecutorStatus;
  enabled: boolean;
  connectedAt?: number;
  lastUsedAt?: number;
};

/**
 * What the row shows. `unavailable` splits in two: the deployment has Executor off
 * (`enabled: false`, "Not set up yet") or a live connection whose last call got no answer
 * (`enabled: true`; it clears on the next good lookup).
 */
export type ExecutorPhase =
  | "loading"
  | "not_connected"
  | "connecting"
  | "connected"
  | "needs_reauth"
  | "not_answering"
  | "not_set_up";

export function executorPhase(view: ExecutorStatusView | null | undefined): ExecutorPhase {
  if (!view) return "loading";
  if (!view.enabled) return "not_set_up";
  switch (view.status) {
    case "connecting":
    case "connected":
    case "needs_reauth":
      return view.status;
    case "unavailable":
      return "not_answering";
    default:
      return "not_connected";
  }
}

export type BadgeTone = "neutral" | "done" | "info" | "caution";
export type ExecutorIcon = "link" | "check" | "clock" | "alert";

export type ExecutorRowModel = {
  badge: { label: MessageKey; tone: BadgeTone; icon: ExecutorIcon } | null;
  /** One sentence about the state, under the description. Null when the times line says it. */
  detail: MessageKey | null;
  /** Connect / Reconnect / Start again. `disabled` keeps it visible but inert (Not set up yet). */
  primary: { action: "connect" | "reconnect"; label: MessageKey; disabled: boolean } | null;
  /** A Disconnect button (asks first). */
  disconnect: boolean;
  /** The "Connected … · Last used …" line. */
  times: boolean;
};

const ROWS: Record<ExecutorPhase, ExecutorRowModel> = {
  loading: { badge: null, detail: "exec.detail.loading", primary: null, disconnect: false, times: false },
  not_connected: {
    badge: { label: "exec.badge.off", tone: "neutral", icon: "link" },
    detail: "exec.detail.off",
    primary: { action: "connect", label: "exec.connect", disabled: false },
    disconnect: false,
    times: false,
  },
  connecting: {
    badge: { label: "exec.badge.connecting", tone: "info", icon: "clock" },
    detail: "exec.detail.connecting",
    primary: { action: "connect", label: "exec.startAgain", disabled: false },
    disconnect: false,
    times: false,
  },
  connected: {
    badge: { label: "exec.badge.on", tone: "done", icon: "check" },
    detail: null,
    primary: null,
    disconnect: true,
    times: true,
  },
  needs_reauth: {
    badge: { label: "exec.badge.reauth", tone: "caution", icon: "alert" },
    detail: "exec.detail.reauth",
    primary: { action: "reconnect", label: "exec.reconnect", disabled: false },
    disconnect: true,
    times: false,
  },
  not_answering: {
    badge: { label: "exec.badge.quiet", tone: "caution", icon: "alert" },
    detail: "exec.detail.quiet",
    primary: null,
    disconnect: true,
    times: false,
  },
  not_set_up: {
    badge: { label: "exec.badge.notSetUp", tone: "neutral", icon: "clock" },
    detail: "exec.detail.notSetUp",
    primary: { action: "connect", label: "exec.connect", disabled: true },
    disconnect: false,
    times: false,
  },
};

export function executorRow(phase: ExecutorPhase): ExecutorRowModel {
  return ROWS[phase];
}

/**
 * The coach's "Look in my apps" chip shows only with a live connection: connected, or connected
 * but the last call got no answer (a lookup is how that state clears, doc §4.7).
 */
export function lookupAllowed(phase: ExecutorPhase): boolean {
  return phase === "connected" || phase === "not_answering";
}

/** A date for the times line, in the app language. Null when there is none. */
export function formatDay(ms: number | undefined, lang: "en" | "he"): string | null {
  if (ms === undefined || !Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString(lang === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// The OAuth return: ?executor=confirm&n=<nonce>, or ?executor=connected|denied|expired|error
// ---------------------------------------------------------------------------

export type ExecutorReturn = "connected" | "denied" | "expired" | "error";

export const EXECUTOR_PARAM = "executor";
/** The one-time nonce that comes with `?executor=confirm`. */
export const NONCE_PARAM = "n";

const RETURNS: readonly ExecutorReturn[] = ["connected", "denied", "expired", "error"];

/** A nonce as Tempo's callback writes it (base64url), the shape confirmExecutorConnectFlow accepts. */
const NONCE_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

export type ExecutorReturnRead = {
  /**
   * "confirm": call `connections.confirmExecutorConnect({ nonce })` once, then say its answer.
   * Else a line to say now; null for a value Tempo doesn't send (removed without a word).
   */
  outcome: ExecutorReturn | "confirm" | null;
  /** Only with "confirm". Kept in memory for the one call: never shown, logged or stored. */
  nonce: string | null;
  /** The search string without these parameters ("" or "?a=b"), for `router.replace`. */
  search: string;
};

/**
 * Reads the OAuth return from a search string. Null when `executor` is absent (nothing to do).
 * `?executor=confirm` needs a well-formed `n`; without one it reads as "error". Both parameters
 * leave the address bar; any other parameter stays.
 */
export function readExecutorReturn(search: string): ExecutorReturnRead | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!params.has(EXECUTOR_PARAM)) return null;
  const value = params.get(EXECUTOR_PARAM) ?? "";
  params.delete(EXECUTOR_PARAM);
  let outcome: ExecutorReturnRead["outcome"] = null;
  let nonce: string | null = null;
  if (value === "confirm") {
    const given = params.get(NONCE_PARAM) ?? "";
    params.delete(NONCE_PARAM);
    if (NONCE_SHAPE.test(given)) {
      outcome = "confirm";
      nonce = given;
    } else {
      outcome = "error";
    }
  } else if ((RETURNS as readonly string[]).includes(value)) {
    outcome = value as ExecutorReturn;
  }
  const rest = params.toString();
  return { outcome, nonce, search: rest ? `?${rest}` : "" };
}

export type ExecutorNotice = { text: MessageKey; tone: "done" | "info" | "caution"; icon: "check" | "info" | "alert" };

const RETURN_NOTICES: Record<ExecutorReturn, ExecutorNotice> = {
  connected: { text: "exec.back.connected", tone: "done", icon: "check" },
  denied: { text: "exec.back.denied", tone: "info", icon: "info" },
  expired: { text: "exec.back.expired", tone: "caution", icon: "alert" },
  error: { text: "exec.back.error", tone: "caution", icon: "alert" },
};

export function returnNotice(outcome: ExecutorReturn): ExecutorNotice {
  return RETURN_NOTICES[outcome];
}

/** `connections.confirmExecutorConnect` answers with one of these (anything else reads as "error"). */
export type ConfirmStatus = "connected" | "expired" | "mismatch" | "error";

const CONFIRM_NOTICES: Record<ConfirmStatus, ExecutorNotice> = {
  connected: { text: "exec.back.connected", tone: "done", icon: "check" },
  expired: { text: "exec.back.linkExpired", tone: "caution", icon: "alert" },
  mismatch: { text: "exec.back.mismatch", tone: "caution", icon: "alert" },
  error: { text: "exec.back.error", tone: "caution", icon: "alert" },
};

/** What the confirm step says, from its result (or from anything else, as the general line). */
export function confirmNotice(result: unknown): ExecutorNotice {
  const status =
    typeof result === "object" && result !== null ? (result as { status?: unknown }).status : undefined;
  return typeof status === "string" && Object.hasOwn(CONFIRM_NOTICES, status)
    ? CONFIRM_NOTICES[status as ConfirmStatus]
    : CONFIRM_NOTICES.error;
}

/** What Disconnect says once it is done (doc §2.5 step 5). */
export function disconnectNotice(revokedAtProvider: boolean): ExecutorNotice {
  return revokedAtProvider
    ? { text: "exec.disconnected", tone: "done", icon: "check" }
    : { text: "exec.disconnectedHere", tone: "info", icon: "info" };
}

// ---------------------------------------------------------------------------
// Errors and the authorization URL
// ---------------------------------------------------------------------------

/** `ConvexError.data.code` when the error carries one (read by shape, so tests need no Convex). */
export function convexErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** Calm copy for a `startExecutorConnect` that threw. Server text is never shown. */
export function connectErrorKey(error: unknown): MessageKey {
  const code = convexErrorCode(error);
  if (code === "rate_limited") return "exec.err.rateLimited";
  if (code === "unavailable") return "exec.err.unavailable";
  return "exec.err.connect";
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The URL `startExecutorConnect` returned, if it is safe to open: https, or http on this
 * machine (a local Executor). Anything else (javascript:, data:, a bad string) is null.
 */
export function safeAuthorizationUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol === "https:") return url.toString();
  if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) return url.toString();
  return null;
}

// ---------------------------------------------------------------------------
// "Look in my apps" (coach.lookUpInExecutor)
// ---------------------------------------------------------------------------

/** Longest query Tempo sends to Executor (convex/lib/connections/lookup.ts LOOKUP_LIMITS.queryChars). */
export const LOOKUP_QUERY_MAX = 200;

export type LookupStatus = "replied" | "not_connected" | "needs_reauth" | "unavailable" | "rate_limited" | "busy";

export type LookupOutcome = {
  text: MessageKey;
  /** A follow-up the line offers: run the same lookup again, or open Settings. */
  action: "retry" | "settings" | null;
};

const LOOKUP_OUTCOMES: Record<Exclude<LookupStatus, "replied">, LookupOutcome> = {
  unavailable: { text: "exec.look.unavailable", action: "retry" },
  needs_reauth: { text: "exec.look.reauth", action: "settings" },
  rate_limited: { text: "exec.look.rateLimited", action: null },
  not_connected: { text: "exec.look.notConnected", action: "settings" },
  busy: { text: "exec.look.busy", action: "retry" },
};

/** What the chip says after a lookup that wrote no reply (doc §4.7). Null after "replied". */
export function lookupOutcome(status: LookupStatus): LookupOutcome | null {
  if (status === "replied") return null;
  return Object.hasOwn(LOOKUP_OUTCOMES, status) ? LOOKUP_OUTCOMES[status] : { text: "exec.look.error", action: "retry" };
}

/** Calm copy for a lookup that threw: a blank query, else a general line. */
export function lookupErrorOutcome(error: unknown): LookupOutcome {
  return convexErrorCode(error) === "invalid_query"
    ? { text: "exec.look.empty", action: null }
    : { text: "exec.look.error", action: "retry" };
}

// ---------------------------------------------------------------------------
// The result card: toolCalls.executorLookup = { query, apps: [{ name, toolCount }], total }
// ---------------------------------------------------------------------------

/** At most this many apps are listed (the backend keeps 10). */
export const CARD_MAX_APPS = 10;
const CARD_NAME_CHARS = 40;

export type LookupCardApp = { name: string; toolCount: number };
export type LookupCard = { query: string; apps: LookupCardApp[]; total: number };

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function plainName(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return Array.from(text).slice(0, CARD_NAME_CHARS).join("").trim();
}

/**
 * The card's rows from a saved assistant message's `toolCalls`, or null when it carries no
 * Executor lookup. Read defensively: only string names and whole counts are kept, so nothing
 * else of the stored object (and never raw JSON) can reach the screen.
 */
export function executorLookupOf(toolCalls: unknown): LookupCard | null {
  if (typeof toolCalls !== "object" || toolCalls === null) return null;
  const raw = (toolCalls as { executorLookup?: unknown }).executorLookup;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const lookup = raw as { query?: unknown; apps?: unknown; total?: unknown };
  const apps: LookupCardApp[] = [];
  if (Array.isArray(lookup.apps)) {
    for (const item of lookup.apps) {
      if (apps.length >= CARD_MAX_APPS) break;
      if (typeof item !== "object" || item === null) continue;
      const name = plainName((item as { name?: unknown }).name);
      const toolCount = count((item as { toolCount?: unknown }).toolCount);
      if (name && toolCount !== null) apps.push({ name, toolCount });
    }
  }
  const listed = apps.reduce((sum, app) => sum + app.toolCount, 0);
  const total = Math.max(count(lookup.total) ?? listed, listed);
  return { query: plainName(lookup.query), apps, total };
}

/** "1 tool" / "{n} tools" (and the "in all" line) in the app language. */
export function toolCountKey(n: number, kind: "row" | "total"): MessageKey {
  if (kind === "total") return n === 1 ? "exec.card.total1" : "exec.card.total";
  return n === 1 ? "exec.card.tool1" : "exec.card.tools";
}
