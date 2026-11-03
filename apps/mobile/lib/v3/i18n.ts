/**
 * Tempo v3 mobile i18n: a small dictionary lookup with `{name}` placeholders.
 * Pure (no React Native imports), so it is unit-tested with bun.
 */
import { type Entry, STRINGS } from "./strings";

export type Lang = "en" | "he";
export type Screen = Exclude<keyof typeof STRINGS, "common">;
export type CommonKey = keyof (typeof STRINGS)["common"];
export type ScreenKey<S extends Screen> = keyof (typeof STRINGS)[S] & string;
export type Key<S extends Screen> = ScreenKey<S> | CommonKey;
export type Vars = Readonly<Record<string, string | number>>;

export const LANGS: readonly Lang[] = ["en", "he"];

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "he";
}

/** Hebrew is the one right-to-left language Tempo ships. */
export function isRtlLang(lang: Lang): boolean {
  return lang === "he";
}

/** Fills `{name}` placeholders. Unknown placeholders stay as typed. */
export function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : whole,
  );
}

function entryFor(screen: Screen, key: string): Entry | undefined {
  const own = (STRINGS[screen] as Record<string, Entry>)[key];
  return own ?? (STRINGS.common as Record<string, Entry>)[key];
}

/**
 * The copy for `key` on `screen` (falling back to the shared keys), in `lang`.
 * A missing key returns the key itself so a gap is visible in review, never blank.
 */
export function translate<S extends Screen>(lang: Lang, screen: S, key: Key<S>, vars?: Vars): string {
  const entry = entryFor(screen, key);
  if (!entry) return key;
  return fill(lang === "he" ? entry[1] : entry[0], vars);
}

/** Every [screen, key] pair, for completeness checks. */
export function allEntries(): { screen: string; key: string; en: string; he: string }[] {
  const out: { screen: string; key: string; en: string; he: string }[] = [];
  for (const [screen, entries] of Object.entries(STRINGS)) {
    for (const [key, [en, he]] of Object.entries(entries as Record<string, Entry>)) {
      out.push({ screen, key, en, he });
    }
  }
  return out;
}

const STRONG_RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const STRONG_LTR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

/**
 * Direction of user-written text, like HTML `dir="auto"`: the first strong character decides.
 * Text with no strong character (digits, emoji) follows `fallback`.
 */
export function textDirection(text: string, fallback: "ltr" | "rtl" = "ltr"): "ltr" | "rtl" {
  for (const ch of text) {
    if (STRONG_RTL.test(ch)) return "rtl";
    if (STRONG_LTR.test(ch)) return "ltr";
  }
  return fallback;
}

/**
 * Start-of-line alignment for React Native. RN mirrors `left`/`right` when the native layout is
 * right-to-left (`I18nManager.isRTL`), so the value depends on both the text and the native layout.
 */
export function startAlign(textRtl: boolean, nativeRtl: boolean): "left" | "right" {
  return textRtl === nativeRtl ? "left" : "right";
}

/** Row direction that reads in the language's order whatever the native layout direction is. */
export function rowDirection(langRtl: boolean, nativeRtl: boolean): "row" | "row-reverse" {
  return langRtl === nativeRtl ? "row" : "row-reverse";
}

/** Keys written for the app rather than taken from the design files: Hebrew needs native review. */
export { NEEDS_NATIVE_REVIEW } from "./strings";
