"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { CoachConversation } from "./CoachChat";

/**
 * CoachPanel (coach.html): the coach beside the page. Docked at 1280 px and up, a sheet below
 * that (tempo.css). As a sheet it is a modal dialog: the shell makes the rest inert. The coach
 * only proposes; nothing changes without a yes.
 */
export function CoachPanel({ onClose, modal = false }: { onClose: () => void; modal?: boolean }) {
  const { t } = useLocale();
  const panel = useRef<HTMLElement | null>(null);
  // Focus moves into the panel when it opens (the composer takes it once the thread is ready).
  useEffect(() => {
    panel.current?.focus();
  }, []);
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-modal is set only with role="dialog" (the sheet below 1280 px)
    <aside
      ref={panel}
      tabIndex={-1}
      className="tp-coach-panel tp-glass"
      id="coach-panel"
      data-component="CoachPanel"
      aria-labelledby="coach-panel-title"
      role={modal ? "dialog" : undefined}
      aria-modal={modal ? true : undefined}
    >
      <div className="tp-coach-panel__head">
        <TpIcon name="coach" />
        <div className="tp-coach-panel__title">
          <strong id="coach-panel-title">{t("coach.name")}</strong>
          <span>{t("coachPanel.sub")}</span>
        </div>
        <Link className="tp-btn tp-btn--ghost tp-btn--sm" href="/coach" onClick={onClose}>
          {t("coachPanel.full")}
        </Link>
        <button className="tp-btn tp-btn--ghost tp-btn--icon" type="button" aria-label={t("coachPanel.close")} onClick={onClose}>
          <TpIcon name="x" size="sm" />
        </button>
      </div>
      <CoachConversation variant="panel" />
    </aside>
  );
}
