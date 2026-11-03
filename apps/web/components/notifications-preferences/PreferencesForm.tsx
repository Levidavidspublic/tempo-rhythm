"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { DialControl, Segmented, SettingsSwitch } from "@/components/settings/controls";
import { useSettingsStatus } from "@/components/settings/status";
import { StateLoading } from "@/components/settings/states";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";
import { clampDial } from "@/lib/settings/dial";
import { applyTextSize, readTextSize, TEXT_SIZE_STORAGE_KEY, type TextSize } from "@/lib/settings/textSize";

type Theme = "system" | "light" | "dark";
type WeekStartsOn = 0 | 1 | 6;

type Preferences = {
  theme: Theme;
  locale: Lang;
  weekStartsOn: WeekStartsOn;
  timeZone: string;
  emailReminders: boolean;
  inAppNotifications: boolean;
};

type PreferencesPatch = Partial<Preferences>;

/** The coach dial saves 400 ms after the slider stops moving (settings-prefs.html). */
const DIAL_SAVE_DELAY_MS = 400;

function listTimeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  return zones.includes(current) ? zones : [current, ...zones];
}

function toWeekStart(value: string): WeekStartsOn {
  if (value === "0") return 0;
  if (value === "6") return 6;
  return 1;
}

/**
 * Settings · Preferences (docs/design/v3/screens/web/settings-prefs.html). Every change applies
 * at once and the page header says "Saved." There is no Save button.
 * Theme, language and the reading font drive the shell's own state (ThemeProvider,
 * LocaleProvider); theme and language are also saved with preferences.update. Text size is
 * device-local like the reading font. The coach dial is coach.getSettings / coach.setDial.
 * "Your week and notices" keeps the stored settings that exist (week start, time zone, email
 * reminders, in-app notices); the designed "weekly page" and "founder replies" switches have no
 * backend field, so they are not shown.
 */
export function PreferencesForm() {
  const { t, lang, setLang } = useLocale();
  const { theme, setTheme, dyslexia, setDyslexia } = useTheme();
  const announce = useSettingsStatus();
  const preferences = useQuery(api.preferences.get, {});
  const coach = useQuery(api.coach.getSettings, {});
  const updatePreferences = useMutation(api.preferences.update);
  const setDial = useMutation(api.coach.setDial);
  const [overrides, setOverrides] = useState<PreferencesPatch>({});
  const [textSize, setTextSize] = useState<TextSize>("m");
  const [dialDraft, setDialDraft] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const dialTimer = useRef<number | null>(null);
  const dialPending = useRef<number | null>(null);
  const timeZone = overrides.timeZone ?? preferences?.timeZone ?? "UTC";
  const timeZones = useMemo(() => listTimeZones(timeZone), [timeZone]);

  useEffect(() => {
    setTextSize(readTextSize(document.documentElement.getAttribute("data-text-size")));
  }, []);

  // A browser with no language of its own (no ?lang, nothing stored) takes the account's.
  const accountLocale = preferences?.locale;
  useEffect(() => {
    if (!accountLocale || accountLocale === lang) return;
    let deviceLang: string | null = null;
    try {
      deviceLang = localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    if (deviceLang || new URLSearchParams(window.location.search).get("lang")) return;
    setLang(accountLocale);
  }, [accountLocale, lang, setLang]);

  // Leaving the page mid-drag still saves the last dial value.
  const setDialRef = useRef(setDial);
  setDialRef.current = setDial;
  useEffect(
    () => () => {
      if (dialTimer.current !== null) window.clearTimeout(dialTimer.current);
      if (dialPending.current !== null) void setDialRef.current({ dial: dialPending.current }).catch(() => {});
    },
    [],
  );

  if (preferences === undefined || coach === undefined) {
    return <StateLoading label="set.prefs.loading" rows={5} className="pr-state" />;
  }

  const shown: Preferences = { ...preferences, ...overrides };
  const dial = dialDraft ?? clampDial(coach.dial);

  const saved = () => {
    setFailed(false);
    announce(t("set.saved"));
  };

  const save = async (patch: PreferencesPatch, onSaved?: () => void) => {
    setOverrides((current) => ({ ...current, ...patch }));
    try {
      await updatePreferences(patch);
      onSaved?.();
      saved();
    } catch {
      setFailed(true);
    } finally {
      // Back to the stored value, unless a newer change to the same setting is on its way.
      setOverrides((current) => {
        const next = { ...current };
        for (const key of Object.keys(patch) as (keyof Preferences)[]) {
          if (next[key] === patch[key]) delete next[key];
        }
        return next;
      });
    }
  };

  const onTheme = (next: Theme) => {
    setTheme(next);
    void save({ theme: next });
  };

  // The page switches language only once the account has it, so a failed save leaves the old
  // language selected and picking the new one again retries.
  const shownLang = overrides.locale ?? lang;
  const onLang = (next: Lang) => {
    if (next === shownLang) return;
    void save({ locale: next }, () => setLang(next));
  };

  const onTextSize = (next: TextSize) => {
    setTextSize(next);
    applyTextSize(document.documentElement, next);
    try {
      if (next === "m") localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
      else localStorage.setItem(TEXT_SIZE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the size still applies on this page */
    }
    saved();
  };

  const onDyslexia = (next: boolean) => {
    setDyslexia(next);
    saved();
  };

  const onDial = (raw: number) => {
    const next = clampDial(raw);
    setDialDraft(next);
    dialPending.current = next;
    if (dialTimer.current !== null) window.clearTimeout(dialTimer.current);
    dialTimer.current = window.setTimeout(() => {
      dialTimer.current = null;
      dialPending.current = null;
      setDial({ dial: next })
        .then(() => {
          // Keep showing the draft if the slider already moved on.
          setDialDraft((current) => (current === next ? null : current));
          saved();
        })
        .catch(() => {
          setDialDraft((current) => (current === next ? null : current));
          setFailed(true);
        });
    }, DIAL_SAVE_DELAY_MS);
  };

  return (
    <>
      {failed ? (
        <p className="tp-error-text" role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{t("set.prefs.saveError")}</span>
        </p>
      ) : null}

      <section className="tp-settings-section" aria-labelledby="look-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="look-title">
            {t("set.prefs.look")}
          </h2>
        </div>

        <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="theme-l">
              {t("set.prefs.theme")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <Segmented<Theme>
              labelledBy="theme-l"
              value={theme}
              onChange={onTheme}
              options={[
                { value: "light", label: t("set.prefs.themeLight"), icon: "sun" },
                { value: "dark", label: t("set.prefs.themeDark"), icon: "moon" },
                { value: "system", label: t("set.prefs.themeSystem") },
              ]}
            />
          </div>
        </div>

        <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="lang-l">
              {t("set.prefs.lang")}
            </span>
            <span className="tp-help">{t("set.prefs.langHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Segmented<Lang>
              labelledBy="lang-l"
              value={shownLang}
              onChange={onLang}
              options={[
                { value: "en", label: "English", lang: "en" },
                { value: "he", label: "עברית", lang: "he" },
              ]}
            />
          </div>
        </div>

        <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="size-l">
              {t("set.prefs.size")}
            </span>
            <span className="tp-help">{t("set.prefs.sizeHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Segmented<TextSize>
              labelledBy="size-l"
              value={textSize}
              onChange={onTextSize}
              options={[
                { value: "s", label: t("set.prefs.sizeS") },
                { value: "m", label: t("set.prefs.sizeM") },
                { value: "l", label: t("set.prefs.sizeL") },
              ]}
            />
          </div>
        </div>

        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="dys-l">
              {t("set.prefs.dys")}
            </span>
            <span className="tp-help" id="dys-h">
              {t("set.prefs.dysHelp")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <SettingsSwitch checked={dyslexia} onChange={onDyslexia} labelledBy="dys-l" describedBy="dys-h" />
          </div>
        </div>

        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.prefs.motion")}</span>
            <span className="tp-help">{t("set.prefs.motionHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <span className="tp-badge" data-tone="info" data-component="Badge">
              <TpIcon name="info" size="sm" />
              <span>{t("set.prefs.motionBadge")}</span>
            </span>
          </div>
        </div>
      </section>

      <section className="tp-settings-section" aria-labelledby="coach-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="coach-title">
            {t("set.prefs.coach")}
          </h2>
          <p className="tp-settings-section__desc">{t("set.prefs.coachDesc")}</p>
        </div>
        <div className="pr-dial">
          <DialControl id="dial" label={t("set.dial.label")} value={dial} onChange={onDial} describedBy="dial-help" />
          <p className="tp-help" id="dial-help">
            {t("set.prefs.dialHelp")}
          </p>
        </div>
      </section>

      <section
        className="tp-settings-section"
        aria-labelledby="notify-title"
        id="notify"
        data-component="SettingsSection"
      >
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="notify-title">
            {t("set.prefs.week")}
          </h2>
        </div>

        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <label className="tp-setting-row__label" htmlFor="pref-week-start">
              {t("set.prefs.weekStart")}
            </label>
            <span className="tp-help" id="wk-help">
              {t("set.prefs.weekHelp")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <div className="tp-select" data-component="Select">
              <select
                className="tp-select__input"
                id="pref-week-start"
                aria-describedby="wk-help"
                value={String(shown.weekStartsOn)}
                onChange={(event) => void save({ weekStartsOn: toWeekStart(event.target.value) })}
              >
                <option value="0">{t("set.prefs.sun")}</option>
                <option value="1">{t("set.prefs.mon")}</option>
                <option value="6">{t("set.prefs.sat")}</option>
              </select>
              <TpIcon name="down" size="sm" className="tp-select__icon" />
            </div>
          </div>
        </div>

        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <label className="tp-setting-row__label" htmlFor="pref-time-zone">
              {t("set.prefs.tz")}
            </label>
            <span className="tp-help" id="tz-help">
              {t("set.prefs.tzHelp")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <div className="tp-select" data-component="Select">
              <select
                className="tp-select__input"
                id="pref-time-zone"
                dir="ltr"
                aria-describedby="tz-help"
                value={shown.timeZone}
                onChange={(event) => void save({ timeZone: event.target.value })}
              >
                {timeZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <TpIcon name="down" size="sm" className="tp-select__icon" />
            </div>
          </div>
        </div>

        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="n-email-l">
              {t("set.prefs.email")}
            </span>
            <span className="tp-help" id="n-email-h">
              {t("set.prefs.emailHelp")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <SettingsSwitch
              id="pref-email-reminders"
              checked={shown.emailReminders}
              onChange={(next) => void save({ emailReminders: next })}
              labelledBy="n-email-l"
              describedBy="n-email-h"
            />
          </div>
        </div>

        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="n-app-l">
              {t("set.prefs.inApp")}
            </span>
            <span className="tp-help" id="n-app-h">
              {t("set.prefs.inAppHelp")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <SettingsSwitch
              id="pref-in-app"
              checked={shown.inAppNotifications}
              onChange={(next) => void save({ inAppNotifications: next })}
              labelledBy="n-app-l"
              describedBy="n-app-h"
            />
          </div>
        </div>

        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="n-bill-l">
              {t("set.prefs.billing")}
            </span>
            <span className="tp-help" id="n-bill-h">
              {t("set.prefs.billingHelp")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <SettingsSwitch checked locked labelledBy="n-bill-l" describedBy="n-bill-h" />
          </div>
        </div>
      </section>
    </>
  );
}
