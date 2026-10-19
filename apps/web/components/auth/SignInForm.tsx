"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
import { useLocale } from "@/components/providers/LocaleProvider";
import { kb10t, type Kb10Key, type Kb10Lang } from "@/lib/i18n-groups/kb-10";
import "@/app/v3/kb-10.css";

export type SignInFormProps = {
  /** Page layout uses Soft Editorial; modal keeps a compact card. */
  variant?: "page" | "modal";
  nextPath?: string;
  /** Both flows send the same magic link. */
  flow?: "sign-in" | "sign-up";
  onSuccess?: () => void;
  onSwitch?: () => void;
};

type AuthFlow = "sign-in" | "sign-up";
type OtherHref = string | { pathname: string; query: { next: string } };

type MagicLinkStatusProps = {
  email: string;
  flow: AuthFlow;
  lang: Kb10Lang;
  variant: "page" | "modal";
  onReset: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
};

/** The sent view shares the real reset callback with both mounted auth flows. */
export function MagicLinkStatus({ email, flow, lang, variant, onReset, headingRef }: MagicLinkStatusProps) {
  const Heading = variant === "page" ? "h1" : "h2";
  return (
    <div className="kb10-status" data-component="MagicLinkStatus">
      <Heading className="tp-auth-card__title" ref={headingRef} tabIndex={-1}>{kb10t(lang, "kb10.sent")}</Heading>
      <p className="tp-auth-card__lede">
        {kb10t(lang, "kb10.sentPrefix")} <strong><bdi dir="ltr">{email}</bdi></strong>. {kb10t(lang, "kb10.sentSuffix")}
      </p>
      {flow === "sign-up" ? <p className="tp-auth-card__lede">{kb10t(lang, "kb10.approval")}</p> : null}
      <button type="button" className="tp-btn tp-btn--secondary tp-btn--block kb10-target" onClick={onReset}>
        {kb10t(lang, "kb10.reset")}
      </button>
    </div>
  );
}

type SignInHelpProps = {
  flow: AuthFlow;
  lang: Kb10Lang;
  otherHref: OtherHref;
  variant: "page" | "modal";
  onSwitch?: () => void;
  onLanguageChange?: (lang: Kb10Lang) => void;
};

/** Secondary navigation and language controls; neither starts authentication. */
export function SignInHelp({ flow, lang, otherHref, variant, onSwitch, onLanguageChange }: SignInHelpProps) {
  const isSignUp = flow === "sign-up";
  const switchLabel = kb10t(lang, isSignUp ? "kb10.signIn" : "kb10.createOne");
  return (
    <div className="kb10-help" data-component="SignInHelp">
      <p className="tp-auth-card__foot">
        {kb10t(lang, isSignUp ? "kb10.haveAccount" : "kb10.noAccount")} {variant === "page"
          ? <Link href={otherHref} className="kb10-text-link">{switchLabel}</Link>
          : <button type="button" className="kb10-text-link kb10-target" onClick={onSwitch}>{switchLabel}</button>}
      </p>
      <fieldset className="kb10-language">
        <legend className="sr-only">{kb10t(lang, "kb10.language")}</legend>
        <button type="button" className="kb10-target" lang="en" aria-pressed={lang === "en"} onClick={() => onLanguageChange?.("en")}>{kb10t(lang, "kb10.english")}</button>
        <button type="button" className="kb10-target" lang="he" aria-pressed={lang === "he"} onClick={() => onLanguageChange?.("he")}>{kb10t(lang, "kb10.hebrew")}</button>
      </fieldset>
    </div>
  );
}

type PageCardProps = {
  flow: AuthFlow;
  email: string;
  setEmail: (email: string) => void;
  isLoading: boolean;
  error: string;
  sent: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  otherHref: OtherHref;
  variant: "page" | "modal";
  lang: Kb10Lang;
  onSwitch?: () => void;
  onLanguageChange?: (lang: Kb10Lang) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  headingRef?: React.Ref<HTMLHeadingElement>;
  disabled?: boolean;
};

/** One visual and semantic form for the existing page and modal callers. */
function PageCard({ flow, email, setEmail, isLoading, error, sent, onSubmit, onReset, otherHref, variant, lang, onSwitch, onLanguageChange, inputRef, headingRef, disabled = false }: PageCardProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const Heading = variant === "page" ? "h1" : "h2";
  return (
    <div className="tp-auth-card kb10-card" data-component="AuthCard" data-variant={variant} dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
      <TpIconSprite />
      {variant === "page" ? <Link className="tp-auth-card__brand" href="/">{kb10t(lang, "kb10.brand")}</Link> : null}
      {sent ? <MagicLinkStatus email={email} flow={flow} lang={lang} variant={variant} onReset={onReset} headingRef={headingRef} /> : <>
        <div>
          <Heading className="tp-auth-card__title">{kb10t(lang, flow === "sign-up" ? "kb10.signUp" : "kb10.signIn")}</Heading>
          <p className="tp-auth-card__lede">{kb10t(lang, flow === "sign-up" ? "kb10.signUpLede" : "kb10.signInLede")}</p>
        </div>
        <form className="tp-form" onSubmit={onSubmit} noValidate>
          <div className="tp-field">
            <label className="tp-label" htmlFor={fieldId}>{kb10t(lang, "kb10.email")}</label>
            <input ref={inputRef} className="tp-input kb10-email" id={fieldId} type="email" inputMode="email" dir="ltr" spellCheck={false}
              value={email} onChange={e => setEmail(e.target.value)} placeholder={kb10t(lang, "kb10.placeholder")}
              required disabled={isLoading || disabled} autoComplete="email" aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined} />
            {error ? <p className="kb10-error" id={errorId} role="alert"><TpIcon name="alert" size="sm" />{error}</p> : null}
          </div>
          <button type="submit" className="tp-btn tp-btn--primary tp-btn--block kb10-target" disabled={isLoading || disabled} aria-busy={isLoading}>
            <TpIcon name="mail" size="sm" /><span>{kb10t(lang, isLoading ? "kb10.sending" : "kb10.send")}</span>
          </button>
        </form>
      </>}
      <SignInHelp flow={flow} lang={lang} otherHref={otherHref} variant={variant} onSwitch={onSwitch} onLanguageChange={onLanguageChange} />
    </div>
  );
}

/** Magic-link only auth form; backend provider and argument expression stay unchanged. */
export function SignInForm({ variant = "modal", nextPath, flow = "sign-in", onSuccess, onSwitch }: SignInFormProps) {
  const { signIn } = useAuthActions();
  const { lang, setLang } = useLocale();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingRef = useRef(false);
  const focusSentRef = useRef(false);
  const focusResetRef = useRef(false);
  useEffect(() => {
    if (magicLinkSent && focusSentRef.current) {
      headingRef.current?.focus();
      focusSentRef.current = false;
    } else if (!magicLinkSent && focusResetRef.current) {
      inputRef.current?.focus();
      focusResetRef.current = false;
    }
  }, [magicLinkSent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingRef.current) return;
    const input = inputRef.current;
    if (!input?.checkValidity()) {
      setError(kb10t(lang, "kb10.invalid"));
      input?.focus();
      return;
    }
    pendingRef.current = true;
    setIsLoading(true);
    setError("");
    try {
      await signIn("resend", {
        email,
        ...(nextPath ? { redirectTo: nextPath } : {}),
      });
      focusSentRef.current = true;
      setMagicLinkSent(true);
      onSuccess?.();
    } catch (err: unknown) {
      const message = (err as { message?: string }).message || "";
      setError(kb10t(lang, message.includes("TooManyRequests") ? "kb10.rateError" : "kb10.sendError"));
    } finally {
      pendingRef.current = false;
      setIsLoading(false);
    }
  };
  const onReset = () => {
    setMagicLinkSent(false);
    setError("");
    focusResetRef.current = true;
  };
  const otherHref = (pathname: string): OtherHref =>
    nextPath ? { pathname, query: { next: nextPath } } : pathname;
  return <PageCard flow={flow} email={email} setEmail={setEmail} isLoading={isLoading} error={error} sent={magicLinkSent}
    onSubmit={handleSubmit} onReset={onReset} otherHref={otherHref(flow === "sign-up" ? "/sign-in" : "/sign-up")}
    variant={variant} lang={lang} onSwitch={onSwitch} onLanguageChange={setLang} inputRef={inputRef} headingRef={headingRef} />;
}

type GalleryState = "default" | "empty" | "pending" | "error" | "disabled" | "overflow" | "sent";
export function Kb10Gallery({ lang = "en" }: { lang?: Kb10Lang }) {
  const [currentLang, setCurrentLang] = useState<Kb10Lang>(lang);
  const [state, setState] = useState<GalleryState>("default");
  const [email, setEmail] = useState("maya@example.com");
  const [sentCount, setSentCount] = useState(0);
  const [switchCount, setSwitchCount] = useState(0);
  const states: [GalleryState, Kb10Key][] = [
    ["default", "kb10.defaultState"], ["empty", "kb10.emptyState"], ["pending", "kb10.pendingState"],
    ["error", "kb10.errorState"], ["disabled", "kb10.disabledState"], ["overflow", "kb10.overflowState"], ["sent", "kb10.sentState"],
  ];
  const changeState = (next: GalleryState) => {
    setState(next);
    setEmail(next === "empty" ? "" : next === "overflow" ? "maya.very.long.fictional.address.for.a.small.phone@example.test" : "maya@example.com");
  };
  return <main className="kb10-gallery" lang={currentLang} dir={currentLang === "he" ? "rtl" : "ltr"}>
    <h1>{kb10t(currentLang, "kb10.gallery")}</h1>
    <nav className="kb10-gallery__states" aria-label={kb10t(currentLang, "kb10.gallery")}>{states.map(([value, key]) =>
      <button key={value} type="button" aria-pressed={state === value} onClick={() => changeState(value)}>{kb10t(currentLang, key)}</button>)}</nav>
    <PageCard flow="sign-in" email={email} setEmail={setEmail} isLoading={state === "pending"} error={state === "error" ? kb10t(currentLang, "kb10.sendError") : ""}
      sent={state === "sent"} disabled={state === "disabled"} onSubmit={e => { e.preventDefault(); setSentCount(n => n + 1); changeState("sent"); }}
      onReset={() => changeState("default")} otherHref="/sign-up" variant="modal" lang={currentLang}
      onSwitch={() => setSwitchCount(n => n + 1)} onLanguageChange={setCurrentLang} />
    <output className="kb10-gallery__count">{sentCount} / {switchCount}</output>
  </main>;
}
