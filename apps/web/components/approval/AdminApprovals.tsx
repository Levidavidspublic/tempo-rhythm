"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Status = "pending" | "approved" | "revoked";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  revoked: "Revoked",
};

/** /admin/approvals — approve or revoke accounts. Admin-only (enforced server-side too). */
export function AdminApprovals() {
  const me = useQuery(api.approval.myStatus);
  const rows = useQuery(api.approval.listForAdmin, me?.isAdmin ? {} : "skip");
  const setStatus = useMutation(api.approval.setStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (me === undefined) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }
  if (!me?.isAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground">This page is for the Tempo admin.</p>
      </div>
    );
  }

  async function change(userId: Id<"users">, status: Status) {
    setBusy(userId);
    setError(null);
    try {
      await setStatus({ userId, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Try again?");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = rows?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6" data-testid="admin-approvals">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Account approvals</h1>
        <p className="text-sm text-muted-foreground">
          {rows === undefined ? "Loading accounts…" : `${pendingCount} waiting for approval.`}
        </p>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(rows ?? []).map((row) => (
          <li key={row._id} className="flex flex-wrap items-center gap-3 p-3" data-status={row.status}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.email}</p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABEL[row.status]}
                {row.isAdmin ? " · admin" : ""} · joined {new Date(row.createdAt).toLocaleDateString()}
              </p>
            </div>
            {row.isAdmin ? null : (
              <div className="flex gap-2">
                {row.status !== "approved" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy === row._id}
                    onClick={() => change(row._id, "approved")}
                  >
                    Approve
                  </Button>
                ) : null}
                {row.status !== "revoked" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === row._id}
                    onClick={() => change(row._id, "revoked")}
                  >
                    Revoke
                  </Button>
                ) : null}
                {row.status === "revoked" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy === row._id}
                    onClick={() => change(row._id, "pending")}
                  >
                    Back to pending
                  </Button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
