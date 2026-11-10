"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { DIAL_MAX, DIAL_MIN, dialWord } from "@/lib/settings/dial";

/**
 * v3 controls for the settings screens (tempo.css): Switch (button role="switch" with a visible
 * On / Off word), Segmented (radio group, one tab stop, arrow keys choose) and the coach Dial.
 */

export function SettingsSwitch({
  id,
  checked,
  onChange,
  labelledBy,
  describedBy,
  locked = false,
}: {
  id?: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  /** Shown but not changeable (the row says why). */
  locked?: boolean;
}) {
  const { t } = useLocale();
  return (
    <button
      id={id}
      className="tp-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-disabled={locked ? true : undefined}
      data-component="Switch"
      onClick={() => {
        if (!locked) onChange?.(!checked);
      }}
    >
      <span className="tp-switch__track" aria-hidden="true">
        <span className="tp-switch__thumb" />
      </span>
      <span className="tp-switch__state">{t(checked ? "set.on" : "set.off")}</span>
    </button>
  );
}

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: TpIconName;
  lang?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  label,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  labelledBy?: string;
  label?: string;
}) {
  // Radio group keys: one tab stop (the checked option); arrows move and choose, wrapping.
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() =>
      group?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus(),
    );
  };

  return (
    <div
      className="tp-segmented"
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      data-component="Segmented"
    >
      {options.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
        <button
          key={option.value}
          type="button"
          role="radio"
          className="tp-seg__opt"
          data-value={option.value}
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKey(event, index)}
        >
          {option.icon ? <TpIcon name={option.icon} size="sm" /> : null}
          <span lang={option.lang}>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/** The coach dial: 0–10 shown as a number and a word (quiet, steady, push). */
export function DialControl({
  id,
  label,
  value,
  onChange,
  describedBy,
  children,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (next: number) => void;
  describedBy?: string;
  children?: ReactNode;
}) {
  const { t } = useLocale();
  const word = t(`set.dial.${dialWord(value)}`);
  return (
    <div className="tp-dial" data-component="Dial">
      <div className="tp-dial__head">
        <label className="tp-label" htmlFor={id}>
          {label}
        </label>
        <span className="tp-dial__value">
          <span className="tp-dial__num tp-num">{value}</span>
          <span className="tp-dial__of">{t("set.dial.of")}</span>
          <span className="tp-dial__word">{word}</span>
        </span>
      </div>
      <input
        className="tp-slider"
        id={id}
        type="range"
        min={DIAL_MIN}
        max={DIAL_MAX}
        step={1}
        value={value}
        aria-describedby={describedBy}
        aria-valuetext={`${value}, ${word}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="tp-dial__scale" aria-hidden="true">
        <span>
          <span className="tp-num">0</span> <span>{t("set.dial.quiet")}</span>
        </span>
        <span>{t("set.dial.steady")}</span>
        <span>
          <span>{t("set.dial.push")}</span> <span className="tp-num">10</span>
        </span>
      </div>
      {children}
    </div>
  );
}
