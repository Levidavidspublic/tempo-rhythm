"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";

const CONFIRM_TEXT = "DELETE";

export function DeleteAccountCard() {
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const canDelete = typed === CONFIRM_TEXT && !pending;

  const onDelete = async () => {
    if (!canDelete) return;
    setPending(true);
    setError("");
    try {
      await deleteMyAccount({});
      await signOut();
      router.push("/sign-in");
    } catch {
      setPending(false);
      setError("Could not delete the account. You can try again.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Deleting your account removes your tasks, notes, habits, templates and settings, and ends
          your subscription. Signing in again later does not bring them back.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-account-confirm">Type DELETE to confirm</Label>
          <Input
            id="delete-account-confirm"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          disabled={!canDelete}
          onClick={() => void onDelete()}
        >
          {pending ? "Deleting…" : "Delete account"}
        </Button>
      </CardContent>
    </Card>
  );
}
