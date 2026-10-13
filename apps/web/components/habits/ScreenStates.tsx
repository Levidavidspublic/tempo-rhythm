"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { Component, Fragment, type ReactNode, useSyncExternalStore } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { splitTemplate } from "@/lib/habits-view";

/**
 * Shared states for the v3 Habits and Routines screens (tempo.css "STATES"): loading skeleton,
 * error with Retry, offline notice, empty state. The design toggles them with data-state-*;
 * here they render only when their state is active.
 */

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** False while the browser reports no connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
}

export type ProfileState = "loading" | "signed-out" | "ready";

/**
 * Queries that call requireUser throw until the user row exists, so screens subscribe only once
 * users.getProfile has a row (the ProfileReady pattern).
 */
export function useProfileState(): ProfileState {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  if (isLoading || (isAuthenticated && profile === undefined)) return "loading";
  if (!isAuthenticated || !profile) return "signed-out";
  return "ready";
}

/** Renders a template's `{slot}`s with the given nodes (numbers in tp-num, a tag, a name). */
export function Template({
  template,
  slots,
}: {
  template: string;
  slots: Record<string, ReactNode>;
}) {
  return (
    <>
      {splitTemplate(template).map((part, index) =>
        "text" in part ? (
          <Fragment key={index}>{part.text}</Fragment>
        ) : (
          <Fragment key={index}>{slots[part.slot] ?? `{${part.slot}}`}</Fragment>
        )
      )}
    </>
  );
}

/** StateOffline: content stays usable; changes save when the connection is back. */
export function StateOffline() {
  const { t } = useLocale();
  return (
    <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
      <span className="tp-notice__icon">
        <TpIcon name="wifi-off" size="sm" />
      </span>
      <span className="tp-notice__text">
        <span>{t("hr.offline")}</span>
      </span>
    </output>
  );
}

/** Skeleton rows: each row is [first line width, optional second line width]. */
export type SkeletonRow = readonly [string, string?];

export function StateLoading({ label, rows }: { label: string; rows: readonly SkeletonRow[] }) {
  return (
    <output className="tp-state--loading block" data-component="StateLoading">
      <span className="tp-sr-only">{label}</span>
      <span className="tp-skel-list" aria-hidden="true">
        {rows.map(([first, second], index) => (
          <span className="tp-skel-row" key={index}>
            <span className="tp-skeleton tp-skel-row__box" />
            <span className="tp-skel-row__lines">
              <span className={`tp-skeleton tp-skeleton--${first}`} />
              {second ? (
                <span className={`tp-skeleton tp-skeleton--sm tp-skeleton--${second}`} />
              ) : null}
            </span>
          </span>
        ))}
      </span>
    </output>
  );
}

export function StateError({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="tp-state tp-state--error" role="alert" data-component="StateError">
      <span className="tp-state__icon">
        <TpIcon name="refresh" size="lg" />
      </span>
      <h2 className="tp-state__title">{title}</h2>
      <p className="tp-state__body">{t("hr.safe")}</p>
      <div className="tp-state__actions">
        <button className="tp-btn tp-btn--secondary" type="button" onClick={onRetry}>
          <TpIcon name="refresh" size="sm" />
          <span>{t("hr.retry")}</span>
        </button>
      </div>
    </div>
  );
}

export function StateEmpty({
  icon,
  title,
  body,
  children,
}: {
  icon: TpIconName;
  title: string;
  body?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="tp-state tp-state--empty" data-component="StateEmpty">
      <span className="tp-state__icon">
        <TpIcon name={icon} size="lg" />
      </span>
      <h2 className="tp-state__title">{title}</h2>
      {body ? <p className="tp-state__body">{body}</p> : null}
      {children ? <div className="tp-state__actions">{children}</div> : null}
    </div>
  );
}

/** Signed out (the shell normally redirects first): a calm way back in. */
export function StateSignedOut() {
  const { t } = useLocale();
  return (
    <StateEmpty icon="user" title={t("hr.signedOut")}>
      <Link className="tp-btn tp-btn--secondary" href="/sign-in">
        <span>{t("hr.signIn")}</span>
      </Link>
    </StateEmpty>
  );
}

/**
 * Catches a query that throws (Convex surfaces server errors during render) and shows the
 * screen's StateError. Retry mounts the screen again, which subscribes afresh.
 */
export class ScreenErrorBoundary extends Component<
  { fallback: (retry: () => void) => ReactNode; children: ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => {
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
