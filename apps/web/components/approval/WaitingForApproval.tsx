"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { kb69t, type Kb69Lang } from "@/lib/i18n-groups/kb-69";
import "@/app/v3/kb-69.css";
import { WAITING_NAME_MAX, type WaitingNameProblem, checkWaitingName, prefillWaitingName } from "./waiting-name";

type NameFeedback =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" | "saved" | "error"; readonly revision: number }
  | { readonly kind: "invalid"; readonly revision: number; readonly problem: WaitingNameProblem };

/** The current gate's waiting or revoked explanation; it makes no approval decision. */
export function ApprovalStatus({ email, revoked, lang }: {
  readonly email: string;
  readonly revoked: boolean;
  readonly lang: Kb69Lang;
}) {
  return <div className="kb69-status" data-component="ApprovalStatus" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
    <h1>{kb69t(lang, revoked ? "revoked.title" : "waiting.title")}</h1>
    {revoked ? <p>{kb69t(lang, "revoked.body")}</p> : <>
      <p>{kb69t(lang, "waiting.lede")}</p>
      <h2>{kb69t(lang, "waiting.nextTitle")}</h2>
      <ol>
        <li>{kb69t(lang, "waiting.next1")}</li>
        <li>{kb69t(lang, "waiting.next2")}</li>
        <li>{kb69t(lang, "waiting.next3")}</li>
      </ol>
    </>}
    <p className="kb69-status__email">{kb69t(lang, "signedInAs")} <bdi dir="ltr">{email}</bdi></p>
  </div>;
}

/** Feedback is tied to the name revision that was submitted. */
export function WaitingNameFeedback({ feedback, currentRevision, lang, id = "waiting-name-feedback" }: {
  readonly feedback: NameFeedback;
  readonly currentRevision: number;
  readonly lang: Kb69Lang;
  readonly id?: string;
}) {
  const stale = feedback.kind !== "idle" && feedback.revision !== currentRevision;
  const kind = stale && feedback.kind === "saving" ? "saving-earlier" : stale ? "idle" : feedback.kind;
  const key = kind === "saving" ? "name.saving"
    : kind === "saving-earlier" ? "name.savingEarlier"
    : kind === "saved" ? "name.saved"
    : kind === "error" ? "name.error"
    : kind === "invalid" ? feedback.kind === "invalid" && feedback.problem === "tooLong" ? "name.tooLong" : "name.empty"
    : null;
  const message = key ? kb69t(lang, key, { max: String(WAITING_NAME_MAX) }) : "";
  const alert = kind === "error" || kind === "invalid";
  return <div className="kb69-feedback" data-component="WaitingNameFeedback" data-kind={kind} id={id}
    role={alert ? "alert" : "status"} aria-live={alert ? "assertive" : "polite"}>
    {message ? <>{kind === "saved" ? <TpIcon name="check" size="sm" /> : alert ? <TpIcon name="alert" size="sm" /> : null}<span>{message}</span></> : null}
  </div>;
}

/** ApprovalGate still owns the live approval query and swaps in the app on approval. */
export function WaitingForApproval({ email, revoked }: { email: string; revoked: boolean }) {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const { lang } = useLocale();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const signOutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (signOutError && !signingOut) signOutRef.current?.focus();
  }, [signOutError, signingOut]);

  async function onSignOut() {
    if (signingOut) return;
    setSignOutError(false);
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  }

  return <main className="kb69-screen" data-testid="approval-waiting" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
    <TpIconSprite />
    <section className="kb69-card">
      <ApprovalStatus email={email} revoked={revoked} lang={lang} />
      {revoked ? null : <WaitingName email={email} lang={lang} />}
      <div className="kb69-signout-wrap">
        {signOutError ? <p id="kb69-signout-error" className="kb69-signout-error" role="alert">{kb69t(lang, "signOutError")}</p> : null}
        <Button ref={signOutRef} type="button" variant="outline" className="kb69-signout" onClick={onSignOut}
          disabled={signingOut} aria-describedby={signOutError ? "kb69-signout-error" : undefined}>
          {kb69t(lang, signingOut ? "signingOut" : "signOut")}
        </Button>
      </div>
    </section>
  </main>;
}

/** Optional name edit retains newer typing when an earlier save completes. */
function WaitingName({ email, lang }: { readonly email: string; readonly lang: Kb69Lang }) {
  const profile = useQuery(api.users.getProfile, {});
  const updateMyProfile = useMutation(api.users.updateMyProfile);
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<NameFeedback>({ kind: "idle" });
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const revision = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const value = draft ?? prefillWaitingName(profile?.fullName, profile?.email ?? email);
  const invalid = feedback.kind === "invalid" && feedback.revision === revision.current
    || feedback.kind === "error" && feedback.revision === revision.current;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const check = checkWaitingName(value);
    if (!check.ok) {
      setFeedback({ kind: "invalid", revision: revision.current, problem: check.problem });
      inputRef.current?.focus();
      return;
    }
    const submittedRevision = revision.current;
    busy.current = true;
    setSaving(true);
    setFeedback({ kind: "saving", revision: submittedRevision });
    try {
      await updateMyProfile({ fullName: check.name });
      if (revision.current === submittedRevision) {
        setDraft(check.name);
        setFeedback({ kind: "saved", revision: submittedRevision });
      } else setFeedback({ kind: "idle" });
    } catch {
      if (revision.current === submittedRevision) {
        setFeedback({ kind: "error", revision: submittedRevision });
        inputRef.current?.focus();
      } else setFeedback({ kind: "idle" });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return <form className="kb69-name" noValidate onSubmit={onSubmit} data-component="Field" data-testid="approval-name">
    <label className="tp-label" htmlFor="waiting-name">{kb69t(lang, "name.label")} <span className="tp-label__opt">{kb69t(lang, "name.optional")}</span></label>
    <p className="tp-help" id="waiting-name-help">{kb69t(lang, "name.help")}</p>
    <div className="kb69-name__row">
      <input ref={inputRef} className="tp-input" id="waiting-name" name="name" type="text" autoComplete="given-name" dir="auto"
        value={value} aria-invalid={invalid || undefined} aria-describedby="waiting-name-help waiting-name-feedback"
        onChange={event => {
          revision.current += 1;
          setDraft(event.target.value);
          setFeedback(current => current.kind === "saving" ? current : { kind: "idle" });
        }} />
      <button type="submit" className="tp-btn tp-btn--secondary" disabled={saving}>
        {kb69t(lang, saving ? "name.saving" : "name.save")}
      </button>
    </div>
    <WaitingNameFeedback feedback={feedback} currentRevision={revision.current} lang={lang} />
  </form>;
}

type GalleryState = "default" | "revoked" | "pending" | "saved" | "nameError" | "signOutError" | "disabled" | "overflow";
/** Fictional display controls; mounted behavior is verified separately through WaitingForApproval. */
export function Kb69Gallery() {
  const [lang, setLang] = useState<Kb69Lang>("en");
  const [state, setState] = useState<GalleryState>("default");
  const [retry, setRetry] = useState(false);
  const states: readonly GalleryState[] = ["default", "revoked", "pending", "saved", "nameError", "signOutError", "disabled", "overflow"];
  const feedback: NameFeedback = state === "pending" ? { kind: "saving", revision: 0 }
    : state === "saved" ? { kind: "saved", revision: 0 }
    : state === "nameError" ? { kind: "error", revision: 0 }
    : { kind: "idle" };
  const email = state === "overflow" ? "maya.a.very.long.fictional.address.for.a.narrow.phone@example.test" : "maya@example.com";
  return <main className="kb69-gallery" lang={lang} dir={lang === "he" ? "rtl" : "ltr"} data-component="Kb69Gallery">
    <TpIconSprite />
    <div className="kb69-gallery__controls" role="group" aria-label={kb69t(lang, "gallery.title")}>
      <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
      <button type="button" lang="he" aria-pressed={lang === "he"} onClick={() => setLang("he")}>עברית</button>
      {states.map(next => <button key={next} type="button" aria-pressed={state === next} onClick={() => { setState(next); setRetry(false); }}>
        {kb69t(lang, `gallery.${next}`)}
      </button>)}
    </div>
    <section className="kb69-card kb69-gallery__sample">
      <ApprovalStatus email={email} revoked={state === "revoked"} lang={lang} />
      {state === "revoked" ? null : <WaitingNameFeedback id="kb69-gallery-feedback" feedback={feedback} currentRevision={0} lang={lang} />}
      {state === "signOutError" ? <p className="kb69-signout-error" role="alert">{kb69t(lang, "signOutError")}</p> : null}
      {state === "signOutError" ? <button type="button" className="tp-btn tp-btn--secondary" onClick={() => setRetry(true)}>{kb69t(lang, "gallery.retry")}</button> : null}
      {state === "disabled" ? <button type="button" className="tp-btn tp-btn--secondary" disabled>{kb69t(lang, "signOut")}</button> : null}
      {retry ? <output>{kb69t(lang, "gallery.retryDone")}</output> : null}
    </section>
  </main>;
}
