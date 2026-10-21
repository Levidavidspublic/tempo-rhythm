"use client";

import { useMutation, useQuery } from "convex/react";
import { Component, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { SettingsSwitch } from "@/components/settings/controls";
import { useSettingsStatus } from "@/components/settings/status";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { nextUtcDayStartMs, searchesLeft, utcDayOf } from "@/lib/coach-sources";
import { kb59Copy } from "@/lib/i18n-groups/kb-59";
import "@/app/v3/kb-59.css";

/**
 * Today's UTC date, read from the device clock on every render, plus one wake-up when that day
 * ends, so the count starts again at UTC midnight even on a page left open.
 */
function useUtcDay(): string {
  const day = utcDayOf(Date.now());
  const [, setTick] = useState(0);
  useEffect(() => {
    const wait = Math.max(0, nextUtcDayStartMs(day) - Date.now()) + 50;
    const timer = window.setTimeout(
      () => setTick((n) => n + 1),
      Number.isFinite(wait) ? wait : 60_000
    );
    return () => window.clearTimeout(timer);
  }, [day]);
  return day;
}

/** The row is extra: if its read fails (say the backend isn't deployed yet), Preferences shows without it. */
class WebSearchBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Settings · Preferences: the coach's web search switch (TEMPO-B07-06). Off unless the person
 * turns it on (`preferences.update({ coachWebSearch })`, #976). The note says what leaves Tempo
 * and to whom; the count is `coach.webSearchStatus` for today's UTC date. When the deployment has
 * no search provider the row says "Not set up yet" and the switch can't be turned on. Saving
 * works like the rest of the page: it applies at once and the header says "Saved."
 */
function WebSearchRow() {
  const announce = useSettingsStatus();
  const utcDay = useUtcDay();
  const preferences = useQuery(api.preferences.get, {});
  const status = useQuery(api.coach.webSearchStatus, { utcDay });
  const update = useMutation(api.preferences.update);
  return (
    <WebSearchPreference
      loading={preferences === undefined || status === undefined}
      available={status?.available ?? false}
      stored={preferences?.coachWebSearch ?? false}
      usedToday={status?.usedToday ?? 0}
      dailyLimit={status?.dailyLimit ?? 0}
      update={(next) => update({ coachWebSearch: next })}
      announce={announce}
    />
  );
}

/** Shared by the live row and the fictional gallery; each mounted row owns its requests. */
function WebSearchPreference({
  loading = false,
  available,
  stored,
  usedToday,
  dailyLimit,
  update,
  announce,
}: {
  loading?: boolean;
  available: boolean;
  stored: boolean;
  usedToday: number;
  dailyLimit: number;
  update: (next: boolean) => Promise<unknown>;
  announce: (text: string) => void;
}) {
  const { t, lang } = useLocale();
  const copy = kb59Copy[lang];
  const [pending, setPending] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(false);
  const request = useRef(0);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, []);
  const on = available && (pending ?? stored);
  const count = available
    ? t("coachWeb.left")
        .replace("{n}", String(searchesLeft(usedToday, dailyLimit)))
        .replace("{limit}", String(dailyLimit))
    : t("coachWeb.notSetUp");

  /** Only the latest request in this mounted controller may publish its outcome. */
  const save = async (next: boolean) => {
    if (!available || !mounted.current) return;
    const mine = ++request.current;
    const owns = () => mounted.current && request.current === mine;
    setPending(next);
    setFailed(false);
    // Clear a preceding Saved line (and its delayed announcement) when a newer intent starts.
    announce("");
    try {
      await update(next);
      if (owns()) announce(t("set.saved"));
    } catch {
      if (owns()) setFailed(true);
    } finally {
      if (owns()) setPending(null);
    }
  };

  // Query loading hides the view, while this controller keeps accepted requests alive.
  if (loading) return null;

  return (
    <section
      className="tp-settings-section kb59-preference"
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
            describedBy={`web-search-h web-search-c${pending !== null || failed ? " web-search-feedback" : ""}`}
          />
        </div>
      </div>

      {pending !== null ? (
        <output className="kb59-feedback tp-help" id="web-search-feedback" aria-live="polite">
          {copy.saving}
        </output>
      ) : failed ? (
        <p className="kb59-feedback tp-error-text" id="web-search-feedback" role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{copy.error}</span>
        </p>
      ) : null}
    </section>
  );
}

/** Keep a failed optional web-search read inside the existing preferences-page boundary. */
export function CoachWebSearchSetting() {
  return (
    <WebSearchBoundary>
      <WebSearchRow />
    </WebSearchBoundary>
  );
}

/** Interactive fictional preferences. Uses the same request ownership as the mounted row. */
export function Kb59Gallery() {
  const { lang, t } = useLocale();
  const copy = kb59Copy[lang];
  const [stored, setStored] = useState(false);
  const [outcome, setOutcome] = useState("success");
  const [status, setStatus] = useState("");
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    []
  );
  /** Simulate a fictional save without invoking a backend or search provider. */
  const update = (next: boolean) =>
    new Promise<null>((resolve, reject) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        if (outcome === "error") reject(new Error("fictional-save"));
        else {
          setStored(next);
          resolve(null);
        }
      }, 1500);
      timers.current.add(timer);
    });
  return (
    <main className="tp-page tp-page--narrow kb59-gallery" data-component="Kb59Gallery">
      <header className="tp-pagehead">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{copy.galleryTitle}</h1>
          <p className="tp-pagehead__sub">{copy.galleryBody}</p>
          <output className="tp-help" data-kb59-gallery-status>
            {status}
          </output>
        </div>
      </header>
      <div className="kb59-gallery-controls">
        <label className="tp-label" htmlFor="kb59-outcome">
          {copy.nextSave}
        </label>
        <select
          className="tp-input"
          id="kb59-outcome"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
        >
          <option value="success">{copy.success}</option>
          <option value="error">{copy.showError}</option>
        </select>
      </div>
      <WebSearchPreference
        available
        stored={stored}
        usedToday={2}
        dailyLimit={5}
        update={update}
        announce={setStatus}
      />
      <p className="kb59-stored tp-help">
        {copy.stored} {t(stored ? "set.on" : "set.off")}
      </p>
    </main>
  );
}
