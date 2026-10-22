"use client";

import Link from "next/link";
import { useState } from "react";
import { PlanCard } from "@/components/billing-plan/PlanCard";
import { LanguageSwitch } from "@/components/marketing-pages/MarketingChrome";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Segmented } from "@/components/settings/controls";
import { TpIconSprite } from "@/components/tempo/TpIcon";
import { type BillingInterval, TIERS } from "@/lib/settings/billing";

// Hebrew is machine-drafted; native review is recorded in the ticket evidence.
const COPY = {
  en: {
    title: "Plans, clearly.",
    availability: "Checkout is not open yet. No payment is collected on this page.",
    plans: "Planned pricing",
    beta: "Approved beta testers and existing testers get Max free.",
    account: "Sign up or request access",
    access: "Account access currently needs approval. Beta requests wait for approval.",
  },
  he: {
    title: "המסלולים, בצורה ברורה.",
    availability: "התשלום עדיין לא זמין. לא נגבה תשלום בעמוד הזה.",
    plans: "תמחור מתוכנן",
    beta: "בודקי בטא שאושרו והבודקים הקיימים מקבלים Max בחינם.",
    account: "הרשמה או בקשת גישה",
    access: "הגישה לחשבון עדיין דורשת אישור. בקשות בטא ממתינות לאישור.",
  },
} as const;

/** Public, read-only composition of the existing price catalog; no payment path. */
export function PublicPricing() {
  const { lang, dir, t } = useLocale();
  const [cycle, setCycle] = useState<BillingInterval>("month");
  const copy = COPY[lang];

  return (
    <div className="tp-public-pricing" lang={lang} dir={dir}>
      <style>{`
        .tp-public-pricing .tp-lang-switch a,
        .tp-public-pricing .tp-segmented .tp-seg__opt,
        .tp-public-pricing .tp-site-header__brand { min-height: var(--tp-touch); min-width: var(--tp-touch); }
      `}</style>
      <TpIconSprite />
      <a className="tp-skip" href="#pricing-main">{t("mk.skip")}</a>
      <header className="tp-site-header">
        <div className="tp-container tp-site-header__inner">
          <Link className="tp-site-header__brand" href="/">{t("mk.brand")}</Link>
          <nav className="tp-site-nav" aria-label={t("mk.nav")}>
            <Link className="tp-site-link" href="/sign-in">{t("mk.signin")}</Link>
            <LanguageSwitch long={false} />
          </nav>
        </div>
      </header>

      <main id="pricing-main" className="tp-container" tabIndex={-1} style={{ paddingBlockEnd: "var(--tp-space-16)" }}>
        <header className="tp-hero">
          <h1 className="tp-hero__title">{copy.title}</h1>
          <p className="tp-hero__lede">{copy.availability}</p>
          <p>{copy.beta}</p>
          <div className="tp-hero__actions">
            <Link className="tp-btn tp-btn--primary" href="/sign-up">{copy.account}</Link>
          </div>
          <p className="tp-hero__note">{copy.access}</p>
        </header>

        <section className="tp-section" aria-labelledby="public-pricing-tiers">
          <div className="tp-section__head bl-cycle">
            <h2 className="tp-section__title" id="public-pricing-tiers">{copy.plans}</h2>
            <Segmented<BillingInterval>
              label={t("set.billing.cycle")}
              value={cycle}
              onChange={setCycle}
              options={[
                { value: "month", label: t("set.billing.month") },
                { value: "year", label: t("set.billing.year") },
              ]}
            />
          </div>
          <div className="tp-tiers">
            {TIERS.map((tier) => <PlanCard key={tier.id} tier={tier} interval={cycle} current={false} early={false} />)}
          </div>
        </section>
      </main>

      <footer className="tp-site-footer">
        <div className="tp-container tp-site-footer__inner">
          <nav className="tp-site-footer__links" aria-label={t("mk.foot")}>
            <Link className="tp-site-link" href="/terms">{t("mk.terms")}</Link>
            <Link className="tp-site-link" href="/privacy">{t("mk.privacy")}</Link>
            <Link className="tp-site-link" href="/contact">{t("mk.contact")}</Link>
          </nav>
          <p className="tp-site-footer__small">{t("mk.small")}</p>
        </div>
      </footer>
    </div>
  );
}
