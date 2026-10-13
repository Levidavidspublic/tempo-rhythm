/**
 * Text size: small, medium or large, device-local like the theme and the reading font
 * (docs/design/v3/screens/web/settings-prefs.html). Medium is the default and sets no attribute;
 * small and large set `data-text-size` on <html> (tokens in app/globals.css).
 */

export const TEXT_SIZE_STORAGE_KEY = "tempo-text-size";

export type TextSize = "s" | "m" | "l";

export const TEXT_SIZES: readonly TextSize[] = ["s", "m", "l"];

export function isTextSize(value: unknown): value is TextSize {
  return value === "s" || value === "m" || value === "l";
}

/** Anything unknown reads as medium. */
export function readTextSize(value: string | null | undefined): TextSize {
  return isTextSize(value) ? value : "m";
}

type RootLike = {
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
};

export function applyTextSize(root: RootLike, size: TextSize): void {
  if (size === "m") root.removeAttribute("data-text-size");
  else root.setAttribute("data-text-size", size);
}
