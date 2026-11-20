"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { CoachWebSearchSetting } from "@/components/coach/CoachWebSearchSetting";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, TpIconSprite, type TpIconName } from "@/components/tempo/TpIcon";
import { ProfileReady } from "@/components/today/ProfileReady";
import type { MessageKey } from "@/lib/i18n";
import { signOutDeletedAccount, useDeletedAccountState } from "./accountDeleted";
import { SettingsErrorBoundary, StateError, StateLoading, StateOffline } from "./states";
import { SettingsStatusContext } from "./status";

/**
 * Frame for the v3 settings screens inside TempoShell (settings-*.html, billing.html):
 * PageHeader, the offline notice, an optional notice, then the screen body. The body waits for
 * `users.getProfile` (ProfileReady) so queries that call requireUser never run early, shows
 * StateLoading meanwhile and StateError (with Retry) if a query throws.
 * Route pages render the PageLayout wrapper (with their data-testid) around this.
 */

export type ScreenNotice = { tone: "info" | "done" | "caution"; icon: TpIconName; title: MessageKey; body: MessageKey };

/**
 * The Preferences screen's title. That screen also shows the coach's web search switch
 * (TEMPO-B07-06) as its last section, after the screen's own form.
 */
const PREFERENCES_TITLE: MessageKey = "set.prefs.title";

export function SettingsScreen({
  title,
  sub,
  offline,
  loading,
  errorTitle,
  errorBody,
  bodyClassName,
  stateClassName,
  statusLine = false,
  gate = true,
  notice,
  children,
}: {
  title: MessageKey;
  sub: MessageKey;
  offline: MessageKey;
  loading: MessageKey;
  errorTitle: MessageKey;
  errorBody: MessageKey;
  bodyClassName: string;
  stateClassName: string;
  /** A quiet status line under the subtitle (preferences: "Saved."). */
  statusLine?: boolean;
  /** Wait for the signed-in user before mounting the body. */
  gate?: boolean;
  notice?: ScreenNotice;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const [status, setStatus] = useState("");
  const timer = useRef<number | null>(null);
  // Clear, then set, so the same "Saved." is spoken again after every change.
  const announce = useCallback((text: string) => {
    setStatus("");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(text), 50);
  }, []);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // A deleted account has no profile, so the gate below would hide a failed sign-out behind
  // the loading state; show the retry in its place instead.
  const deleted = useDeletedAccountState();
  const fallback =
    deleted === "signOutFailed" ? (
      <DeletedSignOut className={stateClassName} />
    ) : (
      <StateLoading label={loading} className={stateClassName} />
    );
  const content =
    title === PREFERENCES_TITLE ? (
      <>
        {children}
        <CoachWebSearchSetting />
      </>
    ) : (
      children
    );
  const body = gate ? <ProfileReady fallback={fallback}>{content}</ProfileReady> : content;

  return (
    <SettingsStatusContext.Provider value={announce}>
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t(title)}</h1>
          <p className="tp-pagehead__sub">{t(sub)}</p>
          {statusLine ? <output className="tp-help">{status}</output> : null}
        </div>
      </header>

      <StateOffline body={offline} />

      {notice ? (
        <div className="tp-notice" data-tone={notice.tone} data-component="Notice">
          <span className="tp-notice__icon">
            <TpIcon name={notice.icon} size="sm" />
          </span>
          <span className="tp-notice__text">
            <span className="tp-notice__title">{t(notice.title)}</span>
            <span>{t(notice.body)}</span>
          </span>
        </div>
      ) : null}

      <div className={bodyClassName}>
        <SettingsErrorBoundary
          fallback={(retry) => (
            <StateError title={errorTitle} body={errorBody} onRetry={retry} className={stateClassName} />
          )}
        >
          {body}
        </SettingsErrorBoundary>
      </div>
    </SettingsStatusContext.Provider>
  );
}

/** The account is deleted but signing out failed: say so and offer the sign-out again. */
function DeletedSignOut({ className }: { className: string }) {
  const { t } = useLocale();
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <div className={["tp-state tp-state--error", className].join(" ")} role="alert" data-component="StateError">
      <span className="tp-state__icon">
        <TpIcon name="alert" size="lg" />
      </span>
      <p className="tp-state__body">{t("set.privacy.deletedSignOut")}</p>
      <div className="tp-state__actions">
        <button
          className="tp-btn tp-btn--secondary"
          type="button"
          onClick={() => void signOutDeletedAccount(signOut, () => router.push("/sign-in"))}
        >
          <span>{t("set.privacy.signOutRetry")}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Frame for the bare (no shell) v3 screens: onboarding and trial end. A skip link, the `.tp-auth`
 * main with the icon sprite (outside TempoShell), and the AuthCard loading / error states.
 */
export function BareScreen({
  testId,
  loading,
  errorTitle,
  errorBody,
  errorLink,
  children,
}: {
  testId: string;
  loading: MessageKey;
  errorTitle: MessageKey;
  errorBody: MessageKey;
  /** A second way out of the error state (trial end: "See every plan"). */
  errorLink?: { href: string; label: MessageKey };
  children: ReactNode;
}) {
  const { t } = useLocale();
  const errorExtra = errorLink ? (
    <Link className="tp-btn tp-btn--ghost" href={errorLink.href}>
      {t(errorLink.label)}
    </Link>
  ) : undefined;
  return (
    <>
      <a className="tp-skip" href="#main">
        {t("skip")}
      </a>
      <main className="tp-auth" id="main" tabIndex={-1} data-testid={testId}>
        <TpIconSprite />
        <SettingsErrorBoundary
          fallback={(retry) => (
            <div className="tp-auth-card" data-component="AuthCard">
              <StateError title={errorTitle} body={errorBody} onRetry={retry} heading="h1" extra={errorExtra} />
            </div>
          )}
        >
          <ProfileReady
            fallback={
              <div className="tp-auth-card" data-component="AuthCard">
                <StateLoading label={loading} rows={3} />
              </div>
            }
          >
            {children}
          </ProfileReady>
        </SettingsErrorBoundary>
      </main>
    </>
  );
}
