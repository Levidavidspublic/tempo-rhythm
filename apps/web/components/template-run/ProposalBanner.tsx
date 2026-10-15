"use client";

import { useQuery } from "convex/react";
import { useRef } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";

type PeriodType = "daily" | "weekly" | "monthly" | "none";
type Proposal = { templateId: string; name: string; reason: string };

export function ProposalBanner({ periodType, title }: { periodType: PeriodType; title: string }) {
  const { t } = useLocale();
  const trimmed = title.trim();
  const proposal = useQuery(
    api.templates.proposeForPage,
    trimmed.length > 0 ? { periodType, title: trimmed } : { periodType }
  );
  const kept = useRef<{ periodType: PeriodType; proposal: Proposal | null } | null>(null);
  if (proposal !== undefined) {
    kept.current = { periodType, proposal };
  }
  const visible =
    proposal !== undefined
      ? proposal
      : kept.current?.periodType === periodType
        ? kept.current.proposal
        : undefined;

  if (visible === undefined) {
    return <output className="tp-small tp-muted">{t("tplRun.checking")}</output>;
  }
  if (visible === null) {
    return null;
  }

  return (
    <aside aria-label="Proposal" className="tp-notice" data-tone="info">
      <span className="tp-notice__text">
        <span className="tp-notice__title">{t("tplRun.why")}</span>
        <span dir="auto">{visible.reason}</span>
      </span>
    </aside>
  );
}
