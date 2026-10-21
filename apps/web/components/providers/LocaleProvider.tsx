"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { deviceSettingChange } from "@/lib/device-sync";
import {
  dirFor,
  LANG_STORAGE_KEY,
  type Lang,
  type MessageKey,
  resolveLang,
  translate,
} from "@/lib/i18n";

/**
 * Tempo v3 language + direction controller (DESIGN.md §10).
 * The pre-hydration script (lib/theme-script.ts) already set <html lang dir> for this load;
 * this provider keeps React in step and lets the user switch.
 */

type LocaleContextValue = {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (next: Lang) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyToDocument(lang: Lang) {
  const root = document.documentElement;
  root.lang = lang;
  root.dir = dirFor(lang);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    const param = new URLSearchParams(window.location.search).get("lang");
    const next = resolveLang(param, stored);
    setLangState(next);
    applyToDocument(next);

    // The language was switched in another tab of this browser: switch here too.
    const onStorage = (event: StorageEvent) => {
      const change = deviceSettingChange(event.key, event.newValue);
      if (change?.kind !== "lang") return;
      setLangState(change.lang);
      applyToDocument(change.lang);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    applyToDocument(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ lang, dir: dirFor(lang), setLang, t: (key) => translate(lang, key) }),
    [lang, setLang],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used inside <LocaleProvider>");
  }
  return ctx;
}
