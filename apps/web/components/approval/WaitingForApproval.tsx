"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";

/**
 * Calm full-screen notice for accounts that are not approved yet, in the v3 AuthCard with a
 * StatusPanel (docs/design/v3/screens/web/approval-pending.html).
 * ApprovalGate reads the status through a live Convex query, so an approval that lands while this
 * page is open swaps in the app with no reload. The copy says so, and that no email is sent, so a
 * new person knows what happens next. A sign-out that doesn't go through says so and can be tried
 * again.
 */
export function WaitingForApproval({ email, revoked }: { email: string; revoked: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <WaitingCard
      email={email}
      revoked={revoked}
      signingOut={signingOut}
      signOutFailed={signOutFailed}
      onSignOut={() => void onSignOut()}
    />
  );
}

/** The waiting screen itself, without the auth and router hooks (tests render it directly). */
export function WaitingCard({
  email,
  revoked,
  signingOut,
  signOutFailed,
  onSignOut,
}: {
  email: string;
  revoked: boolean;
  signingOut: boolean;
  signOutFailed: boolean;
  onSignOut: () => void;
}) {
  const { t } = useLocale();
  return (
    <main className="tp-auth" id="main" data-testid="approval-waiting">
      {/* Outside the app shell, so the screen brings the icon sprite itself. */}
      <TpIconSprite />
      <div className="tp-auth-card" data-component="AuthCard">
        <span className="tp-auth-card__brand">Tempo</span>

        <section className="tp-status-panel" data-component="StatusPanel" aria-labelledby="aw-title">
          <span className="tp-status-panel__icon">
            <TpIcon name={revoked ? "pause" : "clock"} size="lg" />
          </span>
          <h1 className="tp-status-panel__title" id="aw-title">
            {revoked ? t("approval.pausedTitle") : t("approval.waitingTitle")}
          </h1>
          <p className="tp-status-panel__body">{revoked ? t("approval.paused") : t("approval.waitingLede")}</p>
          <p className="tp-status-panel__body">
            {t("approval.signedInAs")}{" "}
            <span className="tp-status-panel__meta tp-ltr" dir="ltr">
              {email}
            </span>
          </p>
          <div className="tp-status-panel__actions">
            <button className="tp-btn tp-btn--secondary" type="button" onClick={onSignOut} disabled={signingOut}>
              <TpIcon name="logout" size="sm" />
              <span>{signingOut ? t("approval.signingOut") : t("approval.signOut")}</span>
            </button>
            {revoked ? (
              // The public Contact page sits outside the app, so a plain link is enough.
              <a className="tp-btn tp-btn--ghost" href="/contact">
                <span>{t("set.approval.contact")}</span>
              </a>
            ) : null}
          </div>
          {signOutFailed ? (
            <p className="tp-error-text" role="alert">
              <TpIcon name="alert" size="sm" />
              <span>{t("set.profile.soError")}</span>
            </p>
          ) : null}
        </section>

        {revoked ? null : (
          <section className="aw-next" aria-labelledby="aw-next-title">
            <h2 className="tp-eyebrow" id="aw-next-title">
              {t("approval.nextTitle")}
            </h2>
            <ol className="tp-steps" data-component="HowItWorks">
              {(["approval.next1", "approval.next2", "approval.next3"] as const).map((key, index) => (
                <li className="tp-step aw-step" key={key}>
                  <span className="tp-step__num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p className="tp-step__body">{t(key)}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
