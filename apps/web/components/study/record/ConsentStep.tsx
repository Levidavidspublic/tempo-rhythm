"use client";

import { TpIcon } from "@/components/tempo/TpIcon";
import type { RecordLang } from "../../../../../packages/core/record";
import type { LiveIssue } from "./useLiveWords";
import type { RecordCopy } from "./recordFlow";

/** Live words are off for this reason (null while loading or when they're available). */
export type OffReason = Exclude<LiveIssue, null> | "pending" | null;

/**
 * Step 1: what happens, the language of the talk, and consent. No consent, no microphone: Start
 * stays disabled (and its handler checks again) until the box is ticked. When live words are off,
 * the screen says why in words and typing is the one primary action.
 */
export function ConsentStep({
  copy,
  talkLang,
  onTalkLang,
  consent,
  onConsent,
  liveReady,
  offReason,
  checking = false,
  onStart,
  onType,
}: {
  copy: RecordCopy;
  talkLang: RecordLang;
  onTalkLang: (lang: RecordLang) => void;
  consent: boolean;
  onConsent: (value: boolean) => void;
  /** Live words can start (keys, language and minutes all fine). */
  liveReady: boolean;
  offReason: OffReason;
  /** Live words' availability is still being read: said in words, so it never looks like "off". */
  checking?: boolean;
  onStart: () => void;
  onType: () => void;
}) {
  const langs: { value: RecordLang; label: string }[] = [
    { value: "en", label: "English" },
    { value: "he", label: "עברית" },
  ];
  return (
    <section className="tp-surface tp-rec-step" aria-labelledby="rec-consent-h" data-step="consent">
      <h2 className="tp-section__title" id="rec-consent-h">
        {copy("rec.consent.h")}
      </h2>
      <ul className="tp-rec-facts">
        <li>
          <TpIcon name="text" size="sm" />
          <span>{copy("rec.consent.p1")}</span>
        </li>
        <li>
          <TpIcon name="lock" size="sm" />
          <span>{copy("rec.consent.p2")}</span>
        </li>
        <li>
          <TpIcon name="page" size="sm" />
          <span>{copy("rec.consent.p3")}</span>
        </li>
      </ul>

      <div className="tp-field">
        <span className="tp-label" id="rec-lang-label">
          {copy("rec.consent.lang")}
        </span>
        <div className="tp-segmented" role="radiogroup" aria-labelledby="rec-lang-label">
          {langs.map((option) => (
            // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
            <button
              key={option.value}
              type="button"
              role="radio"
              className="tp-seg__opt"
              aria-checked={talkLang === option.value}
              lang={option.value}
              onClick={() => onTalkLang(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {checking ? (
        <output className="tp-help" data-rec-checking="">
          {copy("rec.checking")}
        </output>
      ) : null}

      {offReason ? (
        <output className="tp-notice" data-tone="info" data-component="Notice">
          <span className="tp-notice__icon">
            <TpIcon name="info" />
          </span>
          <span className="tp-notice__text">
            <span className="tp-notice__title">{copy("rec.off.title")}</span>
            <span>{copy(`rec.off.${offReason}`)}</span>
          </span>
        </output>
      ) : null}

      {liveReady ? (
        <label className="tp-choice" htmlFor="rec-consent">
          <input
            id="rec-consent"
            className="tp-checkbox"
            type="checkbox"
            checked={consent}
            onChange={(event) => onConsent(event.target.checked)}
          />
          <span className="tp-choice__text">
            <span>{copy("rec.consent.check")}</span>
            <span className="tp-choice__hint">{copy("rec.consent.checkHint")}</span>
          </span>
        </label>
      ) : null}

      <div className="tp-form__actions">
        {liveReady ? (
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            disabled={!consent}
            aria-describedby={consent ? undefined : "rec-consent-need"}
            onClick={() => {
              if (consent) onStart();
            }}
          >
            <TpIcon name="mic" size="sm" />
            <span>{copy("rec.consent.start")}</span>
          </button>
        ) : null}
        <button type="button" className={liveReady ? "tp-btn tp-btn--secondary" : "tp-btn tp-btn--primary"} onClick={onType}>
          <TpIcon name="edit" size="sm" />
          <span>{copy("rec.consent.type")}</span>
        </button>
      </div>
      {liveReady && !consent ? (
        <p className="tp-help" id="rec-consent-need">
          {copy("rec.consent.need")}
        </p>
      ) : null}
    </section>
  );
}
