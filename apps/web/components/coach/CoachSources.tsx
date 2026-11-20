"use client";

import { Renderer } from "@openuidev/react-lang";
import { useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { sourceRows, sourcesProgram } from "@/lib/coach-sources";
import { useOpenUiFlag } from "@/lib/openui/useOpenUiFlag";
import { CoachSourcesTContext, coachSourcesLibrary } from "./openui/CoachSourcesLibrary";
import { OpenUiBoundary } from "./openui/OpenUiProposal";
import { SourcesCard } from "./SourcesCard";

/**
 * The sources card under a coach reply, when the reply searched the web (`messages.sources`,
 * #976). Nothing renders for a reply without sources. With the `openui` flag on the card is drawn
 * through OpenUI; with `?openui=off`, or if OpenUI can't draw it, the direct card renders instead.
 */
export function CoachSources({ content, sources }: { content: string; sources?: unknown }) {
  const { t } = useLocale();
  const openUi = useOpenUiFlag();
  const [broken, setBroken] = useState(false);
  const rows = useMemo(() => sourceRows(sources, content), [sources, content]);
  const program = useMemo(() => sourcesProgram(rows), [rows]);

  if (rows.length === 0) return null;
  if (!openUi || broken) return <SourcesCard t={t} rows={rows} />;
  return (
    <CoachSourcesTContext.Provider value={t}>
      <OpenUiBoundary onError={() => setBroken(true)}>
        <Renderer
          response={program}
          library={coachSourcesLibrary}
          onError={(errors) => {
            if (errors.length > 0) setBroken(true);
          }}
        />
      </OpenUiBoundary>
    </CoachSourcesTContext.Provider>
  );
}
