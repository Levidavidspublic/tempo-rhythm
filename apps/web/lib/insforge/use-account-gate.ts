"use client";

import { useEffect, useState } from "react";
import { isInsforgeE2eMode } from "./e2e-mode";
import { getOwnerRowTransport } from "./owner-row-transport";
import type { InsforgeSession } from "./session";

type AccountGate = {
  status: "pending" | "approved" | "revoked";
  isAdmin: boolean;
  email: string;
};

type AccountGateResult = AccountGate | { status: "error" } | null;

type SignedIn = Extract<InsforgeSession, { status: "signedIn" }>;

const GATE_REFRESH_MS = 15_000;

export async function readAccountGate(
  session: SignedIn,
  getTransport: () => Pick<
    NonNullable<ReturnType<typeof getOwnerRowTransport>>,
    "select"
  > | null = getOwnerRowTransport
): Promise<AccountGateResult> {
  if (isInsforgeE2eMode()) return null;
  try {
    const transport = getTransport();
    if (!transport) return { status: "error" };
    const rows = await transport.select(
      { table: "account_gate", uid: session.uid },
      { select: "user_id,approval_status,role,email,is_active,deleted_at", filters: [] }
    );
    if (!Array.isArray(rows) || rows.length !== 1) return null;
    const row: unknown = rows[0];
    if (typeof row !== "object" || row === null) return null;
    const {
      user_id: uid,
      approval_status: status,
      role,
      email,
      is_active: active,
      deleted_at: deletedAt,
    } = row as Record<string, unknown>;
    if (uid !== session.uid || (active !== null && active !== true) || deletedAt !== null)
      return null;
    if (status !== "pending" && status !== "approved" && status !== "revoked") return null;
    return {
      status,
      isAdmin: role === "admin",
      email: typeof email === "string" ? email : session.email,
    };
  } catch {
    return { status: "error" };
  }
}

export function useAccountGate(session: InsforgeSession): AccountGateResult | undefined {
  const [snapshot, setSnapshot] = useState<{ session: SignedIn; gate: AccountGateResult }>();

  useEffect(() => {
    if (session.status !== "signedIn" || isInsforgeE2eMode()) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      const gate = await readAccountGate(session);
      if (stopped) return;
      setSnapshot({ session, gate });
      timer = setTimeout(() => void refresh(), GATE_REFRESH_MS);
    };
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session]);

  if (session.status === "signedOut" || isInsforgeE2eMode()) return null;
  return snapshot?.session === session ? snapshot.gate : undefined;
}
