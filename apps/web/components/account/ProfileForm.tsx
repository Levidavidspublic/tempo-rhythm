"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { StateLoading, Toast } from "@/components/settings/states";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Lang } from "@/lib/i18n";
import { type ProfileError, profileErrors } from "@/lib/settings/profile";

/**
 * Settings · Profile (docs/design/v3/screens/web/settings-profile.html): "About you" (full name,
 * email, language) saved with one button, and "Signing in" with Sign out.
 * Data: users.getProfile; saves with users.updateMyProfile and, for a new language,
 * preferences.update({ locale }) plus the shell's own language switch.
 * Not built (no backend field): "What should Tempo call you?", the Hebrew address choice and
 * changing the email, so the email shows read-only with a line that says so.
 */
export function ProfileForm() {
  const { t, lang, setLang } = useLocale();
  const profile = useQuery(api.users.getProfile, {});
  const updateMyProfile = useMutation(api.users.updateMyProfile);
  const updatePreferences = useMutation(api.preferences.update);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftLang, setDraftLang] = useState<Lang | null>(null);
  const [errors, setErrors] = useState<ProfileError[]>([]);
  const [summaryTick, setSummaryTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  // The summary takes focus after a Save that found problems.
  useEffect(() => {
    if (summaryTick > 0) summaryRef.current?.focus();
  }, [summaryTick]);

  if (!profile) {
    return <StateLoading label="set.profile.loading" className="sp-state" />;
  }

  const fullName = draftName ?? profile.fullName ?? "";
  const chosenLang = draftLang ?? lang;
  const nameError = errors.some((error) => error.field === "profile-name");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const found = profileErrors({ fullName });
    setErrors(found);
    if (found.length > 0) {
      setSaved(false);
      setSummaryTick((n) => n + 1);
      return;
    }
    setSaving(true);
    setSaveError(false);
    try {
      const trimmed = fullName.trim();
      await updateMyProfile({ fullName: trimmed });
      if (chosenLang !== lang) {
        // Switch the screen only once the account has the new language, so a failed save is
        // still a change on the next Save.
        await updatePreferences({ locale: chosenLang });
        setLang(chosenLang);
      }
      setDraftName(trimmed);
      setDraftLang(null);
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setDraftName(null);
    setDraftLang(null);
    setErrors([]);
    setSaveError(false);
  };

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      await signOut();
      router.replace("/sign-in");
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  };

  return (
    <>
      <section className="tp-settings-section" aria-labelledby="about-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="about-title">
            {t("set.profile.about")}
          </h2>
          <p className="tp-settings-section__desc">{t("set.profile.aboutDesc")}</p>
        </div>

        <form className="tp-form sp-form" noValidate onSubmit={onSubmit} onReset={onReset} data-component="Form">
          {errors.length > 0 ? (
            <div
              className="tp-error-summary"
              role="alert"
              tabIndex={-1}
              ref={summaryRef}
              data-component="FormErrorSummary"
            >
              <h3 className="tp-error-summary__title">
                <TpIcon name="alert" size="sm" />
                <span>{t(errors.length === 1 ? "set.profile.errOne" : "set.profile.errMany")}</span>
              </h3>
              <ul>
                {errors.map((error) => (
                  <li key={error.field}>
                    <a
                      href={`#${error.field}`}
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(error.field)?.focus();
                      }}
                    >
                      {t(error.message)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="tp-field od-field" data-component="Field">
            <label className="tp-label" htmlFor="profile-name">
              {t("set.profile.name")}
            </label>
            <input
              className="tp-input"
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              dir="auto"
              value={fullName}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "profile-name-error" : undefined}
              onChange={(event) => {
                setDraftName(event.target.value);
                setSaved(false);
                setSaveError(false);
              }}
            />
            {nameError ? (
              <p className="tp-error-text" id="profile-name-error">
                <TpIcon name="alert" size="sm" />
                <span>{t("set.profile.nameErr")}</span>
              </p>
            ) : null}
          </div>

          <div className="tp-field od-field" data-component="EmailField">
            <label className="tp-label" htmlFor="profile-email">
              {t("set.profile.email")}
            </label>
            <input
              className="tp-input"
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              value={profile.email ?? ""}
              readOnly
              aria-describedby="profile-email-help"
            />
            <p className="tp-help" id="profile-email-help">
              {t("set.profile.emailHelp")}
            </p>
          </div>

          <div className="tp-field od-field" data-component="Select">
            <label className="tp-label" htmlFor="profile-lang">
              {t("set.profile.lang")}
            </label>
            <div className="tp-select">
              <select
                className="tp-select__input"
                id="profile-lang"
                name="lang"
                aria-describedby="profile-lang-help"
                value={chosenLang}
                onChange={(event) => {
                  setDraftLang(event.target.value === "he" ? "he" : "en");
                  setSaved(false);
                }}
              >
                <option value="en" lang="en">
                  English
                </option>
                <option value="he" lang="he">
                  עברית
                </option>
              </select>
              <TpIcon name="down" size="sm" className="tp-select__icon" />
            </div>
            <p className="tp-help" id="profile-lang-help">
              {t("set.profile.langHelp")}
            </p>
          </div>

          {saveError ? (
            <p className="tp-error-text" role="alert">
              <TpIcon name="alert" size="sm" />
              <span>{t("set.profile.saveError")}</span>
            </p>
          ) : null}

          <div className="tp-form__actions">
            <button className="tp-btn tp-btn--primary" type="submit" disabled={saving} aria-busy={saving || undefined}>
              <span>{saving ? t("set.saving") : t("set.profile.save")}</span>
            </button>
            <button className="tp-btn tp-btn--ghost" type="reset">
              <span>{t("set.profile.reset")}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="tp-settings-section" aria-labelledby="sign-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="sign-title">
            {t("set.profile.signTitle")}
          </h2>
        </div>
        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.profile.soLabel")}</span>
            <span className="tp-help">{t("set.profile.soHelp")}</span>
            {signOutError ? (
              <span className="tp-error-text" role="alert">
                {t("set.profile.soError")}
              </span>
            ) : null}
          </div>
          <div className="tp-setting-row__control">
            <button
              className="tp-btn tp-btn--secondary"
              type="button"
              disabled={signingOut}
              onClick={() => void onSignOut()}
            >
              <TpIcon name="logout" size="sm" />
              <span>{t("set.profile.soBtn")}</span>
            </button>
          </div>
        </div>
      </section>

      {saved ? <Toast title={t("set.profile.saved")} onDismiss={() => setSaved(false)} /> : null}
    </>
  );
}
