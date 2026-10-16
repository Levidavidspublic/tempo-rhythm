"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { SettingsSwitch } from "@/components/settings/controls";
import { useSettingsStatus } from "@/components/settings/status";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { nextUtcDayStartMs, searchesLeft, utcDayOf } from "@/lib/coach-sources";

/**
 * Today's UTC date, read from the device clock on every render, plus one wake-up when that day
 * ends, so the count starts again at UTC midnight even on a page left open.
 */
function useUtcDay(): string {
  const day = utcDayOf(Date.now());
  const [, setTick] = useState(0);
  useEffect(() => {
    const wait = Math.max(0, nextUtcDayStartMs(day) - Date.now()) + 50;
    const timer = window.setTimeout(() => setTick((n) => n + 1), Number.isFinite(wait) ? wait : 60_000);
    return () => window.clearTimeout(timer);
  }, [day]);
  return day;
}

/**
 * Settings · Preferences: the coach's web search switch (TEMPO-B07-06). Off unless the person
 * turns it on (`preferences.update({ coachWebSearch })`, #976). The note says what leaves Tempo
 * and to whom; the count is `coach.webSearchStatus` for today's UTC date. When the deployment has
 * no search provider the row says "Not set up yet" and the switch can't be turned on. Saving
 * works like the rest of the page: it applies at once and the header says "Saved."
 */
export function CoachWebSearchSetting() {
  const { t } = useLocale();
  const announce = useSettingsStatus();
  const utcDay = useUtcDay();
  const preferences = useQuery(api.preferences.get, {});
  const status = useQuery(api.coach.webSearchStatus, { utcDay });
  const update = useMutation(api.preferences.update);
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  if (preferences === undefined || status === undefined) return null;

  const available = status.available;
  const on = available && (pending ?? preferences.coachWebSearch);
  const count = available
    ? t("coachWeb.left")
        .replace("{n}", String(searchesLeft(status.usedToday, status.dailyLimit)))
        .replace("{limit}", String(status.dailyLimit))
    : t("coachWeb.notSetUp");

  const save = async (next: boolean) => {
    setPending(next);
    setFailed(false);
    try {
      await update({ coachWebSearch: next });
      announce(t("set.saved"));
    } catch {
      setFailed(true);
    } finally {
      // Back to the stored value, unless a newer change is on its way.
      setPending((current) => (current === next ? null : current));
    }
  };

  return (
    <section
      className="tp-settings-section"
      aria-labelledby="web-search-title"
      id="web-search"
      data-component="SettingsSection"
    >
      <div className="tp-settings-section__head">
        <h2 className="tp-settings-section__title" id="web-search-title">
          {t("coachWeb.section")}
        </h2>
      </div>

      <div className="tp-setting-row od-row" data-component="SettingRow" data-available={available}>
        <div className="tp-setting-row__text">
          <span className="tp-setting-row__label" id="web-search-l">
            {t("coachWeb.label")}
          </span>
          <span className="tp-help" id="web-search-h">
            {t("coachWeb.note")}
          </span>
          <span className="tp-help" id="web-search-c">
            {count}
          </span>
        </div>
        <div className="tp-setting-row__control">
          <SettingsSwitch
            id="pref-coach-web-search"
            checked={on}
            onChange={(next) => void save(next)}
            locked={!available}
            labelledBy="web-search-l"
            describedBy="web-search-h web-search-c"
          />
        </div>
      </div>

      {failed ? (
        <p className="tp-error-text" role="alert" style={{ padding: "0 var(--tp-space-5) var(--tp-space-3)" }}>
          <TpIcon name="alert" size="sm" />
          <span>{t("set.prefs.saveError")}</span>
        </p>
      ) : null}
    </section>
  );
}
