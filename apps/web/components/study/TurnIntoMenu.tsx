"use client";

import type { StudyBlockType } from "@tempo/utils";
import Link from "next/link";
import { studyHref } from "@/components/ingest";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import { KIND_ICON } from "./labels";

/**
 * S25 TurnIntoMenu: three items in the page menu (PageEditorView's PageMenu): Turn into
 * flashcards / a quiz / a practice test. Each opens the preview at /study/new; nothing is made
 * until the person accepts there. The items are `role="menuitem"` links, so the page menu's own
 * keyboard handling (arrows, Escape, Tab) reaches them like its other items.
 */

export type TurnIntoItem = { kind: StudyBlockType; href: string; label: MessageKey };

const LABEL: Record<StudyBlockType, MessageKey> = {
  flashcards: "st.turn.flashcards",
  quiz: "st.turn.quiz",
  test: "st.turn.test",
};

export function turnIntoItems(noteId: string): TurnIntoItem[] {
  return (["flashcards", "quiz", "test"] as const).map((kind) => ({
    kind,
    href: studyHref(noteId, kind),
    label: LABEL[kind],
  }));
}

export function TurnIntoMenu({ noteId, onNavigate }: { noteId: string; onNavigate?: () => void }) {
  const { t } = useLocale();
  return (
    <>
      <div className="tp-menu__label" role="presentation" data-component="TurnIntoMenu">
        {t("st.turn.label")}
      </div>
      {turnIntoItems(noteId).map((item) => (
        <Link
          key={item.kind}
          className="tp-menu__item"
          role="menuitem"
          href={item.href}
          data-action={`turn-into-${item.kind}`}
          onClick={onNavigate}
        >
          <TpIcon name={KIND_ICON[item.kind]} size="sm" />
          {t(item.label)}
        </Link>
      ))}
    </>
  );
}
