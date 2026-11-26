"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { DialControl, SettingsSwitch } from "@/components/settings/controls";
import { StateLoading, StateOffline, useOnline } from "@/components/settings/states";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Lang } from "@/lib/i18n";
import { clampDial } from "@/lib/settings/dial";
import {
  finishArgs,
  isOptionalStep,
  ONBOARDING_STEPS,
  type OnboardingStep,
  parseStep,
  prefillName,
} from "@/lib/settings/onboarding";
import { NameStep } from "./NameStep";

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="tp-auth-card" data-component="AuthCard">
      {children}
    </div>
  );
}

/** Keep the open step in the address, so a refresh comes back to it. */
function rememberStep(step: number) {
  if (typeof window === "undefined" || typeof window.history?.replaceState !== "function") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(step));
    window.history.replaceState(window.history.state, "", url);
  } catch {
    /* address bar unavailable: the step still changes */
  }
}

/**
 * Onboarding (docs/design/v3/screens/web/onboarding.html): five steps in the AuthCard, one per
 * view, "Step n of 5", Back after step 1, `?step=1..5` opens a step.
 *   1 language + reading font: the shell's own switches (LocaleProvider, ThemeProvider), the
 *     language also saved with preferences.update.
 *   2 name (optional): sent once, on finish, with users.completeOnboarding. Skipping this step
 *     sends no name; skipping a later step keeps the name that was entered.
 *   3 coach dial: coach.setDial when it changed.
 *   4 first brain dump (optional): becomes a page (notes.create, notes.update if edited again).
 *   5 privacy: Tempo collects no usage analytics, so the switch is off and locked and says why.
 * Saving shows "Saving…" on the primary button; a failed save keeps everything entered.
 */
export function OnboardingFlow() {
  const router = useRouter();
  const { t, lang, setLang } = useLocale();
  const { dyslexia, setDyslexia } = useTheme();
  const online = useOnline();
  const profile = useQuery(api.users.getProfile, {});
  const coach = useQuery(api.coach.getSettings, profile ? {} : "skip");
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const setCoachDial = useMutation(api.coach.setDial);
  const createNote = useMutation(api.notes.create);
  const updateNote = useMutation(api.notes.update);
  const updatePreferences = useMutation(api.preferences.update);
  const [step, setStep] = useState<OnboardingStep>(1);
  const [typed, setTyped] = useState<string | null>(null);
  const [nameSkipped, setNameSkipped] = useState(false);
  const [dialDraft, setDialDraft] = useState<number | null>(null);
  const [savedDial, setSavedDial] = useState<number | null>(null);
  const [dump, setDump] = useState("");
  const [dumpPage, setDumpPage] = useState<{ id: Id<"notes">; text: string } | null>(null);
  // The brain-dump page's create, once started. Offline it stays queued, and a second pass
  // through step 4 must update that page, never create another (Codex P2 on #929).
  const dumpCreate = useRef<{ text: string; id: Promise<Id<"notes">> } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const finishing = useRef(false);
  const moved = useRef(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const alreadyOnboarded = Boolean(profile?.onboardedAt);

  useEffect(() => {
    if (alreadyOnboarded && !finishing.current) router.replace("/today");
  }, [alreadyOnboarded, router]);

  // `?step=1..5` opens a step.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setStep(parseStep(new URLSearchParams(window.location.search || "").get("step")));
  }, []);

  // Focus moves to each step's heading after Continue, Back or Skip (not on first load).
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    rememberStep(step);
    headingRef.current?.focus();
  }, [step]);

  // The coach settings load too, so the dial never shows a stand-in value that a quick Continue
  // would take as unchanged (Codex P2 on #929).
  if (!profile || alreadyOnboarded || coach === undefined) {
    return (
      <Card>
        <StateLoading label="set.onb.loading" rows={3} />
      </Card>
    );
  }

  const name = typed ?? prefillName(profile.greetingName);
  const storedDial = savedDial ?? clampDial(coach?.dial);
  const dial = dialDraft ?? storedDial;

  const go = (next: number) => {
    moved.current = true;
    setError(false);
    setStep(Math.min(ONBOARDING_STEPS, Math.max(1, next)) as OnboardingStep);
  };

  /** One save at a time. Offline, a step's save is queued by Convex and the flow moves on. */
  const run = async (work: () => Promise<void>, after: () => void, waitWhenOffline = false) => {
    if (busy.current) return;
    if (!online && !waitWhenOffline) {
      void work().catch(() => {});
      after();
      return;
    }
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      await work();
      after();
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  const finish = () =>
    run(
      async () => {
        finishing.current = true;
        try {
          await completeOnboarding(finishArgs(name, nameSkipped));
        } catch (err) {
          finishing.current = false;
          throw err;
        }
      },
      () => router.push("/today"),
      true,
    );

  const onContinue = () => {
    if (busy.current) return;
    if (step === 1) go(2);
    else if (step === 2) {
      setNameSkipped(false);
      go(3);
    } else if (step === 3) {
      if (dial === storedDial) go(4);
      else
        void run(
          async () => {
            await setCoachDial({ dial });
            setSavedDial(dial);
            setDialDraft(null);
          },
          () => go(4),
        );
    } else if (step === 4) {
      const text = dump.trim();
      if (!text || text === dumpPage?.text) go(5);
      else
        void run(
          async () => {
            let id = dumpPage?.id;
            if (!id) {
              if (!dumpCreate.current) {
                const created = createNote({ title: t("set.onb.dumpLabel"), body: text });
                dumpCreate.current = { text, id: created };
                created.catch(() => {
                  dumpCreate.current = null;
                });
              }
              const queued = dumpCreate.current;
              id = await queued.id;
              if (queued.text === text) {
                setDumpPage({ id, text });
                return;
              }
            }
            await updateNote({ noteId: id, body: text });
            setDumpPage({ id, text });
          },
          () => go(5),
        );
    } else void finish();
  };

  const onSkip = () => {
    if (busy.current) return;
    if (step === 2) setNameSkipped(true);
    go(step + 1);
  };

  const onLanguage = (next: Lang) => {
    setLang(next);
    // The device switch already applied; the stored preference is a mirror.
    void updatePreferences({ locale: next }).catch(() => {});
  };

  const stepTitle = (id: string, text: string, lede: string) => (
    <div className="ob-step__head">
      <h1 className="tp-auth-card__title" id={id} tabIndex={-1} ref={headingRef}>
        {text}
      </h1>
      <p className="tp-auth-card__lede">{lede}</p>
    </div>
  );

  return (
    <Card>
      <div className="ob-top">
        <span className="tp-auth-card__brand">Tempo</span>
        <p className="tp-eyebrow" aria-live="polite">
          <span>{t("set.onb.step")}</span> <span className="tp-num">{step}</span> <span>{t("set.onb.of")}</span>{" "}
          <span className="tp-num">{ONBOARDING_STEPS}</span>
        </p>
      </div>

      <StateOffline title="set.onb.offTitle" body="set.onb.offBody" />

      {error ? (
        <div className="tp-notice" data-tone="danger" role="alert" data-component="StateError">
          <span className="tp-notice__icon">
            <TpIcon name="alert" />
          </span>
          <span className="tp-notice__text">
            <span className="tp-notice__title">{t("set.onb.errTitle")}</span> <span>{t("set.onb.errBody")}</span>
          </span>
        </div>
      ) : null}

      <form
        className="tp-form"
        noValidate
        aria-busy={pending || undefined}
        data-component="Form"
        onSubmit={(event) => event.preventDefault()}
      >
        {step === 1 ? (
          <section className="ob-step" aria-labelledby="s1-title">
            {stepTitle("s1-title", t("set.onb.s1Title"), t("set.onb.s1Lede"))}
            <div className="ob-fieldsets">
              <fieldset className="ob-fieldset">
                <legend className="tp-label">{t("set.onb.langLegend")}</legend>
                <label className="tp-choice" data-component="Radio">
                  <input
                    className="tp-radio"
                    type="radio"
                    name="language"
                    value="en"
                    checked={lang === "en"}
                    onChange={() => onLanguage("en")}
                  />
                  <span className="tp-choice__text">
                    <span lang="en">English</span>
                  </span>
                </label>
                <label className="tp-choice" data-component="Radio">
                  <input
                    className="tp-radio"
                    type="radio"
                    name="language"
                    value="he"
                    checked={lang === "he"}
                    onChange={() => onLanguage("he")}
                  />
                  <span className="tp-choice__text">
                    <span lang="he">עברית</span>
                    <span className="tp-choice__hint">{t("set.onb.heHint")}</span>
                  </span>
                </label>
              </fieldset>
              <fieldset className="ob-fieldset">
                <legend className="tp-label">{t("set.onb.fontLegend")}</legend>
                <label className="tp-choice" data-component="Radio">
                  <input
                    className="tp-radio"
                    type="radio"
                    name="font"
                    value="standard"
                    checked={!dyslexia}
                    onChange={() => setDyslexia(false)}
                  />
                  <span className="tp-choice__text">
                    <span>{t("set.onb.fontStd")}</span>
                    <span className="tp-choice__hint">{t("set.onb.fontStdHint")}</span>
                  </span>
                </label>
                <label className="tp-choice" data-component="Radio">
                  <input
                    className="tp-radio"
                    type="radio"
                    name="font"
                    value="dyslexia"
                    checked={dyslexia}
                    onChange={() => setDyslexia(true)}
                  />
                  <span className="tp-choice__text">
                    <span>{t("set.onb.fontDys")}</span>
                    <span className="tp-choice__hint">{t("set.onb.fontDysHint")}</span>
                  </span>
                </label>
              </fieldset>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <NameStep
            name={name}
            onNameChange={(value) => {
              setTyped(value);
              setError(false);
            }}
            headingRef={headingRef}
          />
        ) : null}

        {step === 3 ? (
          <section className="ob-step" aria-labelledby="s3-title">
            {stepTitle("s3-title", t("set.onb.s3Title"), t("set.onb.s3Lede"))}
            <DialControl
              id="ob-dial"
              label={t("set.onb.dialLabel")}
              value={dial}
              onChange={(value) => setDialDraft(clampDial(value))}
              describedBy="ob-dial-help"
            >
              <p className="tp-help" id="ob-dial-help">
                {t("set.onb.dialHelp")}
              </p>
            </DialControl>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="ob-step" aria-labelledby="s4-title">
            {stepTitle("s4-title", t("set.onb.s4Title"), t("set.onb.s4Lede"))}
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor="ob-dump">
                <span>{t("set.onb.dumpLabel")}</span> <span className="tp-label__opt">{t("set.onb.optional")}</span>
              </label>
              <textarea
                className="tp-textarea"
                id="ob-dump"
                name="dump"
                rows={6}
                dir="auto"
                data-component="Textarea"
                aria-describedby="ob-dump-help"
                placeholder={t("set.onb.dumpPh")}
                value={dump}
                onChange={(event) => {
                  setDump(event.target.value);
                  setError(false);
                }}
              />
              <p className="tp-help" id="ob-dump-help">
                {t("set.onb.dumpHelp")}
              </p>
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="ob-step" aria-labelledby="s5-title">
            {stepTitle("s5-title", t("set.onb.s5Title"), t("set.onb.s5Lede"))}
            <div className="tp-setting-row" data-component="SettingRow">
              <div className="tp-setting-row__text">
                <span className="tp-setting-row__label" id="ob-an-label">
                  {t("set.onb.anLabel")}
                </span>
                <span className="tp-help" id="ob-an-help">
                  {t("set.onb.anHelp")} {t("set.privacy.anLocked")}
                </span>
              </div>
              <div className="tp-setting-row__control">
                <SettingsSwitch checked={false} locked labelledBy="ob-an-label" describedBy="ob-an-help" />
              </div>
            </div>
            <p className="tp-small tp-muted">{t("set.onb.s5Note")}</p>
          </section>
        ) : null}

        <div className="ob-nav">
          {step > 1 ? (
            <button className="tp-btn tp-btn--ghost" type="button" disabled={pending} onClick={() => go(step - 1)}>
              <TpIcon name="chevron" size="sm" className="tp-icon--back" />
              <span>{t("set.onb.back")}</span>
            </button>
          ) : null}
          <div className="ob-nav__end">
            {isOptionalStep(step) ? (
              <button className="tp-btn tp-btn--ghost" type="button" disabled={pending} onClick={onSkip}>
                {t("set.onb.skip")}
              </button>
            ) : null}
            {/* The click handler covers Enter too: the browser clicks the default button. */}
            <button
              className="tp-btn tp-btn--primary"
              type="submit"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                onContinue();
              }}
            >
              <span>
                {pending ? t("set.saving") : step === ONBOARDING_STEPS ? t("set.onb.finish") : t("set.onb.next")}
              </span>
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
