/**
 * @tempo/ui — Tempo Flow shared component library.
 *
 * Import paths:
 *   - `@tempo/ui`             → all primitives + brand + theme (web-safe)
 *   - `@tempo/ui/icons`       → web icon set (SVG)
 *   - `@tempo/ui/icons/native`→ mobile icon set (react-native-svg)
 *   - `@tempo/ui/brand`       → BrandMark, Wordmark (web)
 *   - `@tempo/ui/brand/native`→ BrandMark, Wordmark (mobile)
 *   - `@tempo/ui/theme`       → design tokens as TypeScript constants
 *   - `@tempo/ui/native`      → RN-native primitives
 */

export { BrandMark, Wordmark } from "./brand";
export * from "./primitives";
export * from "./study";
export {
  type AccessibleReadingTokens,
  accessibleReadingStorageKey,
  accessibleReadingTokens,
  type TempoColorToken,
  tempoColors,
  tempoColorsDark,
  tempoFonts,
  tempoMotion,
  tempoRadii,
  tempoSpacing,
} from "./theme/tokens";
