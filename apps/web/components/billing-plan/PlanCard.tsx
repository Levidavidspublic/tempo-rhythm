"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import { type BillingInterval, formatUsd, type Tier, type TierId, tierPrice } from "@/lib/settings/billing";

/** Shape returned by `api.users.getMyPlan` when someone is signed in. */
export type CurrentPlan = {
  plan: "none" | "trial" | "basic" | "pro" | "max";
  status: "inactive" | "active" | "grace" | "cancelled";
  label: string;
  betaAccess: "none" | "tester" | "founder";
  entitlementTier: "none" | "basic" | "pro" | "max" | "god";
  userType: "free" | "paid";
  isBeta: boolean;
};

type Feature = { icon: TpIconName; text: MessageKey } | { icon: TpIconName; liveMinutes: number };

const NAME: Record<TierId, MessageKey> = {
  trial: "set.billing.trial",
  basic: "set.billing.basic",
  pro: "set.billing.pro",
  max: "set.billing.max",
};

const DESC: Record<TierId, MessageKey> = {
  trial: "set.billing.trialDesc",
  basic: "set.billing.basicDesc",
  pro: "set.billing.proDesc",
  max: "set.billing.maxDesc",
};

const PER = { "3w": "set.billing.per3w", month: "set.billing.perMonth", year: "set.billing.perYear" } as const;

function featuresFor(tier: Tier): Feature[] {
  if (tier.id === "trial") {
    return [
      { icon: "check", text: "set.billing.fBasicAll" },
      { icon: "check", text: "set.billing.fTrialThen" },
      { icon: "bell", text: "set.billing.fTrialNote" },
    ];
  }
  if (tier.id === "basic") {
    return [
      { icon: "check", text: "set.billing.fPages" },
      { icon: "check", text: "set.billing.fCoach" },
      { icon: "check", text: "set.billing.fPtt" },
    ];
  }
  return [
    { icon: "check", text: "set.billing.fBasicAll" },
    { icon: "phone", liveMinutes: tier.liveVoiceMinutes ?? 0 },
  ];
}

/**
 * One v3 TierCard (billing.html). Read-only: there is no checkout yet, so where the design has
 * "Choose …" the card says when choosing opens. Nothing here starts a purchase.
 */
export function PlanCard({
  tier,
  interval,
  current,
  early,
}: {
  tier: Tier;
  interval: BillingInterval;
  current: boolean;
  early: boolean;
}) {
  const { t } = useLocale();
  const price = tierPrice(tier, interval);
  const nameId = `t-${tier.id}`;
  let cta: MessageKey | null = "set.billing.chooseLater";
  if (tier.id === "trial") cta = "set.billing.trialCta";
  else if (current) cta = early ? "set.billing.maxCta" : null;

  return (
    <article className="tp-tier" data-current={current ? "true" : undefined} aria-labelledby={nameId}>
      <div className="tp-tier__head">
        <h3 className="tp-tier__name" id={nameId}>
          {t(NAME[tier.id])}
        </h3>
        {current ? (
          <span className="tp-badge" data-tone="done" data-component="Badge">
            <TpIcon name="check" size="sm" />
            <span>{t("set.billing.yours")}</span>
          </span>
        ) : null}
      </div>
      <p className="tp-tier__desc">{t(DESC[tier.id])}</p>
      <p className="tp-tier__price od-nowrap">
        <span className="tp-tier__amount tp-num">{formatUsd(price.amount)}</span>
        <span className="tp-tier__per">{t(PER[price.per])}</span>
      </p>
      <ul className="tp-tier__features">
        {featuresFor(tier).map((feature) => (
          <li key={"text" in feature ? feature.text : "live"}>
            <TpIcon name={feature.icon} size="sm" />
            {"text" in feature ? (
              <span>{t(feature.text)}</span>
            ) : (
              <span>
                <span>{t("set.billing.fLive1")}</span> <span className="tp-num od-nowrap">{feature.liveMinutes}</span>{" "}
                <span>{t("set.billing.fLive2")}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {cta ? <p className="tp-tier__cta tp-help">{t(cta)}</p> : null}
    </article>
  );
}
