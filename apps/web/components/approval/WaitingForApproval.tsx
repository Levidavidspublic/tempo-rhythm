"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Calm full-screen notice for accounts that are not approved yet. */
export function WaitingForApproval({ email, revoked }: { email: string; revoked: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/sign-in");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
      data-testid="approval-waiting"
    >
      <section className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">
          {revoked ? "Your access is paused" : "Waiting for approval"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {revoked
            ? "Access for this account is paused for now. If you think this is a mistake, reply to your sign-in email."
            : "Thanks for signing up. Tempo is in a small beta, and Amit approves each new account by hand. You can close this page: once you're approved, just sign in again and everything opens up."}
        </p>
        <p className="text-xs text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
        <Button type="button" variant="outline" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </section>
    </main>
  );
}
