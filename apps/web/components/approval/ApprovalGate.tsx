"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import { DATA_BACKEND } from "@/lib/backend-flag";
import { useInsforgeSession } from "@/lib/insforge/session";
import { useAccountGate } from "@/lib/insforge/use-account-gate";
import { WaitingForApproval } from "./WaitingForApproval";

/**
 * Sign-up approval gate (TEMPO-GATE-02). A signed-in account that is still
 * `pending` (or was `revoked`) sees only the waiting screen. The server enforces
 * the same rule on every AI/chat function (convex/lib/approval.ts), so this is
 * the UX layer, not the security boundary.
 *
 * Local e2e bypass mode (no real Convex) passes straight through so CI specs
 * keep working.
 */
export function ApprovalGate({ children }: { children: ReactNode }) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1"
  ) {
    return <>{children}</>;
  }
  return DATA_BACKEND === "insforge" ? (
    <InsforgeApprovalGate>{children}</InsforgeApprovalGate>
  ) : (
    <ConvexApprovalGate>{children}</ConvexApprovalGate>
  );
}

function ConvexApprovalGate({ children }: { children: ReactNode }) {
  const me = useQuery(api.approval.myStatus);
  if (me === undefined) {
    // Loading: never mount protected children before the status is known.
    return <ApprovalLoading />;
  }
  if (me && me.status !== "approved") {
    return <WaitingForApproval email={me.email} revoked={me.status === "revoked"} />;
  }
  // null (signed out: the proxy redirects) or approved.
  return <>{children}</>;
}

function InsforgeApprovalGate({ children }: { children: ReactNode }) {
  const session = useInsforgeSession();
  const me = useAccountGate(session);
  if (session.status === "signedOut") return null;
  if (session.status === "loading" || me === undefined) return <ApprovalLoading />;
  if (me?.status === "error") return <ApprovalReadError />;
  if (me?.status === "approved") return <>{children}</>;
  return (
    <WaitingForApproval
      email={me?.email ?? session.email}
      revoked={me?.status !== "pending"}
      backend="insforge"
    />
  );
}

function ApprovalReadError() {
  const { t } = useLocale();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="tp-state tp-state--error" role="alert" data-component="StateError">
        {t("proposal.error")}
      </div>
    </main>
  );
}

/**
 * Shown until the account's status arrives (about two seconds on a fresh sign-in, longer on a
 * slow connection). A quiet skeleton with a label, not an empty page (HARD_RULES §7.4).
 */
function ApprovalLoading() {
  const { t } = useLocale();
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
      aria-busy="true"
      data-testid="approval-loading"
    >
      <output className="tp-state--loading block w-full max-w-md" data-component="StateLoading">
        <span className="tp-skel-list">
          <span className="tp-skeleton tp-skeleton--w60" />
          <span className="tp-skeleton tp-skeleton--w100" />
          <span className="tp-skeleton tp-skeleton--sm tp-skeleton--w80" />
        </span>
        <span className="mt-4 block text-center text-sm text-muted-foreground">
          {t("approval.loading")}
        </span>
      </output>
    </main>
  );
}
