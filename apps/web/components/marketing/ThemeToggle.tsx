"use client";

import { Moon, Sun } from "@tempo/ui/icons";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { tKb73 } from "@/lib/i18n-groups/kb-73";
import "@/app/v3/kb-73.css";

/**
 * Landing-page theme control. Uses the app theme store so it stays in
 * step with the rest of Tempo Flow.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { lang } = useLocale();
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={tKb73(lang, next === "dark" ? "switchDark" : "switchLight")}
      className="kb73-theme-toggle"
    >
      {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

/** Isolated review of the same control mounted on the public landing page. */
export function Kb73Gallery() {
  const { lang, dir, setLang } = useLocale();
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <main className="kb73-gallery" lang={lang} dir={dir}>
      <h1>{tKb73(lang, "galleryTitle")}</h1>
      <fieldset className="kb73-gallery__controls">
        <legend>{tKb73(lang, "galleryLanguage")}</legend>
        <div className="kb73-gallery__options">
          <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")}>{tKb73(lang, "galleryEnglish")}</button>
          <button type="button" lang="he" aria-pressed={lang === "he"} onClick={() => setLang("he")}>{tKb73(lang, "galleryHebrew")}</button>
        </div>
      </fieldset>
      <fieldset className="kb73-gallery__controls">
        <legend>{tKb73(lang, "galleryPreference")}</legend>
        <div className="kb73-gallery__options">
          {(["system", "light", "dark"] as const).map((choice) => (
            <button key={choice} type="button" aria-pressed={theme === choice} onClick={() => setTheme(choice)}>
              {tKb73(lang, choice)}
            </button>
          ))}
        </div>
      </fieldset>
      <p>{tKb73(lang, "galleryResolved")}: {tKb73(lang, resolvedTheme)}</p>
      <ThemeToggle />
    </main>
  );
}
