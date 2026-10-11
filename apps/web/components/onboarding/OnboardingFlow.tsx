"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { NameStep } from "./NameStep";

export function OnboardingFlow() {
  const router = useRouter();
  const profile = useQuery(api.users.getProfile, {});
  const starters = useQuery(api.templates.list, { scope: "starter" });
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [step, setStep] = useState<"name" | "templates">("name");
  const [typed, setTyped] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const finishing = useRef(false);

  const alreadyOnboarded = Boolean(profile?.onboardedAt);

  useEffect(() => {
    if (alreadyOnboarded && !finishing.current) router.replace("/today");
  }, [alreadyOnboarded, router]);

  if (profile === undefined || alreadyOnboarded) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p aria-live="polite">Loading…</p>
      </main>
    );
  }

  const prefilled = profile && profile.greetingName !== "there" ? profile.greetingName : "";
  const name = typed ?? prefilled;

  const finish = async (withName: boolean) => {
    if (pending || finishing.current) return;
    setPending(true);
    setError("");
    finishing.current = true;
    const trimmed = name.trim();
    try {
      await completeOnboarding(withName && trimmed.length > 0 ? { fullName: trimmed } : {});
      router.push("/today");
    } catch {
      finishing.current = false;
      setError("Could not save that. You can try again.");
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {step === "name" ? (
        <NameStep
          name={name}
          onNameChange={setTyped}
          onNext={() => setStep("templates")}
          onSkip={() => void finish(false)}
          pending={pending}
        />
      ) : (
        <section className="flex flex-col gap-6" aria-label="Starter templates">
          <header className="flex flex-col gap-2">
            <p className="font-eyebrow text-muted-foreground">Step 2 of 2</p>
            <h1 className="font-heading text-4xl text-foreground">Starter templates</h1>
            <p className="text-muted-foreground">
              Tempo proposes one when a page is created. You can accept or reject it.
            </p>
          </header>
          {starters === undefined ? (
            <p aria-live="polite">Loading templates…</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {starters.map((template) => (
                <li key={template.templateId} className="text-foreground">
                  {template.name}
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-4">
            <Button type="button" onClick={() => void finish(true)} disabled={pending}>
              {pending ? "Saving…" : "Finish"}
            </Button>
            <button
              type="button"
              className="text-primary underline"
              disabled={pending}
              onClick={() => void finish(true)}
            >
              Skip
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
