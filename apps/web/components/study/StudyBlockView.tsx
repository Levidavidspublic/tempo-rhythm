"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import type { StudyBlock } from "./study-block";
import { studyBlockSummary } from "./study-block";

/** Read view of a study block: a quiet card with the kind, title and count. */
export function StudyBlockView({ block }: { block: StudyBlock }) {
  const { lang } = useLocale();
  const { kind, count } = studyBlockSummary(block, lang);
  return (
    <div className="tp-card" data-component="StudyBlock" data-kind={block.type}>
      <div className="tp-card__head">
        <span className="tp-card__title" dir="auto">
          {kind} · {block.data.title}
        </span>
        <span className="tp-muted tp-small">{count}</span>
      </div>
    </div>
  );
}
