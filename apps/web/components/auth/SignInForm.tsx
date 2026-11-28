"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { requestInsforgeOtp, verifyInsforgeOtp } from "@/app/sign-in/insforge-actions";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
import { DATA_BACKEND } from "@/lib/backend-flag";
import { normalizeSignInEmail } from "@/lib/email-link-sign-in";

export type SignInFormProps = {
  /** Page layout uses Soft Editorial; modal keeps compact dark styling */
  variant?: "page" | "modal";
  nextPath?: string;
  /** "sign-up" only changes the copy; both flows use the same auth method. */
  flow?: "sign-in" | "sign-up";
  onSuccess?: () => void;
  onSwitch?: () => void;
};

type PendingInsforgeOtp = Readonly<{ email: string; nextPath: string }>;

let pendingInsforgeOtp: PendingInsforgeOtp | null = null;
let latestInsforgeSignInAttempt = 0;
let isVerifyingInsforgeOtp = false;
const OTP_VERIFY_IN_PROGRESS = "Wait for the current code check to finish.";

export function getPostAuthDestination(nextPath: string | null | undefined): string {
  const path = nextPath?.trim();
  if (!path?.startsWith("/") || path.startsWith("//") || /[\s\\]/u.test(path)) return "/today";

  try {
    const origin = "https://tempo.invalid";
    const url = new URL(path, origin);
    const pathname = decodeURIComponent(url.pathname);
    if (
      url.origin !== origin ||
      pathname.startsWith("//") ||
      /[\\\p{Cc}]/u.test(pathname) ||
      /%(?:2f|5c)/i.test(url.pathname) ||
      /^\/(?:dashboard|sign-in|sign-up)(?:\/|$)/i.test(pathname)
    ) {
      return "/today";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/today";
  }
}

export function getPendingInsforgeOtp(): PendingInsforgeOtp | null {
  return pendingInsforgeOtp;
}

export function clearPendingInsforgeOtp(): boolean {
  if (isVerifyingInsforgeOtp) return false;
  latestInsforgeSignInAttempt += 1;
  pendingInsforgeOtp = null;
  return true;
}

export async function requestInsforgeCode(email: string): Promise<string | null> {
  let status: Awaited<ReturnType<typeof requestInsforgeOtp>>["status"];
  try {
    ({ status } = await requestInsforgeOtp(email));
  } catch {
    status = "unavailable";
  }
  if (status === "requested") return null;
  if (status === "invalid-email") return "Enter a valid email address.";
  return "We couldn't request a code right now. Try again in a moment.";
}

export async function startInsforgeSignIn(
  rawEmail: string,
  nextPath: string | undefined,
  navigate: (href: string) => void
): Promise<string | null> {
  if (!clearPendingInsforgeOtp()) return OTP_VERIFY_IN_PROGRESS;
  const attempt = latestInsforgeSignInAttempt;
  const email = normalizeSignInEmail(rawEmail);
  if (!email) return "Enter a valid email address.";

  const error = await requestInsforgeCode(email);
  if (attempt !== latestInsforgeSignInAttempt) return "Request a new code to continue.";
  if (error) return error;

  const destination = getPostAuthDestination(nextPath);
  pendingInsforgeOtp = { email, nextPath: destination };
  navigate(`/sign-in/verify?${new URLSearchParams({ next: destination })}`);
  return null;
}

export async function finishInsforgeSignIn(
  challenge: PendingInsforgeOtp,
  code: string,
  navigate: (href: string) => void
): Promise<string | null> {
  if (challenge !== pendingInsforgeOtp) return "Request a new code to continue.";
  if (isVerifyingInsforgeOtp) return OTP_VERIFY_IN_PROGRESS;

  isVerifyingInsforgeOtp = true;
  let status: Awaited<ReturnType<typeof verifyInsforgeOtp>>["status"];
  try {
    ({ status } = await verifyInsforgeOtp(challenge.email, code));
  } catch {
    status = "unavailable";
  } finally {
    isVerifyingInsforgeOtp = false;
  }

  if (status === "invalid-code") return "That code didn't work. Try again or request a new one.";
  if (status === "invalid-email") return "Request a new code to continue.";
  if (status === "unavailable")
    return "We couldn't verify your code right now. Try again in a moment.";

  clearPendingInsforgeOtp();
  navigate(challenge.nextPath);
  return null;
}

export async function sendConvexMagicLink(
  signIn: ReturnType<typeof useAuthActions>["signIn"],
  email: string,
  nextPath?: string
): Promise<null> {
  await signIn("resend", { email, ...(nextPath ? { redirectTo: nextPath } : {}) });
  return null;
}

export function SignInForm(props: SignInFormProps) {
  return DATA_BACKEND === "insforge" ? (
    <InsforgeSignInForm {...props} />
  ) : (
    <ConvexSignInForm {...props} />
  );
}

function InsforgeSignInForm({ nextPath, ...props }: SignInFormProps) {
  const router = useRouter();
  return (
    <EmailSignInForm
      {...props}
      nextPath={getPostAuthDestination(nextPath)}
      otp={true}
      requestEmail={(email) => startInsforgeSignIn(email, nextPath, (href) => router.push(href))}
    />
  );
}

function ConvexSignInForm({ nextPath, ...props }: SignInFormProps) {
  const { signIn } = useAuthActions();
  return (
    <EmailSignInForm
      {...props}
      nextPath={nextPath}
      requestEmail={(email) => sendConvexMagicLink(signIn, email, nextPath)}
    />
  );
}

type EmailSignInFormProps = SignInFormProps & {
  otp?: boolean;
  requestEmail: (email: string) => Promise<string | null>;
};

function EmailSignInForm({
  variant = "modal",
  nextPath,
  flow = "sign-in",
  onSuccess,
  onSwitch,
  otp = false,
  requestEmail,
}: EmailSignInFormProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const fieldId = `${flow}-email`;

  const isSignUp = flow === "sign-up";
  const submitLabel = otp ? "Request sign-in code" : "Send magic link";
  const pendingLabel = otp ? "Requesting code…" : "Sending link…";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const requestError = await requestEmail(email);
      if (requestError) {
        setError(requestError);
        return;
      }
      if (!otp) setMagicLinkSent(true);
      onSuccess?.();
    } catch (err: unknown) {
      const message = (err as { message?: string } | null)?.message || "";
      if (otp) {
        setError("We couldn't continue sign-in right now. Try again in a moment.");
      } else if (message.includes("TooManyRequests")) {
        setError("You've tried a few times. Please pause for a moment and try again.");
      } else {
        setError("We couldn't send the link yet. Please check your email and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const otherHref = (pathname: string) =>
    nextPath ? { pathname, query: { next: nextPath } } : pathname;

  if (variant === "page") {
    return (
      <PageCard
        flow={flow}
        fieldId={fieldId}
        email={email}
        setEmail={setEmail}
        isLoading={isLoading}
        error={error}
        sent={magicLinkSent}
        otp={otp}
        submitText={isLoading ? pendingLabel : submitLabel}
        onSubmit={handleSubmit}
        onReset={() => {
          setMagicLinkSent(false);
          setError("");
        }}
        otherHref={otherHref(isSignUp ? "/sign-in" : "/sign-up")}
      />
    );
  }

  if (magicLinkSent) {
    return (
      <div className="text-center">
        <p className="mb-6 text-gray-400">
          We sent a sign-in link to <strong>{email}</strong>. Open it on any device to continue.
        </p>
        <button
          type="button"
          onClick={() => {
            setMagicLinkSent(false);
            setError("");
          }}
          className="text-sm text-orange-500 hover:text-orange-400 transition"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor={fieldId} className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            id={fieldId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
            placeholder="you@example.com"
            required={true}
            disabled={isLoading}
            autoComplete="email"
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />
        </div>

        {error && (
          <div
            id={`${fieldId}-error`}
            className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-linear-to-r from-orange-500 to-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {pendingLabel}
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-orange-500 transition hover:text-orange-400"
        >
          {isSignUp ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}

type PageCardProps = {
  flow: "sign-in" | "sign-up";
  fieldId: string;
  email: string;
  setEmail: (email: string) => void;
  isLoading: boolean;
  error: string;
  sent: boolean;
  otp: boolean;
  submitText: string;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  otherHref: string | { pathname: string; query: { next: string } };
};

/**
 * The v3 auth card (docs/design/v3/screens/web/sign-in.html, sign-up.html): one field, one
 * primary action, no password anywhere.
 */
function PageCard({
  flow,
  fieldId,
  email,
  setEmail,
  isLoading,
  error,
  sent,
  otp,
  submitText,
  onSubmit,
  onReset,
  otherHref,
}: PageCardProps) {
  const isSignUp = flow === "sign-up";
  let description = "No password. We'll email you a link that signs you in.";
  if (otp) {
    description = "No password. Request a six-digit code to continue.";
  } else if (isSignUp) {
    description =
      "No password. We'll email you a link that makes your account, and Amit approves it by hand.";
  }
  return (
    <div className="tp-auth-card" data-component="AuthCard">
      {/* Outside the app shell, so the page brings the icon sprite itself. */}
      <TpIconSprite />
      <Link className="tp-auth-card__brand" href="/">
        Tempo
      </Link>
      {sent ? (
        <>
          <div>
            <h1 className="tp-auth-card__title">Check your email</h1>
            <p className="tp-auth-card__lede">
              We sent a sign-in link to <strong>{email}</strong>. Open it on any device to continue.
            </p>
            {isSignUp ? (
              <p className="tp-auth-card__lede">
                The first time, the link opens a short &ldquo;waiting for approval&rdquo; page: Amit
                approves each new account by hand.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="tp-btn tp-btn--secondary tp-btn--block"
            onClick={onReset}
          >
            Use a different email
          </button>
        </>
      ) : (
        <>
          <div>
            <h1 className="tp-auth-card__title">{isSignUp ? "Create your account" : "Sign in"}</h1>
            <p className="tp-auth-card__lede">{description}</p>
          </div>
          {error ? (
            <div id={`${fieldId}-error`} className="tp-notice" data-tone="danger" role="alert">
              <span className="tp-notice__icon">
                <TpIcon name="alert" size="sm" />
              </span>
              <span className="tp-notice__text">{error}</span>
            </div>
          ) : null}
          <form className="tp-form" onSubmit={onSubmit}>
            <div className="tp-field">
              <label className="tp-label" htmlFor={fieldId}>
                Email
              </label>
              <input
                className="tp-input"
                id={fieldId}
                type="email"
                inputMode="email"
                dir="ltr"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required={true}
                disabled={isLoading}
                autoComplete="email"
                aria-describedby={error ? `${fieldId}-error` : undefined}
              />
            </div>
            <button
              type="submit"
              className="tp-btn tp-btn--primary tp-btn--block"
              disabled={isLoading}
            >
              <TpIcon name="mail" size="sm" />
              <span>{submitText}</span>
            </button>
          </form>
          <p className="tp-auth-card__foot">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <Link
              href={otherHref}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
