"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { Lang } from "@/lib/i18n";
import { en, he, type IngestCopyKey } from "@/lib/i18n-groups/ingest";

export type IngestT = (key: IngestCopyKey, vars?: Record<string, string | number>) => string;

/** Look up IngestSheet copy in a language, filling `{name}` style slots. */
export function ingestCopy(lang: Lang): IngestT {
  const table = lang === "he" ? he : en;
  return (key, vars) => {
    const text = table[key] ?? en[key];
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (slot, name: string) =>
      name in vars ? String(vars[name]) : slot
    );
  };
}

/** The IngestSheet's copy in the shell's current language. */
export function useIngestCopy(): IngestT {
  const { lang } = useLocale();
  return useMemo(() => ingestCopy(lang), [lang]);
}
