"use client";

import Link from "next/link";
import { useState } from "react";
import { type OnboardingGoalLang, translateOnboardingGoal } from "@/lib/i18n-groups/onboarding-goal";

export type OnboardingGoalDraft = { title: string; description: string };
export type OnboardingGoalStatus = "idle" | "saving" | "saved" | "error";

/** Controlled panel: the mounted flow owns the draft, saved identity and request lifetime. */
export function OnboardingGoal({ lang, draft, status, hasSavedGoal, unchanged, disabled = false, onChange, onSave }: {
  lang: OnboardingGoalLang;
  draft: OnboardingGoalDraft;
  status: OnboardingGoalStatus;
  hasSavedGoal: boolean;
  unchanged: boolean;
  disabled?: boolean;
  onChange: (draft: OnboardingGoalDraft) => void;
  onSave: () => void;
}) {
  const t = (key: Parameters<typeof translateOnboardingGoal>[1]) => translateOnboardingGoal(lang, key);
  const saving = status === "saving";
  const locked = disabled || saving;
  return <section className="tp-field" data-component="OnboardingGoal" aria-labelledby="ob-goal-heading" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
    <h2 className="tp-label" id="ob-goal-heading">{t("title")}</h2>
    <p className="tp-help" id="ob-goal-help">{t("help")}</p>
    <div className="tp-field">
      <label className="tp-label" htmlFor="ob-goal-title">{t("name")}</label>
      <input className="tp-input" id="ob-goal-title" name="goalTitle" type="text" dir="auto"
        value={draft.title} disabled={locked} maxLength={200} style={{ minBlockSize: "var(--tp-touch)" }}
        aria-describedby={status === "error" ? "ob-goal-help ob-goal-error" : "ob-goal-help"}
        onChange={(event) => onChange({ ...draft, title: event.target.value })} />
    </div>
    <div className="tp-field">
      <label className="tp-label" htmlFor="ob-goal-description">{t("description")}</label>
      <textarea className="tp-textarea" id="ob-goal-description" name="goalDescription" dir="auto" rows={2}
        value={draft.description} disabled={locked} maxLength={2000} style={{ minBlockSize: "var(--tp-touch)" }}
        onChange={(event) => onChange({ ...draft, description: event.target.value })} />
    </div>
    <button className="tp-btn tp-btn--secondary" type="button" disabled={locked || !draft.title.trim() || unchanged}
      style={{ minBlockSize: "var(--tp-touch)", minInlineSize: "var(--tp-touch)" }} onClick={onSave}>
      {t(saving ? "saving" : hasSavedGoal ? "update" : "add")}
    </button>
    {status === "saved" ? <output className="tp-help">{t("saved")}</output> : null}
    {status === "error" ? <p className="tp-error-text" role="alert" id="ob-goal-error">{t("error")}</p> : null}
    {hasSavedGoal || status === "error" ? <Link href="/goals" className="tp-btn tp-btn--ghost"
      style={{ minBlockSize: "var(--tp-touch)", minInlineSize: "var(--tp-touch)" }}>{t("open")}</Link> : null}
  </section>;
}

/** Fictional, local-only gallery of the exact controlled panel mounted in step four. */
export function OnboardingGoalGallery() {
  const [lang, setLang] = useState<OnboardingGoalLang>("en");
  const [draft, setDraft] = useState({ title: "Learn a short piano piece", description: "Practise a little on weekends." });
  const [saved, setSaved] = useState<OnboardingGoalDraft | null>(null);
  const [status, setStatus] = useState<OnboardingGoalStatus>("idle");
  return <main className="tp-auth" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
    <div className="tp-auth-card">
      <h1 className="tp-auth-card__title">{translateOnboardingGoal(lang, "gallery")}</h1>
      <fieldset className="tp-field"><legend className="tp-label">{translateOnboardingGoal(lang, "language")}</legend>
        <button className="tp-btn tp-btn--secondary" type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
        <button className="tp-btn tp-btn--secondary" type="button" aria-pressed={lang === "he"} onClick={() => setLang("he")}>עברית</button>
      </fieldset>
      <OnboardingGoal lang={lang} draft={draft} status={status} hasSavedGoal={saved !== null}
        unchanged={saved?.title === draft.title.trim() && saved?.description === draft.description.trim()}
        onChange={(next) => { setDraft(next); setStatus("idle"); }}
        onSave={() => { setSaved({ title: draft.title.trim(), description: draft.description.trim() }); setStatus("saved"); }} />
    </div>
  </main>;
}
