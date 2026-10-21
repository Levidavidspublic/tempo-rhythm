import type { ReactNode } from "react";
import { ApprovalGate } from "@/components/approval/ApprovalGate";
import { TempoShell } from "@/components/tempo/TempoShell";

export default function TempoGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ApprovalGate>
      <TempoShell>{children}</TempoShell>
    </ApprovalGate>
  );
}
