"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Segmented } from "@/components/settings/controls";
import { StateLoading } from "@/components/settings/states";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { type BillingInterval, currentTier, isEarlyAccess, TIERS } from "@/lib/settings/billing";
import { type CurrentPlan, PlanCard } from "./PlanCard";

/**
 * Plan and billing (docs/design/v3/screens/web/billing.html): the current plan first, then all
 * four tiers with monthly / yearly prices, then "Before any charge".
 * Data: users.getMyPlan. Early-access accounts (beta testers and founders) have Max included.
 * Read-only: there is no checkout or cancel function, so no control here starts a purchase,
 * calls a payment provider or changes a plan.
 */
export function BillingPlan() {
  const { t } = useLocale();
  const plan = useQuery(api.users.getMyPlan, {});
  const [cycle, setCycle] = useState<BillingInterval>("month");

  if (!plan) {
    return <StateLoading label="set.billing.loading" className="bl-state" />;
  }

  const snapshot: CurrentPlan = plan;
  const early = isEarlyAccess(snapshot);
  const current = currentTier(snapshot);
  let title = t("set.billing.noneTitle");
  if (early) title = t("set.billing.earlyTitle");
  else if (current) title = t("set.billing.planTitle").replace("{tier}", t(`set.billing.${current}`));

  return (
    <>
      <section
        className="tp-notice"
        data-tone={early ? "done" : "info"}
        aria-label={t("set.billing.current")}
        data-component="BillingNotice"
      >
        <span className="tp-notice__icon">
          <TpIcon name={early ? "star" : "info"} size="sm" />
        </span>
        <span className="tp-notice__text">
          <span className="tp-notice__title">{title}</span>
          <span>{early ? t("set.billing.earlyBody") : t("set.billing.pricesBody")}</span>
        </span>
      </section>

      <section className="tp-section bl-tiers" aria-labelledby="tiers-title" data-component="Section">
        <div className="tp-section__head bl-cycle">
          <h2 className="tp-section__title" id="tiers-title">
            {t("set.billing.tiers")}
          </h2>
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
        <div className="tp-tiers" data-component="TierCard">
          {TIERS.map((tier) => (
            <PlanCard key={tier.id} tier={tier} interval={cycle} current={current === tier.id} early={early} />
          ))}
        </div>
      </section>

      <section className="tp-settings-section" aria-labelledby="notice-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="notice-title">
            {t("set.billing.bcTitle")}
          </h2>
          <p className="tp-settings-section__desc">{t("set.billing.bcDesc")}</p>
        </div>
        <div className="bl-pad">
          <ol className="bl-steps">
            <li>
              <span className="tp-num">3</span> <span>{t("set.billing.bc3d")}</span>
            </li>
            <li>
              <span className="tp-num">1</span> <span>{t("set.billing.bc1d")}</span>
            </li>
            <li>
              <span className="tp-num">1</span> <span>{t("set.billing.bc1h")}</span>
            </li>
          </ol>
          <p className="tp-help">{t("set.billing.bcWhere")}</p>
        </div>
        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.billing.payLabel")}</span>
            <span className="tp-help">{t("set.billing.payHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <TpIcon name="lock" />
          </div>
        </div>
        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.billing.qLabel")}</span>
            <span className="tp-help">{t("set.billing.qHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Link className="tp-btn tp-btn--ghost" href="/ask-founder">
              <span>{t("set.billing.qBtn")}</span>
              <TpIcon name="chevron" size="sm" flip />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
