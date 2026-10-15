"use client";

import Link from "next/link";
import { Component, type ReactNode, useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { LOADING_TIMEOUT_MS } from "@/lib/you/screenState";

/** The v3 state blocks (docs/design/v3/components.md §4), shared by the "You" screens. */

const SKELETON_WIDTHS = [
  "tp-skeleton--w80",
  "tp-skeleton--w60",
  "tp-skeleton--w100",
  "tp-skeleton--w40",
] as const;

/** StateLoading: skeleton rows with a screen-reader label. */
export function StateLoading({
  label,
  rows = 5,
  box = true,
}: {
  label: string;
  rows?: number;
  box?: boolean;
}) {
  return (
    <div className="tp-state--loading you-loading" data-component="StateLoading">
      <output className="tp-sr-only">{label}</output>
      <div className="tp-skel-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div className="tp-skel-row" key={i}>
            {box ? <span className="tp-skeleton tp-skel-row__box" /> : null}
            <span className="tp-skel-row__lines">
              <span className={`tp-skeleton ${SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}`} />
              <span className="tp-skeleton tp-skeleton--sm tp-skeleton--w40" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** StateError: what failed, that nothing was lost, and Retry. */
export function StateError({
  title,
  body,
  onRetry,
  className,
}: {
  title: string;
  body: string;
  onRetry: () => void;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <div
      className={`tp-state tp-state--error ${className ?? ""}`}
      role="alert"
      data-component="StateError"
    >
      <span className="tp-state__icon">
        <TpIcon name="refresh" size="lg" />
      </span>
      <h2 className="tp-state__title">{title}</h2>
      <p className="tp-state__body">{body}</p>
      <div className="tp-state__actions">
        <button className="tp-btn tp-btn--secondary" type="button" onClick={onRetry}>
          <TpIcon name="refresh" size="sm" />
          <span>{t("you.retry")}</span>
        </button>
      </div>
    </div>
  );
}

/** StateEmpty: a kind sentence and one next step. */
export function StateEmpty({
  icon,
  title,
  body,
  action,
  titleLevel = 2,
  className,
}: {
  icon: TpIconName;
  title: string;
  body: string;
  action?: ReactNode;
  titleLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = titleLevel === 3 ? "h3" : "h2";
  return (
    <div className={`tp-state tp-state--empty ${className ?? ""}`} data-component="StateEmpty">
      <span className="tp-state__icon">
        <TpIcon name={icon} size="lg" />
      </span>
      <Heading className="tp-state__title">{title}</Heading>
      <p className="tp-state__body">{body}</p>
      {action ? <div className="tp-state__actions">{action}</div> : null}
    </div>
  );
}

/** Signed out (or the account row isn't there yet): a calm sign-in link instead of data. */
export function StateSignedOut({ body }: { body?: string }) {
  const { t } = useLocale();
  return (
    <div className="tp-state" data-component="StateSignedOut">
      <span className="tp-state__icon">
        <TpIcon name="lock" size="lg" />
      </span>
      <p className="tp-state__body">{body ?? t("you.signInBody")}</p>
      <div className="tp-state__actions">
        <Link className="tp-btn tp-btn--secondary" href="/sign-in">
          {t("you.signIn")}
        </Link>
      </div>
    </div>
  );
}

/** True while the browser says it is online. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** StateOffline: the content stays; this notice says changes wait for the connection. */
export function StateOffline({ title, body }: { title?: string; body?: string }) {
  const { t } = useLocale();
  const online = useOnline();
  if (online) return null;
  const heading = title ?? t("you.offline");
  return (
    <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
      <span className="tp-notice__icon">
        <TpIcon name="wifi-off" size="sm" />
      </span>
      <span className="tp-notice__text">
        {body ? (
          <>
            <span className="tp-notice__title">{heading}</span>
            <span>{body}</span>
          </>
        ) : (
          <span>{heading}</span>
        )}
      </span>
    </output>
  );
}

/** True once `loading` has lasted longer than the allowed wait; resets when loading ends. */
export function useLoadingTimeout(loading: boolean, ms = LOADING_TIMEOUT_MS): boolean {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const id = window.setTimeout(() => setTimedOut(true), ms);
    return () => window.clearTimeout(id);
  }, [loading, ms]);
  return timedOut && loading;
}

/** Catches a query that threw, and shows the screen's own error state with Retry. */
export class ScreenErrorBoundary extends Component<
  { fallback: (retry: () => void) => ReactNode; onRetry: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return this.props.fallback(() => {
        this.setState({ failed: false });
        this.props.onRetry();
      });
    }
    return this.props.children;
  }
}

/** Remounts its child on Retry, so every query subscribes again. */
export function RetryRoot({
  render,
  fallback,
}: {
  render: (retry: () => void) => ReactNode;
  fallback: (retry: () => void) => ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((n) => n + 1);
  return (
    <ScreenErrorBoundary key={attempt} onRetry={retry} fallback={fallback}>
      {render(retry)}
    </ScreenErrorBoundary>
  );
}

/** A polite screen-reader announcement for changes that have no toast. */
export function LiveMessage({ text }: { text: string }) {
  return (
    <p className="tp-sr-only" aria-live="polite">
      {text}
    </p>
  );
}
