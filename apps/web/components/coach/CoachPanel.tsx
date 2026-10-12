"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { CoachConversation } from "./CoachChat";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  // As a sheet, Tab and Shift+Tab wrap inside the panel.
  function keepFocusInside(e: KeyboardEvent<HTMLElement>) {
    const root = panel.current;
    if (!modal || e.key !== "Tab" || !root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!first || !last) {
      e.preventDefault();
    } else if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
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
      onKeyDown={keepFocusInside}
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
