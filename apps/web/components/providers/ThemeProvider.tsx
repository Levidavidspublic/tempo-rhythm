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
import {
  DYSLEXIA_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme-script";

/**
 * Tempo Flow theme + dyslexia controller.
 *
 * @source docs/design/claude-export/design-system/theme-controller.js
 * @storage localStorage keys: tempo-theme, tempo-dyslexia
 *
 * Contract:
 *   theme = 'light' | 'dark' | 'system'
 *     - 'light' | 'dark'  -> explicit data-theme attr, user override wins
 *     - 'system'          -> remove attr; CSS prefers-color-scheme applies
 *   dyslexia = 'on' | 'off'
 *     - 'on' -> data-dyslexia="on" enables OpenDyslexic + looser leading
 */

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (next: ThemePreference) => void;
  dyslexia: boolean;
  setDyslexia: (next: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function detectSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [dyslexia, setDyslexiaState] = useState<boolean>(false);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      // ?theme= forces this load (the pre-hydration script applied it already); keep state in step.
      const queryTheme = new URLSearchParams(window.location.search).get("theme");
      const storedTheme = (
        queryTheme === "light" || queryTheme === "dark" ? queryTheme : localStorage.getItem(THEME_STORAGE_KEY)
      ) as ThemePreference | null;
      if (storedTheme === "light" || storedTheme === "dark") {
        setThemeState(storedTheme);
      }
      const storedDyslexia = localStorage.getItem(DYSLEXIA_STORAGE_KEY);
      if (storedDyslexia === "on") setDyslexiaState(true);
    } catch {
      /* storage unavailable */
    }
    setSystemTheme(detectSystemTheme());

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(mql.matches ? "dark" : "light");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      if (next === "system") {
        localStorage.removeItem(THEME_STORAGE_KEY);
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setDyslexia = useCallback((next: boolean) => {
    setDyslexiaState(next);
    try {
      if (next) {
        localStorage.setItem(DYSLEXIA_STORAGE_KEY, "on");
        document.documentElement.setAttribute("data-dyslexia", "on");
      } else {
        localStorage.removeItem(DYSLEXIA_STORAGE_KEY);
        document.documentElement.removeAttribute("data-dyslexia");
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? systemTheme : theme;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      dyslexia,
      setDyslexia,
    }),
    [theme, resolvedTheme, setTheme, dyslexia, setDyslexia],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
