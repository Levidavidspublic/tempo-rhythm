"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { en, he, type MemoryCopyKey } from "@/lib/i18n-groups/memory";

/**
 * The S31 strings (apps/web/lib/i18n-groups/memory.ts) in the current language. Read straight
 * from the group so this screen works before i18n.ts spreads it into MESSAGES.
 */
export function useMemoryCopy(): (key: MemoryCopyKey) => string {
  const { lang } = useLocale();
  const table = lang === "he" ? he : en;
  return (key) => table[key];
}
