"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { createContext, useContext } from "react";
import { z } from "zod/v4";
import { safeSourceUrl } from "@/lib/coach-sources";
import { type MessageKey, translate } from "@/lib/i18n";
import { SourceItem, SourcesFrame } from "../SourcesCard";

/**
 * The OpenUI library for the sources card under a coach reply that searched the web (flag
 * `openui`, lib/openui/coach-flag.ts). Its components draw the same markup as the direct card
 * (../SourcesCard.tsx), so both look and behave the same. Programs come from
 * lib/coach-sources.ts `sourcesProgram`, built from the stored sources. The card has no actions:
 * its links are plain links, and each one is checked again here before it is drawn.
 */

/** The page language's strings, handed in by ../CoachSources.tsx. */
export const CoachSourcesTContext = createContext<(key: MessageKey) => string>((key) => translate("en", key));

const SourceRow = defineComponent({
  name: "SourceRow",
  description: "One web page the reply cites: its [n] number, title, site and link.",
  props: z.object({
    label: z.string(),
    title: z.string(),
    site: z.string(),
    href: z.string().optional(),
  }),
  component: ({ props }) => {
    const t = useContext(CoachSourcesTContext);
    return <SourceItem t={t} label={props.label} title={props.title} site={props.site} href={safeSourceUrl(props.href)} />;
  },
});

const SourcesCard = defineComponent({
  name: "SourcesCard",
  description: "The web pages a coach reply cites, numbered as the reply numbers them.",
  props: z.object({ rows: z.array(SourceRow.ref) }),
  component: ({ props, renderNode }) => {
    const t = useContext(CoachSourcesTContext);
    return (
      <SourcesFrame t={t} openUi>
        {renderNode(props.rows)}
      </SourcesFrame>
    );
  },
});

export const coachSourcesLibrary = createLibrary({
  components: [SourcesCard, SourceRow],
  root: "SourcesCard",
});
