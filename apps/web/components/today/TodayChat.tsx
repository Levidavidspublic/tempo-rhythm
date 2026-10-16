"use client";

import Link from "next/link";
import { CoachConversation } from "@/components/coach/CoachChat";
import { useCoachPageId } from "@/components/coach/CoachPage";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";

/**
 * Keeps the coach's turns and proposal cards inside the chat column on a phone (390 px, en and
 * he). The thread is a one-column grid, and that column grows to the min-content of its widest
 * row. An OpenUI card sits in a plain wrapper div, so a saved card's last row (the words, Open, and
 * Undo with its countdown, on one unwrapped line) made the column wider than the thread, and the
 * thread scrolled sideways. These rules hold for every row of Today's thread:
 * - each row may be narrower than its content, so the column never grows past the thread;
 * - a long word breaks where it must instead of pushing the column wider;
 * - a card's last row wraps: the words keep about 12rem and the buttons go below them.
 */
const TODAY_CHAT_FIT = [
  "[&_.tp-coach-thread]:wrap-anywhere",
  "[&_.tp-coach-thread>*]:min-w-0",
  "[&_.tp-proposal>p]:flex-wrap",
  "[&_.tp-proposal>p>span]:grow",
  "[&_.tp-proposal>p>span]:basis-48",
] as const;

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
    <section
      className={`tp-surface tp-today-chat ${TODAY_CHAT_FIT.join(" ")}`}
      data-component="TodayChat"
      aria-labelledby="today-chat-title"
    >
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
