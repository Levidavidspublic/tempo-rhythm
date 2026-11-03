"use client";

import type { Ref } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";

/**
 * Onboarding step 2 (docs/design/v3/screens/web/onboarding.html): what the coach should call you.
 * Optional; "Skip for now" lives in the flow's nav. The field id stays `onboarding-name`.
 */
export function NameStep({
  name,
  onNameChange,
  headingRef,
}: {
  name: string;
  onNameChange: (value: string) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { t } = useLocale();
  return (
    <section className="ob-step" aria-labelledby="s2-title">
      <div className="ob-step__head">
        <h1 className="tp-auth-card__title" id="s2-title" tabIndex={-1} ref={headingRef}>
          {t("set.onb.s2Title")}
        </h1>
        <p className="tp-auth-card__lede">{t("set.onb.s2Lede")}</p>
      </div>
      <div className="tp-field" data-component="Field">
        <label className="tp-label" htmlFor="onboarding-name">
          <span>{t("set.onb.nameLabel")}</span> <span className="tp-label__opt">{t("set.onb.optional")}</span>
        </label>
        <input
          className="tp-input"
          id="onboarding-name"
          name="name"
          type="text"
          autoComplete="given-name"
          dir="auto"
          maxLength={40}
          aria-describedby="onboarding-name-help"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <p className="tp-help" id="onboarding-name-help">
          {t("set.onb.nameHelp")}
        </p>
      </div>
    </section>
  );
}
