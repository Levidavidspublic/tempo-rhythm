"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";

/**
 * Calm full-screen notice for accounts that are not approved yet.
 * ApprovalGate reads the status through a live Convex query, so an approval that lands while this
 * page is open swaps in the app with no reload. The copy says so, and that no email is sent, so a
 * new person knows what happens next.
 */
export function WaitingForApproval({ email, revoked }: { email: string; revoked: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { t } = useLocale();
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
          {revoked ? t("approval.pausedTitle") : t("approval.waitingTitle")}
        </h1>
        {revoked ? (
          <p className="text-sm text-muted-foreground">{t("approval.paused")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("approval.waitingLede")}</p>
            <div className="space-y-2 text-start">
              <h2 className="text-sm font-semibold">{t("approval.nextTitle")}</h2>
              <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
                <li>{t("approval.next1")}</li>
                <li>{t("approval.next2")}</li>
                <li>{t("approval.next3")}</li>
              </ol>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {t("approval.signedInAs")}{" "}
          <span className="font-medium text-foreground" dir="ltr">
            {email}
          </span>
        </p>
        <Button type="button" variant="outline" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? t("approval.signingOut") : t("approval.signOut")}
        </Button>
      </section>
    </main>
  );
}
