/**
 * @screen: about
 * @source: docs/design/v3/screens/web/about.html
 * @summary: Why Tempo exists, five promises, who it is for, and one action: Ask to join.
 * @auth: unchanged (see proxy.ts; the public-route list is an open owner decision)
 */
"use client";

import Link from "next/link";
import { MarketingChrome } from "@/components/marketing-pages/MarketingChrome";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";

const PROMISES: readonly { title: MessageKey; body: MessageKey }[] = [
  { title: "ab.p1.t", body: "ab.p1.b" },
  { title: "ab.p2.t", body: "ab.p2.b" },
  { title: "ab.p3.t", body: "ab.p3.b" },
  { title: "ab.p4.t", body: "ab.p4.b" },
  { title: "ab.p5.t", body: "ab.p5.b" },
];

export default function Page() {
  const { t } = useLocale();
  return (
    <MarketingChrome
      current="about"
      mainClassName="ab-main"
      offline={{ title: t("ab.offline.title"), body: t("ab.offline.body"), className: "ab-offline" }}
    >
      <section className="tp-hero" data-component="Hero" aria-labelledby="ab-title">
        <span className="tp-eyebrow">{t("ab.eyebrow")}</span>
        <h1 className="tp-hero__title" id="ab-title">
          {t("ab.title")}
        </h1>
        <p className="tp-hero__lede">{t("ab.lede")}</p>
      </section>

      <section className="ab-block" aria-labelledby="why-title">
        <h2 className="tp-h2" id="why-title">
          {t("ab.why.title")}
        </h2>
        <div className="ab-prose">
          <p>{t("ab.why.p1")}</p>
          <p>{t("ab.why.p2")}</p>
          <p>{t("ab.why.p3")}</p>
        </div>
      </section>

      <section className="ab-block" aria-labelledby="pr-title">
        <h2 className="tp-h2" id="pr-title">
          {t("ab.pr.title")}
        </h2>
        <ul className="ab-principles">
          {PROMISES.map((promise) => (
            <li className="tp-card" data-component="Card" key={promise.title}>
              <div className="tp-card__head">
                <h3 className="tp-card__title">{t(promise.title)}</h3>
              </div>
              <p>{t(promise.body)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="ab-block" aria-labelledby="not-title">
        <h2 className="tp-h2" id="not-title">
          {t("ab.not.title")}
        </h2>
        <div className="ab-prose">
          <p>{t("ab.not.p1")}</p>
        </div>
        <div>
          <Link className="tp-btn tp-btn--primary" href="/sign-up">
            {t("mk.join")}
          </Link>
        </div>
      </section>
    </MarketingChrome>
  );
}
