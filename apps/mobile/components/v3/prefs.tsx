/**
 * v3 preferences for the mobile app: language, theme, text size, reading font and reduced motion.
 *
 * Language and theme are account preferences (`preferences.get` / `preferences.update`) once the
 * person is signed in, and a phone-local value before that. Text size and the reading font are
 * phone-local (DESIGN.md §11 keeps the reading font device-local). Colours come from the v3 tokens
 * in @tempo/ui/theme; nothing here holds a raw colour.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { tempoV3Colors, tempoV3ColorsDark } from "@tempo/ui/theme";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { getLocales } from "expo-localization";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, I18nManager, useColorScheme } from "react-native";
import { api } from "@/convex/_generated/api";
import {
  isLang,
  isRtlLang,
  type Key,
  type Lang,
  rowDirection,
  type Screen,
  startAlign,
  translate,
  type Vars,
} from "@/lib/v3/i18n";

export type Palette = { [K in keyof typeof tempoV3Colors]: string };
export type ThemePref = "system" | "light" | "dark";
export type TextSize = "s" | "m" | "l";

const KEYS = {
  lang: "tempo.v3.lang",
  theme: "tempo.v3.theme",
  textSize: "tempo.v3.textSize",
  readingFont: "tempo-dyslexia",
} as const;

/** Base body size per text-size setting (DESIGN.md §3: S / M / L = 15 / 17 / 20 px). */
const TEXT_SCALE: Record<TextSize, number> = { s: 15 / 17, m: 1, l: 20 / 17 };

type Prefs = {
  lang: Lang;
  themePref: ThemePref;
  dark: boolean;
  colors: Palette;
  textSize: TextSize;
  textScale: number;
  readingFont: boolean;
  reducedMotion: boolean;
  /** Language direction, and the values that make rows and text follow it on any native layout. */
  rtl: boolean;
  row: "row" | "row-reverse";
  align: "left" | "right";
  setLang: (lang: Lang) => void;
  setThemePref: (pref: ThemePref) => void;
  setTextSize: (size: TextSize) => void;
  setReadingFont: (on: boolean) => void;
};

const PrefsContext = createContext<Prefs | null>(null);

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === "he" ? "he" : "en";
  } catch {
    return "en";
  }
}

async function readLocal(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  AsyncStorage.setItem(key, value).catch(() => {
    // Phone storage can be unavailable; the in-memory value still applies.
  });
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const server = useQuery(api.preferences.get, isAuthenticated && profile ? {} : "skip");
  const updateServer = useMutation(api.preferences.update);

  const [lang, setLangState] = useState<Lang>(deviceLang);
  const [themePref, setThemeState] = useState<ThemePref>("system");
  const [textSize, setTextSizeState] = useState<TextSize>("m");
  const [readingFont, setReadingFontState] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([readLocal(KEYS.lang), readLocal(KEYS.theme), readLocal(KEYS.textSize), readLocal(KEYS.readingFont)]).then(
      ([l, t, s, f]) => {
        if (!live) return;
        if (isLang(l)) setLangState(l);
        if (t === "system" || t === "light" || t === "dark") setThemeState(t);
        if (s === "s" || s === "m" || s === "l") setTextSizeState(s);
        setReadingFontState(f === "on");
      },
    );
    return () => {
      live = false;
    };
  }, []);

  // Signed in, the account's language and theme win over the phone's copy.
  useEffect(() => {
    if (!server) return;
    setLangState(server.locale);
    setThemeState(server.theme);
    writeLocal(KEYS.lang, server.locale);
    writeLocal(KEYS.theme, server.theme);
  }, [server]);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReducedMotion(on))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  const signedIn = isAuthenticated && !!profile;
  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      writeLocal(KEYS.lang, next);
      if (signedIn) updateServer({ locale: next }).catch(() => undefined);
    },
    [signedIn, updateServer],
  );
  const setThemePref = useCallback(
    (next: ThemePref) => {
      setThemeState(next);
      writeLocal(KEYS.theme, next);
      if (signedIn) updateServer({ theme: next }).catch(() => undefined);
    },
    [signedIn, updateServer],
  );
  const setTextSize = useCallback((next: TextSize) => {
    setTextSizeState(next);
    writeLocal(KEYS.textSize, next);
  }, []);
  const setReadingFont = useCallback((on: boolean) => {
    setReadingFontState(on);
    writeLocal(KEYS.readingFont, on ? "on" : "off");
  }, []);

  const value = useMemo<Prefs>(() => {
    const dark = themePref === "dark" || (themePref === "system" && scheme === "dark");
    const rtl = isRtlLang(lang);
    const nativeRtl = I18nManager.isRTL;
    return {
      lang,
      themePref,
      dark,
      colors: dark ? tempoV3ColorsDark : tempoV3Colors,
      textSize,
      textScale: TEXT_SCALE[textSize],
      readingFont,
      reducedMotion,
      rtl,
      row: rowDirection(rtl, nativeRtl),
      align: startAlign(rtl, nativeRtl),
      setLang,
      setThemePref,
      setTextSize,
      setReadingFont,
    };
  }, [lang, themePref, scheme, textSize, readingFont, reducedMotion, setLang, setThemePref, setTextSize, setReadingFont]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext);
  if (!prefs) throw new Error("usePrefs must be used inside PrefsProvider");
  return prefs;
}

export function useColors(): Palette {
  return usePrefs().colors;
}

/** `t(key, vars)` for one screen's copy, in the current language. */
export function useT<S extends Screen>(screen: S): (key: Key<S>, vars?: Vars) => string {
  const { lang } = usePrefs();
  return useCallback((key: Key<S>, vars?: Vars) => translate(lang, screen, key, vars), [lang, screen]);
}
