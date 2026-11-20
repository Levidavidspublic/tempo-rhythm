"use client";

import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Component, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { ConfirmSheet } from "@/components/you/Controls";
import { api } from "@/convex/_generated/api";
import {
  confirmNotice,
  connectErrorKey,
  disconnectNotice,
  type ExecutorNotice,
  type ExecutorStatusView,
  executorPhase,
  executorRow,
  formatDay,
  readExecutorReturn,
  recoverConfirm,
  returnNotice,
  safeAuthorizationUrl,
} from "@/lib/executor-connection";
import type { MessageKey } from "@/lib/i18n";

/**
 * Settings · Connections: the person's own Executor account (TEMPO-B07-08; design
 * docs/research/EXECUTOR-IN-TEMPO.md §2.5 and §5.5). One row above "Coming later": the name, what
 * Executor does, the state from `connections.status`, and the button for that state (Connect,
 * Start again, Reconnect, Disconnect with a confirm; "Not set up yet" keeps Connect visible but
 * inert). Connect asks `connections.startExecutorConnect` for the authorization URL and opens it
 * in this tab. Executor's callback sends the person back with `?executor=confirm&n=<nonce>`: the
 * page calls `connections.confirmExecutorConnect({ nonce })` once, while signed in, and says the
 * answer. If that call throws (its reply never came), the live status decides: connected means it
 * landed; otherwise one "Try again" re-sends the same nonce (the confirm is safe to repeat).
 * (`?executor=connected|denied|expired|error` is said as it is.) Either way the parameters leave
 * the address bar at once.
 *
 * The browser never holds a token, a code or a client id, and nothing about the connection is
 * kept in browser storage. If the backend isn't deployed yet (or the query throws), the row
 * shows "Not set up yet" instead of breaking the page.
 */

export type ExecutorBusy = "connect" | "disconnect" | null;

export type ExecutorRowProps = {
  /** `connections.status` as returned; undefined while it loads. */
  view: ExecutorStatusView | undefined;
  busy?: ExecutorBusy;
  /** A calm error line under the row (role="alert"). */
  error?: MessageKey | null;
  /** The Disconnect confirm is open. */
  confirming?: boolean;
  onConnect?: () => void;
  onAskDisconnect?: () => void;
  onConfirmDisconnect?: () => void;
  onCancelDisconnect?: () => void;
};

/** The row itself, from plain props: the live component below and visual checks both render it. */
export function ExecutorRow({
  view,
  busy = null,
  error = null,
  confirming = false,
  onConnect,
  onAskDisconnect,
  onConfirmDisconnect,
  onCancelDisconnect,
}: ExecutorRowProps) {
  const { t, lang } = useLocale();
  const id = useId();
  const stateId = `${id}-state`;
  const phase = executorPhase(view);
  const row = executorRow(phase);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const connected = formatDay(view?.connectedAt, lang);
  const lastUsed = formatDay(view?.lastUsedAt, lang);

  // After a disconnect its button is gone; put focus on the row's new button, not the page.
  const hadDisconnect = useRef(row.disconnect);
  useEffect(() => {
    const active = document.activeElement;
    if (hadDisconnect.current && !row.disconnect && (!active || active === document.body)) {
      controlRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    hadDisconnect.current = row.disconnect;
  }, [row.disconnect]);

  return (
    <>
      <div
        className="tp-setting-row tp-setting-row--stack od-row"
        data-component="SettingRow"
        data-testid="executor-row"
        data-phase={phase}
        aria-busy={busy !== null || phase === "loading" ? true : undefined}
      >
        <div className="tp-setting-row__text">
          <span className="tp-setting-row__label ig-name">
            <TpIcon name="link" size="sm" />
            <span>{t("exec.name")}</span>
            {row.badge ? (
              <span className="tp-badge" data-component="Badge" data-tone={row.badge.tone === "neutral" ? undefined : row.badge.tone}>
                <TpIcon name={row.badge.icon} size="sm" />
                <span>{t(row.badge.label)}</span>
              </span>
            ) : null}
          </span>
          <span className="tp-help">{t("exec.what")}</span>
          {row.detail ? (
            <span className="tp-help" id={stateId}>
              {t(row.detail)}
            </span>
          ) : null}
          {row.times ? (
            <span className="tp-help" id={stateId}>
              {connected ? (
                <>
                  {t("exec.connectedOn")} <bdi>{connected}</bdi> ·{" "}
                </>
              ) : null}
              {lastUsed ? (
                <>
                  {t("exec.lastUsed")} <bdi>{lastUsed}</bdi>
                </>
              ) : (
                t("exec.notUsed")
              )}
            </span>
          ) : null}
        </div>
        <div className="tp-setting-row__control" ref={controlRef}>
          {row.primary ? (
            <button
              className="tp-btn tp-btn--primary"
              type="button"
              aria-describedby={stateId}
              aria-disabled={row.primary.disabled || busy !== null ? true : undefined}
              data-action={row.primary.action}
              onClick={() => {
                if (!row.primary?.disabled && busy === null) onConnect?.();
              }}
            >
              <TpIcon name={row.primary.action === "reconnect" ? "refresh" : "link"} size="sm" />
              <span>{busy === "connect" ? t("exec.opening") : t(row.primary.label)}</span>
            </button>
          ) : null}
          {row.disconnect ? (
            <button
              className="tp-btn tp-btn--secondary"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={confirming}
              aria-disabled={busy !== null ? true : undefined}
              data-action="disconnect"
              onClick={() => {
                if (busy === null) onAskDisconnect?.();
              }}
            >
              <span>{busy === "disconnect" ? t("exec.disconnecting") : t("exec.disconnect")}</span>
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className="tp-setting-row" data-component="SettingRow">
          <p className="tp-error-text" role="alert">
            <TpIcon name="alert" size="sm" />
            <span>{t(error)}</span>
          </p>
        </div>
      ) : null}
      {confirming ? (
        <ConfirmSheet
          title={t("exec.confirm.title")}
          body={t("exec.confirm.body")}
          confirmLabel={busy === "disconnect" ? t("exec.disconnecting") : t("exec.confirm.yes")}
          cancelLabel={t("exec.confirm.no")}
          busy={busy === "disconnect"}
          onConfirm={() => onConfirmDisconnect?.()}
          onClose={() => onCancelDisconnect?.()}
        />
      ) : null}
    </>
  );
}

/**
 * A short line that says what just happened (the OAuth return, a disconnect). The live region is
 * always on the page, empty until there is something to say, so the line is spoken when it arrives.
 * With `onRetry`, a "Try again" button sits under it (outside the live region).
 */
export function ExecutorNoticeLine({ notice, onRetry }: { notice: ExecutorNotice | null; onRetry?: (() => void) | null }) {
  const { t } = useLocale();
  return (
    <>
      <output className={notice ? "tp-setting-row" : undefined} data-component="ExecutorNotice">
        {notice ? (
          <span className="tp-notice ig-grow" data-tone={notice.tone} data-component="Notice">
            <span className="tp-notice__icon">
              <TpIcon name={notice.icon} size="sm" />
            </span>
            <span className="tp-notice__text">
              <span>{t(notice.text)}</span>
            </span>
          </span>
        ) : null}
      </output>
      {notice && onRetry ? (
        <div className="tp-setting-row" data-component="SettingRow">
          <button className="tp-btn tp-btn--secondary" type="button" data-action="retry-confirm" onClick={onRetry}>
            <TpIcon name="refresh" size="sm" />
            <span>{t("exec.look.retry")}</span>
          </button>
        </div>
      ) : null}
    </>
  );
}

/** The row is extra: if `connections.status` throws (say #989 isn't deployed), show "Not set up yet". */
class ExecutorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** What the row shows when the backend can't be read: Executor is off on this deployment. */
export const EXECUTOR_NOT_SET_UP: ExecutorStatusView = { status: "unavailable", enabled: false };

function LiveExecutorRow({
  onNotice,
  onView,
}: {
  onNotice: (notice: ExecutorNotice | null) => void;
  /** The live status, for the confirm's reconcile (useExecutorReturn); undefined while it loads. */
  onView: (view: ExecutorStatusView | undefined) => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  // connections.status needs the users row: wait for the profile, like the coach does.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const view = useQuery(api.connections.status, isAuthenticated && profile ? { provider: "executor" } : "skip");
  useEffect(() => {
    onView(view ?? undefined);
  }, [view, onView]);
  const start = useAction(api.connections.startExecutorConnect);
  const disconnect = useAction(api.connections.disconnect);
  const [busy, setBusy] = useState<ExecutorBusy>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Back from Executor through the browser's Back button (page restored from cache): Connect again.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(null);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const connect = async () => {
    setBusy("connect");
    setError(null);
    onNotice(null);
    try {
      const result = await start({ returnTo: "settings" });
      const url = safeAuthorizationUrl(result.authorizationUrl);
      if (!url) {
        setError("exec.err.connect");
        setBusy(null);
        return;
      }
      // Leaves Tempo for Executor's sign-in; the button keeps saying "Opening Executor…".
      window.location.assign(url);
    } catch (caught) {
      setError(connectErrorKey(caught));
      setBusy(null);
    }
  };

  const confirmDisconnect = async () => {
    setBusy("disconnect");
    setError(null);
    try {
      const result = await disconnect({ provider: "executor" });
      setConfirming(false);
      onNotice(disconnectNotice(result.revokedAtProvider));
    } catch {
      setConfirming(false);
      setError("exec.err.disconnect");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ExecutorRow
      view={view ?? undefined}
      busy={busy}
      error={error}
      confirming={confirming}
      onConnect={() => void connect()}
      onAskDisconnect={() => {
        setError(null);
        setConfirming(true);
      }}
      onConfirmDisconnect={() => void confirmDisconnect()}
      onCancelDisconnect={() => {
        if (busy !== "disconnect") setConfirming(false);
      }}
    />
  );
}

/** Nonces already sent to `confirmExecutorConnect` while this page is open: each is used once. */
const confirmedNonces = new Set<string>();

/** A confirm whose reply never came: its nonce (memory only), the status when it first went out. */
type FailedConfirm = { nonce: string; before: ExecutorStatusView | undefined; retried: boolean };

/**
 * Reads the OAuth return once and takes it out of the address bar (`router.replace`, no scroll,
 * other parameters kept). `?executor=confirm&n=…` finishes the connection: once signed in,
 * `connections.confirmExecutorConnect({ nonce })` runs once and its answer is said. If the call
 * throws instead (its reply never came), `recoverConfirm` reads the live status `view`: a new
 * connection means it landed ("connected"); while the staged tokens may still wait, the returned
 * function is the one "Try again", which re-sends the same nonce (the confirm is idempotent);
 * otherwise the general error line. `?executor=connected|denied|expired|error` is said as it is.
 * The nonce stays in memory only (this hook's state), for the call and that one Try again, then
 * it is dropped; it is never shown, logged or put in browser storage or the address bar. A
 * reload forgets it, and the server lets the staged tokens expire (and revokes them).
 */
function useExecutorReturn(
  onNotice: (notice: ExecutorNotice | null) => void,
  view: ExecutorStatusView | undefined,
): (() => void) | null {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const confirm = useAction(api.connections.confirmExecutorConnect);
  const read = useRef(false);
  const [nonce, setNonce] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedConfirm | null>(null);
  // The live status when a confirm goes out (read in an effect, never during render).
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const send = useCallback(
    (value: string, before: ExecutorStatusView | undefined, retried: boolean) => {
      onNotice({ text: "exec.back.confirming", tone: "info", icon: "info" });
      confirm({ nonce: value }).then(
        (result) => onNotice(confirmNotice(result)),
        () => setFailed({ nonce: value, before, retried }),
      );
    },
    [confirm, onNotice],
  );

  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const found = readExecutorReturn(window.location.search);
    if (!found) return;
    router.replace(`${window.location.pathname}${found.search}${window.location.hash}`, { scroll: false });
    const outcome = found.outcome;
    if (outcome === "confirm") {
      setNonce(found.nonce);
    } else if (outcome) {
      // A moment later, so the empty live region is on the page before the line arrives.
      window.setTimeout(() => onNotice(returnNotice(outcome)), 50);
    }
  }, [router, onNotice]);

  useEffect(() => {
    if (!nonce || !isAuthenticated) return;
    setNonce(null);
    // A second run of this effect (React's strict mode, a remount) must not send it again.
    if (confirmedNonces.has(nonce)) return;
    confirmedNonces.add(nonce);
    send(nonce, viewRef.current, false);
  }, [nonce, isAuthenticated, send]);

  // A failed confirm: wait on the live status. Connected → say so; staged tokens may still wait →
  // the error line with Try again (below); nothing left, or Try again used → the error line, and
  // the nonce is dropped.
  const recovery = failed ? recoverConfirm(failed.before, view, failed.retried) : null;
  useEffect(() => {
    if (!recovery) return;
    if (recovery !== "retry") setFailed(null);
    onNotice(confirmNotice(recovery === "connected" ? { status: "connected" } : null));
  }, [recovery, onNotice]);

  if (!failed || recovery !== "retry") return null;
  return () => {
    setFailed(null);
    send(failed.nonce, failed.before, true);
  };
}

/** Settings · Connections: the section with the Executor row (live data). */
export function ExecutorConnection() {
  const { t } = useLocale();
  const [notice, setNotice] = useState<ExecutorNotice | null>(null);
  const [view, setView] = useState<ExecutorStatusView | undefined>(undefined);
  const retryConfirm = useExecutorReturn(setNotice, view);
  return (
    <section
      className="tp-settings-section"
      aria-labelledby="executor-title"
      data-component="SettingsSection"
      data-testid="executor-connection"
    >
      <div className="tp-settings-section__head">
        <h2 className="tp-settings-section__title" id="executor-title">
          {t("exec.section")}
        </h2>
      </div>
      <ExecutorNoticeLine notice={notice} onRetry={retryConfirm} />
      <ExecutorBoundary fallback={<ExecutorRow view={EXECUTOR_NOT_SET_UP} />}>
        <LiveExecutorRow onNotice={setNotice} onView={setView} />
      </ExecutorBoundary>
    </section>
  );
}
