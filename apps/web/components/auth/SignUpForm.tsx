"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { PRIVACY_URL, TERMS_URL } from "@/config/appConfig";
import { useLocale } from "@/components/providers/LocaleProvider";
import { kb45t, type Kb45Lang } from "@/lib/i18n-groups/kb-45";
import "@/app/v3/kb-45.css";
import { SignInForm } from "./SignInForm";

export type SignUpFormProps = {
  variant?: "page" | "modal";
  nextPath?: string;
  onSuccess?: () => void;
  onSwitchToSignIn?: () => void;
};

/** These are explanations of the flow, never a live approval decision. */
export type SignUpStatusPhase =
  | "overview"
  | "waitingCopy"
  | "approvedCopy"
  | "empty"
  | "loading"
  | "error"
  | "disabled"
  | "overflow";

export function SignUpStatus({
  lang,
  phase = "overview",
  onRetry,
}: {
  readonly lang: Kb45Lang;
  readonly phase?: SignUpStatusPhase;
  readonly onRetry?: () => void;
}) {
  const titleId = useId();
  const text = (key: Parameters<typeof kb45t>[1]) => kb45t(lang, key);
  let title = text("signup.nextTitle");
  let body = text("signup.nextBody");
  if (phase === "waitingCopy") {
    title = text("signup.waitingTitle");
    body = text("signup.waitingBody");
  } else if (phase === "approvedCopy") {
    title = text("signup.approvedTitle");
    body = text("signup.approvedBody");
  } else if (phase === "empty") {
    body = text("signup.gallery.emptyText");
  } else if (phase === "loading") {
    body = text("signup.gallery.loadingText");
  } else if (phase === "error") {
    body = text("signup.gallery.errorText");
  } else if (phase === "disabled") {
    body = text("signup.gallery.disabledText");
  } else if (phase === "overflow") {
    body = text("signup.gallery.longText");
  }
  return (
    <section
      className="kb45-status"
      data-component="SignUpStatus"
      data-phase={phase}
      lang={lang}
      dir={lang === "he" ? "rtl" : "ltr"}
      aria-busy={phase === "loading" ? true : undefined}
      aria-labelledby={titleId}
    >
      <h2 className="kb45-status__title" id={titleId}>{title}</h2>
      <p className="kb45-status__body">{body}</p>
      {phase === "error" && onRetry ? (
        <button type="button" className="kb45-gallery__retry" onClick={onRetry}>{text("signup.gallery.retry")}</button>
      ) : null}
      {phase === "disabled" ? (
        <button type="button" className="kb45-gallery__retry" disabled>{text("signup.gallery.retry")}</button>
      ) : null}
    </section>
  );
}

export function SignUpPrivacyLine({ lang }: { readonly lang: Kb45Lang }) {
  const text = (key: Parameters<typeof kb45t>[1]) => kb45t(lang, key);
  return (
    <p className="kb45-privacy" data-component="SignUpPrivacyLine" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      {text("signup.privacyIntro")}{" "}
      <Link href={TERMS_URL} target="_blank" rel="noopener noreferrer">{text("signup.terms")}</Link>{" "}
      {text("signup.and")}{" "}
      <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{text("signup.privacy")}</Link>.
    </p>
  );
}

/** New accounts use the same magic-link flow and callbacks as sign-in. */
export function SignUpForm({
  variant = "modal",
  nextPath,
  onSuccess,
  onSwitchToSignIn,
}: SignUpFormProps) {
  const { lang } = useLocale();
  const isPage = variant === "page";
  return (
    <div className={`kb45-signup${isPage ? " tp-auth-stack" : ""}`} data-variant={variant} lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <SignInForm
        variant={variant}
        nextPath={nextPath}
        flow="sign-up"
        onSuccess={onSuccess}
        onSwitch={onSwitchToSignIn}
      />
      {isPage ? <SignUpStatus lang={lang} /> : null}
      <SignUpPrivacyLine lang={lang} />
    </div>
  );
}

/** Fictional, controlled examples; the real form above retains auth state. */
export function Kb45Gallery() {
  const { lang } = useLocale();
  const [phase, setPhase] = useState<SignUpStatusPhase>("overview");
  const errorControl = useRef<HTMLButtonElement>(null);
  const retryFocusPending = useRef(false);
  useEffect(() => {
    if (!retryFocusPending.current) return;
    retryFocusPending.current = false;
    if (phase === "overview" && document.activeElement === document.body) {
      errorControl.current?.focus();
    }
  }, [phase]);
  const choices: readonly { phase: SignUpStatusPhase; label: Parameters<typeof kb45t>[1] }[] = [
    { phase: "overview", label: "signup.gallery.default" },
    { phase: "empty", label: "signup.gallery.empty" },
    { phase: "loading", label: "signup.gallery.loading" },
    { phase: "error", label: "signup.gallery.error" },
    { phase: "disabled", label: "signup.gallery.disabled" },
    { phase: "overflow", label: "signup.gallery.overflow" },
    { phase: "waitingCopy", label: "signup.gallery.waiting" },
    { phase: "approvedCopy", label: "signup.gallery.approved" },
  ];
  return (
    <main className="kb45-gallery" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <fieldset className="kb45-gallery__controls">
        <legend className="sr-only">{kb45t(lang, "signup.gallery.title")}</legend>
        {choices.map((choice) => (
          <button
            key={choice.phase}
            ref={choice.phase === "error" ? errorControl : undefined}
            type="button"
            aria-pressed={phase === choice.phase}
            onClick={() => setPhase(choice.phase)}
          >
            {kb45t(lang, choice.label)}
          </button>
        ))}
      </fieldset>
      <SignUpForm variant="page" nextPath="/today" />
      <div className="kb45-gallery__status" aria-live="polite" aria-atomic="true">
        {phase === "overview" ? null : (
          <SignUpStatus
            lang={lang}
            phase={phase}
            onRetry={() => { retryFocusPending.current = true; setPhase("overview"); }}
          />
        )}
      </div>
    </main>
  );
}
