"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
import type { Lang } from "@/lib/i18n";
import { useOnline } from "@/lib/useOnline";

type Current = "about" | "changelog";

/**
 * LanguageSwitch (tempo.css): links with hreflang + lang; the current one has
 * aria-current="true". A click switches in place (LocaleProvider keeps the choice on this device).
 */
function LanguageSwitch({ long }: { long: boolean }) {
  const { t, lang, setLang } = useLocale();
  const pick = (next: Lang) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setLang(next);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: the v3 LanguageSwitch is a labelled group of two links, not a form field set
    <div className="tp-lang-switch" data-component="LanguageSwitch" role="group" aria-label={t("mk.lang")}>
      <a href="?lang=en" hrefLang="en" lang="en" aria-current={lang === "en" ? "true" : undefined} onClick={pick("en")}>
        {long ? "English" : "EN"}
      </a>
      <a href="?lang=he" hrefLang="he" lang="he" aria-current={lang === "he" ? "true" : undefined} onClick={pick("he")}>
        {long ? "עברית" : "עב"}
      </a>
    </div>
  );
}

/**
 * The marketing pages' header and footer (docs/design/v3/screens/web/about.html,
 * changelog.html): SiteHeader, the page's own main, SiteFooter. Solid, not glass.
 */
export function MarketingChrome({
  current,
  mainClassName,
  offline,
  children,
}: {
  current: Current;
  mainClassName: string;
  /** The page's offline notice (shown only while offline). */
  offline: { title: string; body: string; className: string };
  children: ReactNode;
}) {
  const { t } = useLocale();
  const online = useOnline();
  return (
    <>
      {/* No app shell here, so the page draws the icon sprite itself. */}
      <TpIconSprite />
      <a className="tp-skip" href="#main">
        {t("mk.skip")}
      </a>
      <header className="tp-site-header" data-component="SiteHeader">
        <div className="tp-container tp-site-header__inner">
          <Link className="tp-site-header__brand" href="/">
            {t("mk.brand")}
          </Link>
          <nav className="tp-site-nav" aria-label={t("mk.nav")}>
            <Link className="tp-site-link tp-site-link--wide" href="/#features">
              {t("mk.what")}
            </Link>
            <Link className="tp-site-link tp-site-link--wide" href="/#pricing">
              {t("mk.pricing")}
            </Link>
            <Link
              className="tp-site-link tp-site-link--wide"
              href="/about"
              aria-current={current === "about" ? "page" : undefined}
            >
              {t("mk.about")}
            </Link>
            <Link className="tp-site-link" href="/sign-in">
              {t("mk.signin")}
            </Link>
            <LanguageSwitch long={false} />
          </nav>
        </div>
      </header>

      <main id="main" className={`tp-container ${mainClassName}`} tabIndex={-1}>
        {online ? null : (
          <output className={`tp-notice tp-offline ${offline.className}`} data-tone="caution" data-component="StateOffline">
            <span className="tp-notice__icon">
              <TpIcon name="wifi-off" />
            </span>
            <span className="tp-notice__text">
              <span className="tp-notice__title">{offline.title}</span> <span>{offline.body}</span>
            </span>
          </output>
        )}
        {children}
      </main>

      <footer className="tp-site-footer" data-component="SiteFooter">
        <div className="tp-container tp-site-footer__inner">
          <nav className="tp-site-footer__links" aria-label={t("mk.foot")}>
            <Link className="tp-site-link" href="/terms">
              {t("mk.terms")}
            </Link>
            <Link className="tp-site-link" href="/privacy">
              {t("mk.privacy")}
            </Link>
            <Link className="tp-site-link" href="/contact">
              {t("mk.contact")}
            </Link>
            <Link
              className="tp-site-link"
              href="/changelog"
              aria-current={current === "changelog" ? "page" : undefined}
            >
              {t("mk.changelog")}
            </Link>
          </nav>
          <LanguageSwitch long />
          <p className="tp-site-footer__small">{t("mk.small")}</p>
        </div>
      </footer>
    </>
  );
}
