/**
 * Tempo Flow — TypeScript mirror of design tokens.
 *
 * @source docs/design/claude-export/design-system/tokens.css
 *
 * Used by:
 *   - Mobile (`apps/mobile`) where CSS custom properties are not available.
 *   - Any JS that needs raw hex values (charts, SVG gradients, theme previews).
 *
 * Web (`apps/web`) reads tokens via CSS custom properties from `globals.css`;
 * do NOT import this file just to style a web component.
 */

export const tempoColors = {
  // Core palette
  ink: "#131312",
  cream: "#f3ebe2",
  creamRaised: "#faf6f0",
  creamDeep: "#ebe0d2",
  tempoOrange: "#d97757",
  softOrange: "#e8a87c",
  dustGrey: "#6b6864",
  dustGreySoft: "#9a968f",
  line: "#d7cec2",
  lineSoft: "#e6ddd1",
  // Status
  moss: "#4a7c59",
  brick: "#c8553d",
  amber: "#d4a44c",
  slateBlue: "#6e88a7",
} as const;

export const tempoColorsDark = {
  ink: "#131312",
  cream: "#f3ebe2",
  surfaceCard: "#1c1c1a",
  surfaceSunken: "#161615",
  fg: "#f3ebe2",
  fgMuted: "#a8a49f",
  fgSubtle: "#7a7672",
  border: "#2c2b28",
  borderSoft: "#242320",
  ring: "#e8a87c",
} as const;

/**
 * Tempo Flow v3 palette (docs/design/v3/tokens.css `--tp-*`), for surfaces without CSS custom
 * properties (mobile). Light is the default; dark mirrors `[data-theme="dark"]`. Values are the
 * same as the web's, so both apps read the same.
 */
export const tempoV3Colors = {
  ground: "#F3EEE4",
  paper: "#FBF9F4",
  sunken: "#EAE3D6",
  hover: "#EDE6DA",
  ink: "#1B1916",
  inkMuted: "#57514A",
  inkSubtle: "#6B645C",
  line: "#D9D0C1",
  lineStrong: "#B9AE9C",
  lineControl: "#877C6B",
  accent: "#A3461F",
  onAccent: "#FFFFFF",
  accentWash: "#F3E2D6",
  done: "#3B6948",
  doneWash: "#E3EBDF",
  info: "#36628C",
  infoWash: "#E0E7EE",
  caution: "#7E5A0C",
  cautionWash: "#F1E6CC",
  danger: "#9E3B27",
  dangerWash: "#F3DFD7",
  glassSolid: "#FBF9F4",
} as const;

export const tempoV3ColorsDark = {
  ground: "#161412",
  paper: "#201D1A",
  sunken: "#110F0D",
  hover: "#2A2622",
  ink: "#F2ECE2",
  inkMuted: "#B5AC9F",
  inkSubtle: "#9E9588",
  line: "#38332D",
  lineStrong: "#5C554C",
  lineControl: "#7F7669",
  accent: "#EE9468",
  onAccent: "#1B1916",
  accentWash: "#3A2A20",
  done: "#8FC09C",
  doneWash: "#1F2D23",
  info: "#94B8DA",
  infoWash: "#1C2632",
  caution: "#DDB45E",
  cautionWash: "#30281A",
  danger: "#EE9A86",
  dangerWash: "#35211C",
  glassSolid: "#24211D",
} as const satisfies Record<keyof typeof tempoV3Colors, string>;

export const tempoFonts = {
  serif: "Newsreader",
  sans: "Inter",
  mono: "IBM Plex Mono",
  dyslexia: "OpenDyslexic",
} as const;

export const tempoRadii = {
  sm: 4,
  base: 8,
  md: 10,
  lg: 12,
  xl: 16,
  "2xl": 24,
  pill: 9999,
} as const;

export const tempoSpacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const tempoMotion = {
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  snap: 120,
  default: 220,
  hero: 420,
} as const;

export type TempoColorToken = keyof typeof tempoColors;

export {
  accessibleReadingStorageKey,
  accessibleReadingTokens,
  type AccessibleReadingTokens,
} from "./tokens.accessible";

