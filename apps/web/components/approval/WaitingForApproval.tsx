"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  WAITING_NAME_HINT,
  WAITING_NAME_MAX,
  type WaitingNameProblem,
  checkWaitingName,
  prefillWaitingName,
} from "./waiting-name";

/**
 * Calm full-screen notice for accounts that are not approved yet.
 * ApprovalGate reads the status through a live Convex query, so an approval that lands while this
 * page is open swaps in the app with no reload. The copy says so, and that no email is sent, so a
 * new person knows what happens next. While waiting, the person may say what Tempo should call
 * them (TEMPO-B07-14), so Today greets that name instead of the email handle.
 */
export function WaitingForApproval({ email, revoked }: { email: string; revoked: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { t } = useLocale();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/sign-in");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
      data-testid="approval-waiting"
    >
      <TpIconSprite />
      <section className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">
          {revoked ? t("approval.pausedTitle") : t("approval.waitingTitle")}
        </h1>
        {revoked ? (
          <p className="text-sm text-muted-foreground">{t("approval.paused")}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("approval.waitingLede")}</p>
            <div className="space-y-2 text-start">
              <h2 className="text-sm font-semibold">{t("approval.nextTitle")}</h2>
              <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
                <li>{t("approval.next1")}</li>
                <li>{t("approval.next2")}</li>
                <li>{t("approval.next3")}</li>
              </ol>
            </div>
            <WaitingName email={email} />
          </>
        )}
        <p className="text-xs text-muted-foreground">
          {t("approval.signedInAs")}{" "}
          <span className="font-medium text-foreground" dir="ltr">
            {email}
          </span>
        </p>
        <Button type="button" variant="outline" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? t("approval.signingOut") : t("approval.signOut")}
        </Button>
      </section>
    </main>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Optional name field. It never holds the screen back: it renders at once, fills in the saved name
 * when the profile arrives (unless the person already typed), and a failed save only shows a line.
 * `users.updateMyProfile` checks sign-in only, not approval, so a waiting account may call it.
 */
function WaitingName({ email }: { email: string }) {
  const { t } = useLocale();
  const profile = useQuery(api.users.getProfile, {});
  const updateMyProfile = useMutation(api.users.updateMyProfile);
  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<WaitingNameProblem | null>(null);
  const [state, setState] = useState<SaveState>("idle");
  const busy = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const value = draft ?? prefillWaitingName(profile?.fullName, profile?.email ?? email);
  const saving = state === "saving";
  const describedBy = problem ? "waiting-name-help waiting-name-hint" : "waiting-name-help";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const check = checkWaitingName(value);
    if (!check.ok) {
      setProblem(check.problem);
      setState("idle");
      inputRef.current?.focus();
      return;
    }
    busy.current = true;
    setProblem(null);
    setState("saving");
    try {
      await updateMyProfile({ fullName: check.name });
      setDraft(check.name);
      setState("saved");
    } catch {
      setState("error");
    } finally {
      busy.current = false;
    }
  };

  return (
    <form
      className="tp-field border-t border-border pt-4 text-start"
      noValidate
      onSubmit={onSubmit}
      data-component="Field"
      data-testid="approval-name"
    >
      <label className="tp-label" htmlFor="waiting-name">
        <span>{t("approval.nameLabel")}</span> <span className="tp-label__opt">{t("approval.nameOptional")}</span>
      </label>
      <p className="tp-help" id="waiting-name-help">
        {t("approval.nameHelp")}
      </p>
      <div className="flex items-start gap-2">
        <input
          ref={inputRef}
          className="tp-input min-w-0 flex-1"
          id="waiting-name"
          name="name"
          type="text"
          autoComplete="given-name"
          dir="auto"
          value={value}
          aria-invalid={problem ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            setDraft(event.target.value);
            setProblem(null);
            if (state !== "saving") setState("idle");
          }}
        />
        <button type="submit" className="tp-btn tp-btn--secondary" aria-disabled={saving ? true : undefined}>
          {saving ? t("approval.nameSaving") : t("approval.nameSave")}
        </button>
      </div>
      {problem ? (
        <p className="tp-error-text" id="waiting-name-hint" role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{t(WAITING_NAME_HINT[problem]).replace("{max}", String(WAITING_NAME_MAX))}</span>
        </p>
      ) : null}
      {state === "error" ? (
        <p className="tp-error-text" role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{t("approval.nameError")}</span>
        </p>
      ) : null}
      <output className="tp-help flex items-center gap-1">
        {state === "saved" ? (
          <>
            <TpIcon name="check" size="sm" />
            <span>{t("approval.nameSaved")}</span>
          </>
        ) : null}
      </output>
    </form>
  );
}
