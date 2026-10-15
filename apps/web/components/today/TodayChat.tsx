"use client";

import Link from "next/link";
import { CoachConversation } from "@/components/coach/CoachChat";
import { useCoachPageId } from "@/components/coach/CoachPage";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";

/**
 * The coach on Today (weekend alpha run, Phase 3: chat as the front door). The same conversation
 * as /coach and the coach panel, with today's page and today's open tasks as its context, so "what
 * order should I do these in?" gets a decision card that can be saved to this page. The newest
 * turns only; the whole thread is one link away. The coach only proposes: nothing changes until
 * the person says yes.
 */
export function TodayChat() {
  const { t } = useLocale();
  // Today's page registers itself while it is on screen (useRegisterCoachPage in PageEditorView).
  const pageId = useCoachPageId();
  return (
    <section className="tp-surface tp-today-chat" data-component="TodayChat" aria-labelledby="today-chat-title">
      <header className="tp-today-chat__head">
        <TpIcon name="coach" />
        <div className="tp-today-chat__title">
          <h2 id="today-chat-title">{t("today.chat.title")}</h2>
          <p>{t("today.chat.sub")}</p>
        </div>
        <Link className="tp-btn tp-btn--ghost tp-btn--sm" href="/coach">
          {t("today.chat.full")}
        </Link>
      </header>
      <CoachConversation variant="today" pageId={pageId} />
    </section>
  );
}
