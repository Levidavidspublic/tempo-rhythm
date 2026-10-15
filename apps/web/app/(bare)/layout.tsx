import type { ReactNode } from "react";
import { ApprovalGate } from "@/components/approval/ApprovalGate";

/**
 * (bare) layout — no sidebar, no topbar. Used for screens that need
 * focus mode: auth, onboarding, template builder/run, trial-end.
 * Pending/revoked accounts see the approval waiting screen (TEMPO-GATE-02).
 */
export default function BareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ApprovalGate>{children}</ApprovalGate>
    </div>
  );
}
