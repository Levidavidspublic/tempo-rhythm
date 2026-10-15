"use client";

import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { PendingFieldsNote } from "./PendingFieldsNote";
import { validateFullName } from "./profileValidation";

type Status = "idle" | "saving" | "saved" | "error";

export function ProfileForm() {
  const profile = useQuery(api.users.getProfile, {});
  const updateProfile = useMutation(api.users.updateProfile);
  // null draft = show server value; avoids empty flash + overwrite of in-progress edits (Bugbot).
  const [draftName, setDraftName] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  if (profile === undefined) {
    return <p aria-live="polite">Loading your profile…</p>;
  }
  if (profile === null) {
    return <p>Sign in to see and edit your profile.</p>;
  }

  const fullName = draftName ?? profile.fullName ?? "";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateFullName(fullName);
    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }
    setStatus("saving");
    setMessage("Saving…");
    try {
      await updateProfile({ userId: profile._id, fullName: result.fullName });
      setDraftName(result.fullName ?? "");
      setStatus("saved");
      setMessage("Saved.");
    } catch {
      setStatus("error");
      setMessage("Could not save your name. Please try again.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="profile-email">Email</Label>
        <Input
          id="profile-email"
          value={profile.email ?? ""}
          readOnly
          disabled
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={fullName}
          onChange={(e) => {
            setDraftName(e.target.value);
            setStatus("idle");
            setMessage("");
          }}
        />
      </div>
      <Button type="submit" disabled={status === "saving"}>
        Save name
      </Button>
      <p aria-live="polite">{message}</p>
      <PendingFieldsNote />
    </form>
  );
}
