"use client";

import type { CSSProperties } from "react";
import { type DayCell, DayGrid } from "@/components/panelui/day-grid";
import { Kpi } from "@/components/panelui/kpi";
import type { Lang, MessageKey } from "@/lib/i18n";
import { formatMinutes, type WeekGlance } from "@/lib/week-glance";

/**
 * PanelUI's web components (components/panelui) read shadcn's raw colour variables; on this
 * section they point at Tempo's own tokens, so both themes follow without touching globals.css.
 */
export const PANELUI_TOKENS = {
  "--primary": "var(--color-primary)",
  "--success": "var(--color-moss)",
  "--warning": "var(--color-amber)",
  "--info": "var(--color-info)",
  "--destructive": "var(--color-destructive)",
} as CSSProperties;

/**
 * "This week at a glance" on a weekly page: PanelUI KPI stat cards with a sparkline each, and a
 * Day Grid of the seven days. The numbers only describe the week (lib/week-glance.ts).
 */
export function WeekGlanceView({ glance, t, lang }: { glance: WeekGlance; t: (key: MessageKey) => string; lang: Lang }) {
  const dayName = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
  const cells: DayCell[] = glance.days.map((day) => ({
    level: day.level,
    label: t("wk.day")
      .replace("{day}", dayName.format(new Date(day.startMs)))
      .replace("{n}", String(day.done))
      .replace("{m}", String(day.focusMinutes)),
  }));
  const minutes = { min: t("wk.min"), hmin: t("wk.hmin") };
  return (
    <section className="tp-section" data-component="WeekGlance" aria-labelledby="wk-glance-h" style={PANELUI_TOKENS}>
      <div className="tp-section__head">
        <h2 className="tp-section__title" id="wk-glance-h">
          {t("wk.title")}
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi surface data-component="StatCard">
          <Kpi.Header>
            <Kpi.Title>{t("wk.done")}</Kpi.Title>
          </Kpi.Header>
          <Kpi.Content>
            <Kpi.Value className="tp-num">{glance.done}</Kpi.Value>
          </Kpi.Content>
          <Kpi.Chart data={glance.days.map((day) => day.done)} filled aria-label={t("wk.doneTrend")} />
        </Kpi>
        <Kpi surface data-component="StatCard">
          <Kpi.Header>
            <Kpi.Title>{t("wk.focus")}</Kpi.Title>
          </Kpi.Header>
          <Kpi.Content>
            <Kpi.Value className="tp-num">{formatMinutes(glance.focusMinutes, minutes)}</Kpi.Value>
          </Kpi.Content>
          <Kpi.Chart data={glance.days.map((day) => day.focusMinutes)} color="success" filled aria-label={t("wk.focusTrend")} />
        </Kpi>
        <Kpi surface data-component="StatCard">
          <Kpi.Header>
            <Kpi.Title>{t("wk.days")}</Kpi.Title>
          </Kpi.Header>
          <DayGrid
            cells={cells}
            columns={7}
            label={t("wk.days")}
            summary={t("wk.summary").replace("{a}", String(glance.activeDays))}
          />
          <DayGrid.Legend less={t("wk.less")} more={t("wk.more")} />
        </Kpi>
      </div>
      {glance.activeDays === 0 ? <p className="tp-small tp-muted">{t("wk.quiet")}</p> : null}
    </section>
  );
}
