"use client";

import { type ReactNode, useId } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import { rowLabel, type SourceRow } from "@/lib/coach-sources";
import type { MessageKey } from "@/lib/i18n";

/**
 * The sources card under a coach reply that searched the web (TEMPO-B07-06): one row per cited
 * page, numbered as the reply numbers it ([1], [2]), with its title, its site and a link that opens
 * in a new tab. No page text and no search words are shown. Built on v3 classes (tp-proposal,
 * tp-list, tp-list-row), so it sits in the thread like the coach's other cards. The OpenUI library
 * (openui/CoachSourcesLibrary.tsx) draws the same markup; rows come from lib/coach-sources.ts.
 * Strings come in as `t`, so both renderers and the tests use the page's language.
 */

type T = (key: MessageKey) => string;

/** The card around the rows: a "Web" badge, the "Sources" title and the numbered list. */
export function SourcesFrame({ t, openUi = false, children }: { t: T; openUi?: boolean; children: ReactNode }) {
  const titleId = useId();
  return (
    <section
      className="tp-proposal"
      data-component="SourcesCard"
      data-renderer={openUi ? "openui" : undefined}
      aria-labelledby={titleId}
    >
      <div className="tp-proposal__head">
        <span className="tp-proposal__kind">
          <TpIcon name="globe" size="sm" />
          <span>{t("coachSources.kind")}</span>
        </span>
        <strong id={titleId}>{t("coachSources.title")}</strong>
      </div>
      <ol className="tp-list" style={{ padding: "var(--tp-space-1) var(--tp-space-2)" }}>
        {children}
      </ol>
    </section>
  );
}

/**
 * One source: its number, its title in the title's own direction, and its site left to right.
 * With a link the whole row opens the page in a new tab; without one it is plain text.
 */
export function SourceItem({
  t,
  label,
  title,
  site,
  href,
}: {
  t: T;
  label: string;
  title: string;
  site: string;
  /** A checked http(s) link (lib/coach-sources.ts safeSourceUrl), or null. */
  href: string | null;
}) {
  const body = (
    <>
      <span className="tp-list-row__icon tp-num">{label}</span>
      <span className="tp-list-row__body">
        <span className="tp-list-row__title" dir="auto" style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
          {title}
        </span>
        {site ? (
          <span className="tp-list-row__meta">
            <span dir="ltr">{site}</span>
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <li data-component="SourceRow">
      {href ? (
        <a className="tp-list-row" href={href} target="_blank" rel="noopener noreferrer">
          {body}
          <span className="tp-list-row__end">
            <TpIcon name="link" size="sm" />
          </span>
          <span className="tp-sr-only">{t("coachSources.newTab")}</span>
        </a>
      ) : (
        <div className="tp-list-row">{body}</div>
      )}
    </li>
  );
}

/** The direct card (`?openui=off`, and the fallback when OpenUI can't draw it). */
export function SourcesCard({ t, rows }: { t: T; rows: readonly SourceRow[] }) {
  return (
    <SourcesFrame t={t}>
      {rows.map((row) => (
        <SourceItem
          key={row.numbers.join("-")}
          t={t}
          label={rowLabel(row.numbers)}
          title={row.title}
          site={row.site}
          href={row.href}
        />
      ))}
    </SourcesFrame>
  );
}
