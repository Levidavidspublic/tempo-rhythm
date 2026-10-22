"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";

export type SignInFormProps = {
  variant?: "page" | "modal";
  nextPath?: string;
  /** Both flows use the same Resend magic link. */
  flow?: "sign-in" | "sign-up";
  onSuccess?: () => void;
  onSwitch?: () => void;
};

/** Beta intent changes copy only. The authenticated waiting screen owns the request. */
export function SignInForm({ variant = "modal", nextPath, flow = "sign-in", onSuccess, onSwitch }: SignInFormProps) {
  const { signIn } = useAuthActions();
  const { t, dir, lang } = useLocale();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<"rate" | "send" | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [beta, setBeta] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);
  useEffect(() => () => { generation.current += 1; }, []);
  const isPage = variant === "page";
  const isSignUp = flow === "sign-up";
  const Heading = isPage ? "h1" : "h2";
  const fieldId = `${flow}-${variant}-email`;
  const errorId = `${fieldId}-error`;
  const otherPath = isSignUp ? "/sign-in" : "/sign-up";
  const otherHref = nextPath ? { pathname: otherPath, query: { next: nextPath } } : otherPath;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const mine = ++generation.current;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("resend", { email, ...(nextPath ? { redirectTo: nextPath } : {}) });
      if (mine !== generation.current) return;
      setMagicLinkSent(true);
      onSuccess?.();
    } catch (failure: unknown) {
      if (mine !== generation.current) return;
      setError(failure instanceof Error && failure.message.includes("TooManyRequests") ? "rate" : "send");
    } finally {
      if (mine === generation.current) {
        busy.current = false;
        setIsLoading(false);
      }
    }
  }

  return (
    <div className={isPage ? "tp-auth-card" : "tp-field"} data-component="AuthCard" dir={dir} lang={lang}>
      <TpIconSprite />
      {isPage ? <Link className="tp-auth-card__brand" href="/" style={{ minBlockSize: "var(--tp-touch)" }}>Tempo</Link> : null}
      <div>
        <Heading className="tp-auth-card__title">
          {magicLinkSent ? t("betaAuth.emailTitle") : beta ? t("betaAuth.betaTitle") : isSignUp ? t("betaAuth.createTitle") : t("betaAuth.signInTitle")}
        </Heading>
        {magicLinkSent ? (
          <>
            <p className="tp-auth-card__lede">{t("betaAuth.sentBefore")} <strong dir="ltr">{email}</strong>. {t("betaAuth.sentAfter")}</p>
            {beta ? <p className="tp-help">{t("betaAuth.afterLink")}</p> : null}
          </>
        ) : (
          <>
            <p className="tp-auth-card__lede">{beta ? t("betaAuth.betaHelp") : t("betaAuth.magicHelp")}</p>
            <p className="tp-help">{t("betaAuth.pricing")}</p>
          </>
        )}
      </div>
      {magicLinkSent ? (
        <button type="button" className="tp-btn tp-btn--secondary tp-btn--block" style={{ minBlockSize: "var(--tp-touch)" }}
          onClick={() => { generation.current += 1; busy.current = false; setIsLoading(false); setMagicLinkSent(false); setError(null); }}>
          {t("betaAuth.otherEmail")}
        </button>
      ) : (
        <>
          <form className="tp-form" onSubmit={handleSubmit}>
            <div className="tp-field">
              <label className="tp-label" htmlFor={fieldId}>{t("betaAuth.email")}</label>
              <input className="tp-input" id={fieldId} type="email" inputMode="email" dir="ltr" spellCheck={false}
                value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"
                required disabled={isLoading} autoComplete="email" aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? true : undefined} style={{ minBlockSize: "var(--tp-touch)" }} />
            </div>
            {error ? <p id={errorId} className="tp-error-text" role="alert">{t(error === "rate" ? "betaAuth.rateError" : "betaAuth.sendError")}</p> : null}
            <button type="submit" className="tp-btn tp-btn--primary tp-btn--block" disabled={isLoading} style={{ minBlockSize: "var(--tp-touch)" }}>
              <TpIcon name="mail" size="sm" /><span>{t(isLoading ? "betaAuth.sending" : "betaAuth.send")}</span>
            </button>
          </form>
          <button type="button" className="tp-btn tp-btn--secondary tp-btn--block" disabled={isLoading} aria-pressed={beta}
            onClick={() => { setBeta(!beta); setError(null); }} style={{ minBlockSize: "var(--tp-touch)" }}>
            {t(beta ? "betaAuth.regular" : "betaAuth.betaTitle")}
          </button>
          <p className="tp-auth-card__foot">
            {t(isSignUp ? "betaAuth.haveAccount" : "betaAuth.newAccount")} {" "}
            {isPage ? (
              <Link href={otherHref} className="tp-btn tp-btn--secondary" style={{ minBlockSize: "var(--tp-touch)" }}>
                {t(isSignUp ? "betaAuth.signInTitle" : "betaAuth.createTitle")}
              </Link>
            ) : (
              <button type="button" className="tp-btn tp-btn--secondary" disabled={isLoading} onClick={() => onSwitch?.()} style={{ minBlockSize: "var(--tp-touch)" }}>
                {t(isSignUp ? "betaAuth.signInTitle" : "betaAuth.createTitle")}
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}
