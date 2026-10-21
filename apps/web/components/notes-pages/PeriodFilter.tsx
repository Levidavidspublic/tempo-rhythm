"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { PeriodFilterValue } from "./filterNotes";

const TYPES = ["all", "daily", "weekly", "monthly"] as const;

/** v3 segmented filter (tempo.css .tp-segmented): one choice, kept in ?type=. */
export function PeriodFilter({ value }: { value: PeriodFilterValue }) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const choose = (type: PeriodFilterValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  // Radio group keys: one tab stop (the checked option); arrows move and choose, wrapping.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
    const next = TYPES[(index + step + TYPES.length) % TYPES.length] as PeriodFilterValue;
    choose(next);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>(`[data-type="${next}"]`)?.focus());
  };

  return (
    <div className="tp-segmented" role="radiogroup" aria-label={t("notes.typeLabel")}>
      {TYPES.map((type, index) => (
        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
        <button
          key={type}
          type="button"
          role="radio"
          data-type={type}
          className="tp-seg__opt"
          aria-checked={value === type}
          tabIndex={value === type ? 0 : -1}
          onClick={() => choose(type)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {t(`notes.type.${type}`)}
        </button>
      ))}
    </div>
  );
}
