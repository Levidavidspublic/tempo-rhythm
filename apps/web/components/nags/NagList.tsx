"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { acceptedPhrases, canEnable, enableHint, validateLabel } from "./nagRules";

const FALLBACK_ERROR = "That didn't save. Try again?";
const NEEDS_PHRASE = "Add a phrase you accept first.";

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  return raw.includes(NEEDS_PHRASE) ? NEEDS_PHRASE : FALLBACK_ERROR;
}

function countCopy(n: number): string {
  return n === 1 ? "1 phrase accepted" : `${n} phrases accepted`;
}

export function NagList({ onSelect }: { onSelect?: (nagId: Id<"nags">) => void }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const nags = useQuery(api.nags.list, isAuthenticated ? {} : "skip");
  const create = useMutation(api.nags.create);
  const setEnabled = useMutation(api.nags.setEnabled);
  const remove = useMutation(api.nags.remove);

  const [label, setLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmId, setConfirmId] = useState<Id<"nags"> | null>(null);
  const [busyId, setBusyId] = useState<Id<"nags"> | null>(null);
  const [rowError, setRowError] = useState<{ id: Id<"nags">; text: string } | null>(null);

  if (authLoading || (isAuthenticated && nags === undefined)) {
    return (
      <section aria-busy="true" aria-labelledby="nag-list-heading" className="max-w-xl">
        <h2 id="nag-list-heading" className="font-heading text-xl font-semibold text-foreground">
          Nags
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Loading your nags.</p>
      </section>
    );
  }
  if (!isAuthenticated || nags === undefined) return null;

  const onCreate = async () => {
    if (creating) return;
    const result = validateLabel(label);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      await create({ label: result.label });
      setLabel("");
    } catch {
      setFormError(FALLBACK_ERROR);
    } finally {
      setCreating(false);
    }
  };

  const onToggle = async (id: Id<"nags">, enabled: boolean) => {
    if (busyId) return;
    setBusyId(id);
    setRowError(null);
    try {
      await setEnabled({ nagId: id, enabled });
    } catch (error) {
      setRowError({ id, text: errorText(error) });
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (id: Id<"nags">) => {
    if (busyId) return;
    setBusyId(id);
    setRowError(null);
    try {
      await remove({ nagId: id });
      setConfirmId(null);
    } catch {
      setRowError({ id, text: FALLBACK_ERROR });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="nag-list-heading" className="max-w-xl space-y-6">
      <h2 id="nag-list-heading" className="font-heading text-xl font-semibold text-foreground">
        Nags
      </h2>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreate();
        }}
      >
        <Label htmlFor="nag-new-label">Name a nag</Label>
        <div className="flex gap-2">
          <Input
            id="nag-new-label"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              setFormError(null);
            }}
            aria-invalid={formError ? true : undefined}
            aria-describedby={formError ? "nag-new-error" : undefined}
          />
          <Button type="submit" disabled={creating}>
            Add nag
          </Button>
        </div>
        {formError ? (
          <p id="nag-new-error" role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}
      </form>

      {nags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No nags yet. Name one to start; the words will be yours.
        </p>
      ) : (
        <ul className="space-y-3">
          {nags.map((nag) => {
            const allowed = canEnable(nag);
            const hint = enableHint(nag);
            const hintId = `nag-hint-${nag._id}`;
            const busy = busyId === nag._id;
            return (
              <li key={nag._id}>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{nag.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {countCopy(acceptedPhrases(nag).length)}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={nag.enabled}
                        aria-label={`${nag.label} on`}
                        aria-describedby={hint ? hintId : undefined}
                        disabled={busy || (!allowed && !nag.enabled)}
                        onClick={() => void onToggle(nag._id, !nag.enabled)}
                        className={cn(
                          "relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          nag.enabled ? "bg-primary" : "bg-muted",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background transition-transform",
                            nag.enabled && "translate-x-5",
                          )}
                        />
                      </button>
                    </div>
                    {hint ? (
                      <p id={hintId} className="text-sm text-muted-foreground">
                        {hint}
                      </p>
                    ) : null}
                    {rowError?.id === nag._id ? (
                      <p role="alert" className="text-sm text-destructive">
                        {rowError.text}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      {onSelect ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onSelect(nag._id)}
                        >
                          Edit phrases
                        </Button>
                      ) : null}
                      {confirmId === nag._id ? (
                        <>
                          <p className="text-sm text-foreground">Delete this nag?</p>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onRemove(nag._id)}
                          >
                            Yes, delete
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmId(null)}
                          >
                            Keep it
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmId(nag._id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
