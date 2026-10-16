"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { StudyBlock } from "./study-block";
import { noteIdAround, studyBlockHref, studyBlockSummary } from "./study-block";

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
        <a className="tp-btn tp-btn--secondary tp-btn--sm" data-action="study-block" href={href}>
          {t("st.block.study")}
        </a>
      </div>
    </div>
  );
}
