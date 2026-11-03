/**
 * Today's brain-dump panel reads in light and dark mode (TEMPO-B07-22). The near-white cards with
 * pale text came from literal light colours (rgba(255, …) gradients, bg-white/80) under theme text
 * that turns light in dark mode. No browser here, so this reads the source: every colour the panel
 * paints with is a theme token that has a dark value, and the pairs it uses meet WCAG AA in both
 * themes, with the token values taken from globals.css.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const panel = readFileSync(join(import.meta.dir, "TodayBrainDumpPanel.tsx"), "utf8");
const globals = readFileSync(join(import.meta.dir, "..", "..", "app", "globals.css"), "utf8");

/** Custom properties declared in the first `selector {` block of globals.css. */
function declarations(selector: string): Map<string, string> {
  const start = globals.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css has no ${selector} block`);
  const body = globals.slice(globals.indexOf("{", start) + 1, globals.indexOf("}", start));
  const vars = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    if (name && value) vars.set(name, value.trim());
  }
  return vars;
}

// Tailwind colour name -> --tp-* token, for the colours that follow data-theme.
const themed = new Map<string, string>();
for (const [name, value] of declarations("@theme")) {
  const match = /^color-([\w-]+)$/.exec(name);
  const token = /^var\(--(tp-[\w-]+)\)$/.exec(value);
  if (match?.[1] && token?.[1]) themed.set(match[1], token[1]);
}
const light = declarations(":root");
const dark = declarations('[data-theme="dark"]');

/** Every class in the panel's string literals, without variants (hover:, xl:) or opacity (/80). */
const classes = [...panel.matchAll(/"([^"]*)"/g)]
  .flatMap(([, value]) => (value ?? "").split(/\s+/))
  .map((cls) => cls.replace(/^(?:[a-z0-9-]+:)+/, "").replace(/\/\d+$/, ""))
  .filter(Boolean);

const COLOUR_UTILITY =
  /^(bg|text|border|from|via|to|ring|outline|fill|stroke|decoration|divide|placeholder|caret)-(.+)$/;
// Values of those prefixes that are sizes, sides or styles, not colours.
const NOT_A_COLOUR =
  /^(xs|sm|base|lg|\d?xl|center|left|right|start|end|wrap|nowrap|balance|[trblxyse]|\d+|solid|dashed|dotted|none|offset-.+|inset|linear-.+|radial|conic)$/;
const KEYWORD_COLOURS = new Set(["transparent", "current", "inherit"]);
const LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;

describe("Today's brain-dump panel colours", () => {
  test("found the theme tokens in globals.css", () => {
    expect(themed.get("card")).toBe("tp-paper");
    expect(themed.get("foreground")).toBe("tp-ink");
    expect(light.get("tp-paper")).toMatch(/^#/);
    expect(dark.get("tp-paper")).toMatch(/^#/);
  });

  test("has no hex colour anywhere", () => {
    expect(panel.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  test("paints surfaces, text and borders only with theme tokens", () => {
    const offenders: string[] = [];
    for (const cls of classes) {
      const match = COLOUR_UTILITY.exec(cls);
      const value = match?.[2];
      if (!value || NOT_A_COLOUR.test(value) || KEYWORD_COLOURS.has(value)) continue;
      if (value.startsWith("[")) {
        // Arbitrary values (the gradients): no literal colour, and every var is a theme token.
        const vars = [...value.matchAll(/var\(--color-([\w-]+)\)/g)].map(([, name]) => name ?? "");
        if (LITERAL_COLOUR.test(value) || vars.some((name) => !themed.has(name))) {
          offenders.push(cls);
        }
      } else if (!themed.has(value)) {
        offenders.push(cls); // bg-white, text-cream, border-tempo-orange: fixed light colours.
      }
    }
    expect(offenders).toEqual([]);
  });

  test("every token it uses has a light and a dark value", () => {
    const used = new Set<string>();
    for (const cls of classes) {
      const value = COLOUR_UTILITY.exec(cls)?.[2] ?? "";
      if (themed.has(value)) used.add(value);
      for (const [, name] of cls.matchAll(/var\(--color-([\w-]+)\)/g)) if (name) used.add(name);
    }
    expect(used.size).toBeGreaterThan(5);
    for (const name of used) {
      const token = themed.get(name) ?? "";
      expect(light.get(token)).toMatch(/^#/);
      expect(dark.get(token)).toMatch(/^#/);
      expect(dark.get(token)).not.toBe(light.get(token));
    }
  });
});

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16)) as RGB;
}

/** `top` at `alpha` painted over `under`, as the browser composites it. */
function over(top: RGB, alpha: number, under: RGB): RGB {
  return top.map((channel, i) => channel * alpha + (under[i] ?? 0) * (1 - alpha)) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("Today's brain-dump panel contrast, %s", (_theme, values) => {
  const c = (name: string): RGB => rgb(values.get(themed.get(name) ?? "") ?? "");
  // The header gradient runs card -> surface-sunken with the accent wash in one corner; the
  // output cards run card -> surface-sunken. Alpha fills (bg-card/95 …) lie between those ends.
  const header = [c("card"), c("surface-sunken"), c("accent-wash")];
  const cards = [c("card"), c("surface-sunken"), over(c("card"), 0.95, c("background"))];
  const pairs: [string, RGB, RGB[]][] = [
    ["heading and body text in the header", c("foreground"), header],
    ["help text in the header", c("muted-foreground"), header],
    ["link and badge in the header", c("primary"), header],
    ["text on the cards and in the text box", c("foreground"), [...cards, c("background")]],
    ["help text on the cards", c("muted-foreground"), cards],
    ["primary buttons", c("primary-foreground"), [c("primary")]],
    ["Now and Soon chips", c("primary"), [over(c("primary"), 0.1, c("card"))]],
    ["Later chips", c("muted-foreground"), [over(c("muted"), 0.6, c("card"))]],
    ["error notice", c("destructive"), [over(c("destructive"), 0.1, c("card"))]],
    ["line numbers", c("background"), [c("foreground")]],
  ];

  test.each(pairs)("%s meet WCAG AA (4.5:1)", (_label, text, surfaces) => {
    for (const surface of surfaces) expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
  });
});
