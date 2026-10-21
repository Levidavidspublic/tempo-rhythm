"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";

/** The pages in the v3 rail's Settings group (settings-profile.html and its siblings). */
const PAGES: readonly { href: string; icon: TpIconName; label: MessageKey; sub: MessageKey }[] = [
  { href: "/settings/profile", icon: "user", label: "set.nav.profile", sub: "set.profile.sub" },
  { href: "/settings/preferences", icon: "settings", label: "set.nav.prefs", sub: "set.prefs.sub" },
  { href: "/settings/integrations", icon: "link", label: "set.nav.integ", sub: "set.integ.sub" },
  { href: "/settings/privacy", icon: "shield", label: "set.nav.privacy", sub: "set.privacy.sub" },
  { href: "/settings/memory", icon: "memory", label: "nav.memory", sub: "set.nav.memorySub" },
  { href: "/settings/nags", icon: "nag", label: "nav.nags", sub: "set.nav.nagsSub" },
  { href: "/billing", icon: "card", label: "set.nav.billing", sub: "set.billing.sub" },
  { href: "/notifications", icon: "bell", label: "set.nav.notif", sub: "set.nav.notifSub" },
  { href: "/ask-founder", icon: "mail", label: "set.nav.founder", sub: "set.nav.founderSub" },
];

/** /settings: one list of every settings page, built from the v3 ListRow and SettingsSection. */
export function SettingsIndex() {
  const { t } = useLocale();
  return (
    <>
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("set.hub.title")}</h1>
          <p className="tp-pagehead__sub">{t("set.hub.sub")}</p>
        </div>
      </header>
      <nav className="tp-settings-section" aria-label={t("set.hub.title")} data-component="SettingsSection">
        <ul className="tp-list" data-component="ListRow">
          {PAGES.map((page) => (
            <li key={page.href}>
              <Link className="tp-list-row" href={page.href}>
                <span className="tp-list-row__icon">
                  <TpIcon name={page.icon} size="sm" />
                </span>
                <span className="tp-list-row__body">
                  <span className="tp-list-row__title">{t(page.label)}</span>
                  <span className="tp-list-row__meta">{t(page.sub)}</span>
                </span>
                <span className="tp-list-row__end">
                  <TpIcon name="chevron" size="sm" flip />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
