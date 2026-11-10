"use client";

import Link from "next/link";
import { PRIVACY_URL, TERMS_URL } from "@/config/appConfig";
import { SignInForm } from "./SignInForm";

export type SignUpFormProps = {
  variant?: "page" | "modal";
  nextPath?: string;
  onSuccess?: () => void;
  onSwitchToSignIn?: () => void;
};

/**
 * Sign-up is the same magic-link flow as sign-in: the first link a new email
 * opens creates the account.
 */
export function SignUpForm({
  variant = "modal",
  nextPath,
  onSuccess,
  onSwitchToSignIn,
}: SignUpFormProps) {
  const isPage = variant === "page";
  return (
    <div className={isPage ? "tp-auth-stack" : ""}>
      <SignInForm
        variant={variant}
        nextPath={nextPath}
        flow="sign-up"
        onSuccess={onSuccess}
        onSwitch={onSwitchToSignIn}
      />
      <p
        className={isPage ? "tp-small tp-muted text-center" : "mt-4 text-center text-xs text-gray-400"}
      >
        By continuing you agree to the{" "}
        <Link href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
