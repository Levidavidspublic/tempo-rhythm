"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import { isLang, LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";

/**
 * The language switches that already took the account's language. LocaleProvider makes one
 * switch per page load, so a later screen never re-applies the account's language over a
 * choice made since (this matters when storage is blocked and nothing was saved).
 */
const adopted = new WeakSet<(next: Lang) => void>();

/** This browser chose its own language: one saved on the device, or ?lang for this load. */
function deviceHasOwnLanguage(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    // Storage that throws holds nothing: the account's language is applied in memory.
  }
  return isLang(stored) || isLang(new URLSearchParams(window.location.search).get("lang"));
}

/**
 * A browser with no language of its own takes the account's (preferences.locale), so a
 * Hebrew account is in Hebrew on a new device too. The device's own choice always wins.
 * `settled` turns true once the language for this load is known: right away when the device
 * has its own, when signed out, or once the account's language is applied (or needs nothing).
 */
export function useAccountLanguage(): { settled: boolean } {
  const { lang, setLang } = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth();
  // preferences.get needs the users row; getProfile is null until it exists (or when inactive).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const preferences = useQuery(api.preferences.get, profile ? {} : "skip");
  const accountLang = preferences?.locale;
  const signedOut = !isLoading && !isAuthenticated;
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (settled) return;
    if (adopted.has(setLang) || deviceHasOwnLanguage() || signedOut || profile === null) {
      setSettled(true);
      return;
    }
    if (accountLang === undefined) return;
    adopted.add(setLang);
    if (accountLang !== lang) setLang(accountLang);
    setSettled(true);
  }, [settled, setLang, lang, signedOut, profile, accountLang]);

  return { settled };
}
