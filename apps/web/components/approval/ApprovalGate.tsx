"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { StateLoading } from "@/components/settings/states";
import { api } from "@/convex/_generated/api";
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
const E2E_BYPASS =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1";

export function ApprovalGate({ children }: { children: ReactNode }) {
  if (E2E_BYPASS) {
    return <>{children}</>;
  }
  return <ApprovalGateInner>{children}</ApprovalGateInner>;
}

function ApprovalGateInner({ children }: { children: ReactNode }) {
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

/**
 * Shown until the account's status arrives (about two seconds on a fresh sign-in, longer on a
 * slow connection). The AuthCard with the brand row and quiet skeleton rows, not an empty page
 * (HARD_RULES §7.4); screen readers hear "Opening Tempo…".
 */
function ApprovalLoading() {
  return (
    <main className="tp-auth" id="main" aria-busy="true" data-testid="approval-loading">
      <div className="tp-auth-card" data-component="AuthCard">
        <span className="tp-auth-card__brand">Tempo</span>
        <StateLoading label="approval.loading" rows={3} />
      </div>
    </main>
  );
}
