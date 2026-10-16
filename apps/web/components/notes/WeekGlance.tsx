"use client";

import { useQuery } from "convex/react";
import { Component, type ReactNode, useMemo } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import { weekBounds, weekGlance } from "@/lib/week-glance";
import { WeekGlanceView } from "./WeekGlanceView";

/** The glance is extra: if one of its reads fails, the weekly page shows without it. */
class GlanceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function WeekGlanceData({ monday }: { monday: string }) {
  const { t, lang } = useLocale();
  const bounds = useMemo(() => weekBounds(monday), [monday]);
  const tasks = useQuery(api.tasks.list, bounds ? { status: "done" } : "skip");
  const blocks = useQuery(
    api.focusBlocks.listInRange,
    bounds ? { startMs: bounds[0] as number, endMs: bounds[7] as number } : "skip",
  );
  const glance = useMemo(
    () => (tasks === undefined || blocks === undefined ? undefined : weekGlance(monday, tasks, blocks)),
    [monday, tasks, blocks],
  );
  if (!bounds || glance === null) return null;
  if (glance === undefined) {
    return (
      <output className="tp-state--loading block" data-component="StateLoading" aria-busy="true">
        <span className="tp-sr-only">{t("wk.loading")}</span>
        <span className="tp-skel-list">
          <span className="tp-skeleton tp-skeleton--w40" />
          <span className="tp-skeleton tp-skeleton--block" />
        </span>
      </output>
    );
  }
  return <WeekGlanceView glance={glance} t={t} lang={lang} />;
}

/** "This week at a glance" above a weekly page (`pageType: "weekly"`, `date` = that week's Monday). */
export function WeekGlance({ monday }: { monday: string }) {
  return (
    <GlanceBoundary>
      <WeekGlanceData monday={monday} />
    </GlanceBoundary>
  );
}
