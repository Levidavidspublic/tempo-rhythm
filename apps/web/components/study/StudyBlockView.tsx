"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { StudyBlock } from "./study-block";
import {
  listenForStudyLinks,
  noteIdAround,
  studyBlockHref,
  studyBlockSummary,
} from "./study-block";

/**
 * For the page's host (the editor around CodeMirror's study cards): follow their "Study" links
 * with the app router instead of a full reload.
 */
export function useStudyLinkNavigation() {
  const router = useRouter();
  useEffect(() => listenForStudyLinks(document, (href) => router.push(href)), [router]);
}

/** Read view of a study block: a quiet card with the kind, title, count and a "Study" link. */
export function StudyBlockView({ block }: { block: StudyBlock }) {
  const { lang, t } = useLocale();
  const { kind, count } = studyBlockSummary(block, lang);
  const ref = useRef<HTMLDivElement | null>(null);
  const [href, setHref] = useState("/study");
  // The page id comes from the page around the card (PageEditorView's data-note-id).
  useEffect(() => {
    setHref(studyBlockHref(noteIdAround(ref.current), block.id));
  }, [block.id]);
  return (
    <div className="tp-card" data-component="StudyBlock" data-kind={block.type} ref={ref}>
      <div className="tp-card__head">
        <span className="tp-card__title" dir="auto">
          {kind} · {block.data.title}
        </span>
        <span className="tp-muted tp-small">{count}</span>
        {/* next/link: a client-side move, so the page's pending autosave goes out first. */}
        <Link className="tp-btn tp-btn--secondary tp-btn--sm" data-action="study-block" href={href}>
          {t("st.block.study")}
        </Link>
      </div>
    </div>
  );
}
