"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { ScreenBoundary, StateError, useOnline, useSignedIn } from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import { dayStart, type HubData } from "./hub";
import { HubHeader, ReviewHubView } from "./ReviewHubView";

/**
 * S19 ReviewHub (/study): one focal card ("12 cards due · Start review", the one primary action),
 * new cards waiting and today's reviews in words (no streaks, points or badges), then every set as
 * a ListRow grouped by kind with its due count or last score, and the other ways in: plan back
 * from a deadline, record a lecture, bring in material.
 */
export function ReviewHub() {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--narrow tp-study-stack" data-component="PageLayout">
          <HubHeader t={t} />
          <StateError title={t("st.error")} onRetry={retry} />
        </div>
      )}
    >
      <ReviewHubData />
    </ScreenBoundary>
  );
}

function ReviewHubData() {
  const signedIn = useSignedIn();
  const online = useOnline();
  const [dayStartMs] = useState(() => dayStart(Date.now()));
  const hub = useQuery(api.study.hub, signedIn === "ready" ? { dayStartMs } : "skip");
  if (signedIn === "signedOut") return <ReviewHubView hub={undefined} online={online} signedOut />;
  return <ReviewHubView hub={hub as HubData | undefined} online={online} />;
}
