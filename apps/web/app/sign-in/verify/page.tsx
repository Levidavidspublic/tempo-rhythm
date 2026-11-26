"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  clearPendingInsforgeOtp,
  finishInsforgeSignIn,
  getPendingInsforgeOtp,
  requestInsforgeCode,
} from "@/components/auth/SignInForm";
import { DATA_BACKEND } from "@/lib/backend-flag";

export default function VerifyPage() {
  if (DATA_BACKEND !== "insforge") redirect("/sign-in");

  return (
    <main className="tp-auth" id="main" dir="ltr" lang="en">
      <div className="tp-auth-card" data-component="AuthCard">
        <Link className="tp-auth-card__brand" href="/">
          Tempo
        </Link>
        <VerifyCode />
      </div>
    </main>
  );
}

function VerifyCode() {
  const [challenge] = useState(getPendingInsforgeOtp);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestedAgain, setRequestedAgain] = useState(false);

  if (!challenge) {
    return (
      <>
        <h1 className="tp-auth-card__title">Request a new code</h1>
        <p className="tp-auth-card__lede">Enter your email on the sign-in page to start again.</p>
        <Link className="tp-btn tp-btn--primary tp-btn--block" href="/sign-in">
          Back to sign in
        </Link>
      </>
    );
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || pending) return;
    setPending("verify");
    setError(null);
    setRequestedAgain(false);
    const failure = await finishInsforgeSignIn(challenge, code, (href) => {
      window.location.replace(href);
    });
    if (failure) {
      setError(failure);
      setPending(null);
    }
  }

  async function resend() {
    if (!challenge || pending) return;
    setPending("resend");
    setError(null);
    setRequestedAgain(false);
    const failure = await requestInsforgeCode(challenge.email);
    setError(failure);
    setRequestedAgain(!failure);
    if (!failure) setCode("");
    setPending(null);
  }

  return (
    <>
      <div>
        <h1 className="tp-auth-card__title">Enter your sign-in code</h1>
        <p className="tp-auth-card__lede">Check your email for a six-digit code.</p>
      </div>
      {error && (
        <p className="tp-notice" data-tone="danger" id="otp-error" role="alert">
          {error}
        </p>
      )}
      {requestedAgain && (
        <output className="tp-auth-card__lede">
          Another code was requested. Check your inbox and spam folder.
        </output>
      )}
      <form className="tp-form" onSubmit={verify}>
        <div className="tp-field">
          <label className="tp-label" htmlFor="otp-code">
            Sign-in code
          </label>
          <input
            className="tp-input"
            id="otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            pattern="[0-9]{6}"
            maxLength={6}
            required={true}
            disabled={pending !== null}
            aria-describedby={error ? "otp-error" : undefined}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        <button
          className="tp-btn tp-btn--primary tp-btn--block"
          type="submit"
          disabled={pending !== null}
        >
          {pending === "verify" ? "Checking code…" : "Verify code"}
        </button>
        <button
          className="tp-btn tp-btn--secondary tp-btn--block"
          type="button"
          disabled={pending !== null}
          onClick={resend}
        >
          {pending === "resend" ? "Requesting code…" : "Request a new code"}
        </button>
      </form>
      <p className="tp-auth-card__foot">
        <Link
          href={{ pathname: "/sign-in", query: { next: challenge.nextPath } }}
          className="font-semibold text-foreground underline underline-offset-2"
          onClick={clearPendingInsforgeOtp}
        >
          Use a different email
        </Link>
      </p>
    </>
  );
}
