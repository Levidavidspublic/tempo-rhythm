/**
 * @screen: changelog
 * @source: docs/design/v3/screens/web/changelog.html
 * @summary: What's new, newest first; each change is New, Better or Fixed. Entries: lib/changelog.ts.
 * @auth: unchanged (see proxy.ts; the public-route list is an open owner decision)
 */
"use client";

import Link from "next/link";
import { MarketingChrome } from "@/components/marketing-pages/MarketingChrome";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { CHANGELOG, type ChangeKind, changelogDate, sortedEntries } from "@/lib/changelog";
import type { MessageKey } from "@/lib/i18n";

const KIND: Record<ChangeKind, { label: MessageKey; icon: TpIconName; tone?: "info" | "done" }> = {
  new: { label: "cl.k.new", icon: "sparkle", tone: "info" },
  better: { label: "cl.k.better", icon: "arrow" },
  fixed: { label: "cl.k.fixed", icon: "check", tone: "done" },
};

export default function Page() {
  const { t, lang } = useLocale();
  return (
    <MarketingChrome
      current="changelog"
      mainClassName="cl-main"
      offline={{ title: t("cl.offline.title"), body: t("cl.offline.body"), className: "cl-offline" }}
    >
      <section className="tp-hero" data-component="Hero" aria-labelledby="cl-title">
        <span className="tp-eyebrow">{t("cl.eyebrow")}</span>
        <h1 className="tp-hero__title" id="cl-title">
          {t("cl.title")}
        </h1>
        <p className="tp-hero__lede">{t("cl.lede")}</p>
      </section>

      <ol className="cl-list">
        {sortedEntries(CHANGELOG).map((entry) => {
          const headId = `v${entry.version.replace(/\W/g, "-")}`;
          return (
            <li key={entry.version}>
              <article className="cl-entry" aria-labelledby={headId} data-component="ChangelogEntry">
                <div className="cl-entry__head">
                  <h2 className="tp-h2" id={headId}>
                    <span>{t("cl.version")}</span> <span className="tp-num">{entry.version}</span>
                  </h2>
                  <time className="tp-muted tp-num" dateTime={entry.date}>
                    {changelogDate(entry.date, lang)}
                  </time>
                </div>
                <ul className="cl-changes">
                  {entry.changes.map((change) => {
                    const kind = KIND[change.kind];
                    return (
                      <li className="cl-change" key={change.text}>
                        <span className="tp-badge" data-tone={kind.tone}>
                          <TpIcon name={kind.icon} size="sm" />
                          <span>{t(kind.label)}</span>
                        </span>
                        <span>{t(change.text)}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            </li>
          );
        })}
      </ol>

      <div className="cl-foot">
        <p className="tp-muted">{t("cl.foot")}</p>
        <Link className="tp-btn tp-btn--primary" href="/sign-up">
          {t("mk.join")}
        </Link>
      </div>
    </MarketingChrome>
  );
}
