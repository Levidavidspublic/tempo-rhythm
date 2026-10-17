"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import {
  ankiFileName,
  canSystemShare,
  downloadText,
  markdownFileName,
  type ShareCard,
  toAnkiTsv,
} from "./share-helpers";

/** What is being shared: a page, or a study set (a deck of cards). */
export type ShareTarget = {
  kind: "page" | "set";
  title: string;
  /** The Markdown a download holds (a page's body as it is saved). */
  markdown: string;
  /** The in-app link Copy link puts on the clipboard. */
  url: string;
  /** Flashcards to offer as an Anki file; none hides that row. */
  cards?: readonly ShareCard[];
};

export type ShareSheetProps = {
  target: ShareTarget;
  onClose: () => void;
  id?: string;
  /** Override for tests; defaults to whether `navigator.share` exists. */
  systemShare?: boolean;
  /** Where focus goes on close when the opener is gone (a menu item that closed with its menu). */
  returnFocus?: { readonly current: HTMLElement | null };
};

type Status = { key: MessageKey; tone: "done" | "caution" } | null;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * ShareSheet (S26, PRD F-90): a MobileSheet (components.md §2.17), bottom on a phone and a
 * centred dialog from 768 px. Esc, Close and the scrim close it, Tab stays inside, and focus goes
 * back to the opener. The system share sheet when the browser has one, Copy link, Download
 * Markdown, and for flashcards a tab-separated file Anki imports. Nothing is uploaded or published.
 */
export function ShareSheet({ target, onClose, id: idProp, systemShare, returnFocus }: ShareSheetProps) {
  const { t } = useLocale();
  const autoId = useId();
  const id = idProp ?? `share-${autoId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [hasSystem] = useState(() =>
    systemShare ?? (typeof navigator === "undefined" ? false : canSystemShare(navigator)),
  );
  const [status, setStatus] = useState<Status>(null);
  const sheet = useRef<HTMLElement | null>(null);
  const cards = target.cards ?? [];
  const anki = cards.length > 0 ? toAnkiTsv(cards) : "";

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per opening; returnFocus is a ref
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.querySelector<HTMLElement>("[data-share-first]")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      const back = opener?.isConnected && opener !== document.body ? opener : returnFocus?.current;
      back?.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    const root = sheet.current;
    if (event.key !== "Tab" || !root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const shareSystem = async () => {
    try {
      await navigator.share({ title: target.title, url: target.url });
      setStatus(null);
    } catch (err) {
      // Closing the system sheet is a choice, not a problem.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus({ key: "share.systemBlocked", tone: "caution" });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(target.url);
      setStatus({ key: "share.copied", tone: "done" });
    } catch {
      setStatus({ key: "share.copyBlocked", tone: "caution" });
    }
  };

  const downloadMarkdown = () => {
    downloadText(target.markdown, markdownFileName(target.title), "text/markdown;charset=utf-8");
    setStatus({ key: "share.mdDone", tone: "done" });
  };

  const downloadAnki = () => {
    downloadText(anki, ankiFileName(target.title), "text/tab-separated-values;charset=utf-8");
    setStatus({ key: "share.ankiDone", tone: "done" });
  };

  const rows: { key: string; icon: TpIconName; label: MessageKey; help: MessageKey; run: () => void }[] = [];
  if (hasSystem) {
    rows.push({ key: "system", icon: "send", label: "share.system", help: "share.systemHelp", run: () => void shareSystem() });
  }
  rows.push({ key: "copy", icon: "link", label: "share.copy", help: "share.copyHelp", run: () => void copyLink() });
  rows.push({ key: "md", icon: "download", label: "share.md", help: "share.mdHelp", run: downloadMarkdown });
  if (anki) {
    rows.push({ key: "anki", icon: "card", label: "share.anki", help: "share.ankiHelp", run: downloadAnki });
  }

  return (
    <>
      <button type="button" className="tp-sheet-scrim" aria-label={t("share.close")} tabIndex={-1} onClick={onClose} />
      <section
        ref={sheet}
        className="tp-sheet tp-glass"
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-private`}
        data-component="MobileSheet"
        data-testid="share-sheet"
        onKeyDown={onKeyDown}
      >
        <div className="tp-sheet__grabber" aria-hidden="true" />
        <div className="tp-sheet__head">
          <h2 className="tp-sheet__title" id={`${id}-title`}>
            {t(target.kind === "set" ? "share.titleSet" : "share.titlePage")}
          </h2>
          <button
            className="tp-btn tp-btn--ghost tp-btn--icon tp-sheet__close"
            type="button"
            aria-label={t("share.close")}
            onClick={onClose}
          >
            <TpIcon name="x" />
          </button>
        </div>
        <div className="tp-sheet__body">
          <p className="tp-share-subject" dir="auto">
            {target.title}
          </p>
          <ul className="tp-share-list">
            {rows.map((row, index) => (
              <li key={row.key}>
                <button
                  type="button"
                  className="tp-touch-row"
                  data-component="TouchRow"
                  data-share={row.key}
                  data-share-first={index === 0 ? "" : undefined}
                  aria-describedby={`${id}-${row.key}-help`}
                  onClick={row.run}
                >
                  <span className="tp-touch-row__icon">
                    <TpIcon name={row.icon} size="sm" />
                  </span>
                  <span className="tp-touch-row__label tp-share-row__text">
                    <span>{t(row.label)}</span>
                    <span className="tp-help" id={`${id}-${row.key}-help`}>
                      {t(row.help)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <output className="tp-share-status" data-tone={status?.tone}>
            {status ? (
              <>
                <TpIcon name={status.tone === "done" ? "check" : "info"} size="sm" />
                <span>{t(status.key)}</span>
              </>
            ) : null}
          </output>
          <p className="tp-help tp-share-private" id={`${id}-private`}>
            <TpIcon name="lock" size="sm" />
            <span>{t("share.private")}</span>
          </p>
        </div>
      </section>
    </>
  );
}
