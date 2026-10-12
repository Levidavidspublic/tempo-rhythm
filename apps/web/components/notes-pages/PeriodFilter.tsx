"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { PeriodFilterValue } from "./filterNotes";

/** v3 segmented filter (tempo.css .tp-segmented): one choice, kept in ?type=. */
export function PeriodFilter({ value }: { value: PeriodFilterValue }) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="tp-segmented" role="radiogroup" aria-label={t("notes.typeLabel")}>
      {(["all", "daily", "weekly", "monthly"] as const).map((type) => (
        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
        <button
          key={type}
          type="button"
          role="radio"
          className="tp-seg__opt"
          aria-checked={value === type}
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("type", type);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }}
        >
          {t(`notes.type.${type}`)}
        </button>
      ))}
    </div>
  );
}
