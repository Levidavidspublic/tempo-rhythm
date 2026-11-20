"use client";

import { Component, Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";

/**
 * The v3 state blocks every settings, billing and onboarding screen shares (tempo.css "STATES"):
 * StateLoading (skeleton rows + a spoken label), StateError (what failed + Retry),
 * StateOffline (caution notice while the browser is offline) and a small toast.
 */

/** True unless the browser says it is offline. Starts true so the server render matches. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const update = () => setOnline(typeof navigator === "undefined" || navigator.onLine !== false);
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

const SKELETON_WIDTHS = ["tp-skeleton--w80", "tp-skeleton--w60", "tp-skeleton--w80", "tp-skeleton--w60", "tp-skeleton--w80"];

export function StateLoading({ label, rows = 4, className }: { label: MessageKey; rows?: number; className?: string }) {
  const { t } = useLocale();
  return (
    <output className={["tp-state tp-state--loading", className].filter(Boolean).join(" ")} data-component="StateLoading">
      <span className="tp-sr-only">{t(label)}</span>
      <span className="tp-skel-list" aria-hidden="true">
        {SKELETON_WIDTHS.slice(0, rows).map((width, index) => (
          <span className="tp-skel-row" key={index}>
            <span className="tp-skel-row__lines">
              <span className="tp-skeleton tp-skeleton--w40" />
              <span className={`tp-skeleton tp-skeleton--sm ${width}`} />
            </span>
          </span>
        ))}
      </span>
    </output>
  );
}

export function StateError({
  title,
  body,
  onRetry,
  heading = "h2",
  className,
  extra,
}: {
  title: MessageKey;
  body: MessageKey;
  onRetry: () => void;
  heading?: "h1" | "h2";
  className?: string;
  extra?: ReactNode;
}) {
  const { t } = useLocale();
  const Heading = heading;
  return (
    <div className={["tp-state tp-state--error", className].filter(Boolean).join(" ")} role="alert" data-component="StateError">
      <span className="tp-state__icon">
        <TpIcon name="refresh" size="lg" />
      </span>
      <Heading className="tp-state__title">{t(title)}</Heading>
      <p className="tp-state__body">{t(body)}</p>
      <div className="tp-state__actions">
        <button className="tp-btn tp-btn--secondary" type="button" onClick={onRetry}>
          <TpIcon name="refresh" size="sm" />
          <span>{t("set.retry")}</span>
        </button>
        {extra}
      </div>
    </div>
  );
}

/** The caution notice shown while offline. `title` defaults to the shared settings line. */
export function StateOffline({ body, title = "set.offline" }: { body: MessageKey; title?: MessageKey }) {
  const { t } = useLocale();
  const online = useOnline();
  if (online) return null;
  return (
    <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
      <span className="tp-notice__icon">
        <TpIcon name="wifi-off" size="sm" />
      </span>
      <span className="tp-notice__text">
        <span className="tp-notice__title">{t(title)}</span> <span>{t(body)}</span>
      </span>
    </output>
  );
}

type BoundaryProps = { fallback: (retry: () => void) => ReactNode; children: ReactNode };

/**
 * A query that throws (for example a server error) shows StateError instead of breaking the
 * page. Retry mounts the children again, which subscribes to the queries again.
 */
export class SettingsErrorBoundary extends Component<BoundaryProps, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  retry = () => {
    this.setState((current) => ({ failed: false, attempt: current.attempt + 1 }));
  };

  render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

/** One quiet toast ("Saved"). It leaves on its own after a few seconds, or on Dismiss. */
export function Toast({ title, onDismiss }: { title: string; onDismiss: () => void }) {
  const { t } = useLocale();
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const id = window.setTimeout(() => dismiss.current(), 5000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="tp-toast-region">
      <output className="tp-toast tp-glass" data-component="UndoToast">
        <span className="tp-toast__icon">
          <TpIcon name="check" size="sm" />
        </span>
        <span className="tp-toast__text">
          <span className="tp-toast__title">{title}</span>
        </span>
        <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" onClick={onDismiss}>
          {t("set.dismiss")}
        </button>
      </output>
    </div>
  );
}
