/**
 * Display settings are kept per device (localStorage): theme, reading font, text size, language.
 * When one tab changes one, the browser tells the other tabs of the same site with a `storage`
 * event; this reads that event, so every open tab follows instead of keeping the old look until
 * it reloads.
 */
import { LANG_STORAGE_KEY, type Lang } from "./i18n";
import { readTextSize, TEXT_SIZE_STORAGE_KEY, type TextSize } from "./settings/textSize";
import { DYSLEXIA_STORAGE_KEY, THEME_STORAGE_KEY, type ThemePreference } from "./theme-script";

export type DeviceSettingChange =
  | { kind: "theme"; theme: ThemePreference }
  | { kind: "dyslexia"; on: boolean }
  | { kind: "textSize"; size: TextSize }
  | { kind: "lang"; lang: Lang };

/** The setting another tab just saved, from a `storage` event's key and new value; null for anything else. */
export function deviceSettingChange(key: string | null, newValue: string | null): DeviceSettingChange | null {
  switch (key) {
    case THEME_STORAGE_KEY:
      // A removed key is "system" (setTheme removes it for that choice).
      return { kind: "theme", theme: newValue === "light" || newValue === "dark" ? newValue : "system" };
    case DYSLEXIA_STORAGE_KEY:
      return { kind: "dyslexia", on: newValue === "on" };
    case TEXT_SIZE_STORAGE_KEY:
      return { kind: "textSize", size: readTextSize(newValue) };
    case LANG_STORAGE_KEY:
      return newValue === "en" || newValue === "he" ? { kind: "lang", lang: newValue } : null;
    default:
      return null;
  }
}
