"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";

import { passkeysView } from "./passkeys-view";

const PASSKEYS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PASSKEYS === "true";

export default function PasskeysSettingsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const view = passkeysView({ isLoading, isAuthenticated, passkeysEnabled: PASSKEYS_ENABLED });

  if (view === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
      </div>
    );
  }

  if (view === "signed-out") {
    // The server proxy already redirects signed-out visitors. Reaching here means
    // the client lost its session while the cookie is valid: offer a way back.
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-muted-foreground">We couldn&apos;t confirm your session.</p>
        <Link href="/sign-in?next=%2Fsettings%2Fpasskeys" className="mt-3 inline-block underline">
          Sign in again
        </Link>
      </div>
    );
  }

  if (view === "coming-soon") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-border bg-card px-8 py-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl">
            🔑
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Passkeys — coming soon
          </h1>
          <p className="mt-3 text-muted-foreground">
            Sign in without a password using your device biometrics. We&apos;re finishing up
            this feature and will let you know when it&apos;s ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
        Passkeys
      </h1>
      <p className="mt-2 text-muted-foreground">
        Use your device biometrics or PIN to sign in without a password.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold text-foreground">Your registered passkeys</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You have no passkeys registered yet.
        </p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            // TODO (T-0010 passkey phase): wire up @convex-dev/auth passkey registration
            alert("Passkey registration coming soon.");
          }}
        >
          Add a passkey
        </button>
      </div>
    </div>
  );
}
