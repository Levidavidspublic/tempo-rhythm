"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { StateLoading, StateOffline } from "@/components/settings/states";
import { TpIcon } from "@/components/tempo/TpIcon";
import { StateSignedOut } from "@/components/you/ScreenStates";
import { api } from "@/convex/_generated/api";
import { formatUsd, isEarlyAccess, isOnTrial, TIERS } from "@/lib/settings/billing";

const BASIC_MONTHLY = TIERS.find((tier) => tier.id === "basic")?.monthly ?? 10;

/** The card's brand row (trial-end.html), also on the loading card so it never looks blank. */
function TrialBrand() {
  return (
    <div className="tp-auth-card__brand">
      <span className="tp-rail__mark" aria-hidden="true">
        T
      </span>
      <span>Tempo</span>
    </div>
  );
}

/**
 * Trial ending (docs/design/v3/screens/web/trial-end.html), in the AuthCard on the bare layout.
 * Data: users.getMyPlan. Someone on the $1 trial sees what happens next and the price after.
 * There is no backend to continue or cancel a trial (and no trial end date), so the card says
 * that plainly and points to every plan and to the founder; nothing here charges or changes a
 * plan. Everyone else (early access has Max) sees a calm "not on a trial" panel.
 */
export function TrialEnd() {
  const { t } = useLocale();
  const plan = useQuery(api.users.getMyPlan, {});

  // undefined: still loading. null: no signed-in account, so say how to get back in.
  if (plan === undefined || plan === null) {
    return (
      <div className="tp-auth-card" data-component="AuthCard">
        <TrialBrand />
        {plan === undefined ? (
          <StateLoading label="set.trial.loading" rows={3} />
        ) : (
          <StateSignedOut body={t("set.trial.signedOut")} />
        )}
      </div>
    );
  }

  return (
    <div className="tp-auth-card" data-component="AuthCard">
      <TrialBrand />

      <StateOffline title="set.trial.offTitle" body="set.trial.offBody" />

      {isOnTrial(plan) ? (
        <div className="te-confirm" id="te-choose">
          <h1 className="tp-auth-card__title">{t("set.trial.title")}</h1>
          <p className="tp-auth-card__lede">{t("set.trial.lede")}</p>

          <dl className="te-facts">
            <div className="te-fact tp-setting-row">
              <dt className="tp-strong">{t("set.trial.kThen")}</dt>
              <dd>{t("set.trial.vThen")}</dd>
            </div>
            <div className="te-fact tp-setting-row">
              <dt className="tp-strong">{t("set.trial.kPrice")}</dt>
              <dd className="od-nowrap">
                <span className="tp-num">{formatUsd(BASIC_MONTHLY)}</span> <span>{t("set.trial.vMonth")}</span>
              </dd>
            </div>
          </dl>

          <div className="tp-notice" data-tone="info" data-component="Notice">
            <span className="tp-notice__icon">
              <TpIcon name="info" size="sm" />
            </span>
            <span className="tp-notice__text">
              <span className="tp-notice__title">{t("set.trial.nyTitle")}</span>
              <span>{t("set.trial.nyBody")}</span>
            </span>
          </div>

          <div className="te-actions">
            <Link className="tp-btn tp-btn--secondary tp-btn--block" href="/billing">
              <span>{t("set.trial.plans")}</span>
            </Link>
          </div>

          <p className="tp-auth-card__foot">{t("set.trial.foot")}</p>
          <p className="tp-auth-card__foot">
            <Link href="/ask-founder">{t("set.trial.ask")}</Link>
          </p>
        </div>
      ) : (
        <div className="tp-status-panel" data-tone="done" data-component="StatusPanel">
          <span className="tp-status-panel__icon">
            <TpIcon name="check" size="lg" />
          </span>
          <h1 className="tp-status-panel__title">{t("set.trial.noneTitle")}</h1>
          <p className="tp-status-panel__body">
            {t(isEarlyAccess(plan) ? "set.trial.noneEarly" : "set.trial.noneBody")}
          </p>
          <div className="tp-status-panel__actions">
            <Link className="tp-btn tp-btn--secondary" href="/today">
              <span>{t("set.trial.today")}</span>
            </Link>
            <Link className="tp-btn tp-btn--ghost" href="/billing">
              <span>{t("set.trial.plans")}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
