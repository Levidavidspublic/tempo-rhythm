import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tempoV3Colors, tempoV3ColorsDark } from "./tokens";

/** The TS mirror must carry the same values as docs/design/v3/tokens.css. */
const css = readFileSync(join(import.meta.dir, "../../../../docs/design/v3/tokens.css"), "utf8");

function cssValue(block: string, name: string): string | undefined {
  const m = new RegExp(`--tp-${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block);
  return m?.[1]?.toUpperCase();
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The `{ … }` body of the first rule whose selector matches `selector`. */
function block(selector: RegExp): string {
  const start = css.search(selector);
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

/** Every `--tp-*` token in a block whose value is a plain hex colour. */
function hexTokens(body: string): string[] {
  return [...body.matchAll(/--tp-([a-z-]+):\s*#[0-9A-Fa-f]{6}\b/g)].map((m) => m[1] as string).sort();
}

describe("tempoV3Colors mirrors docs/design/v3/tokens.css", () => {
  const light = block(/:root\s*\{/);
  const darkStart = css.search(/\[data-theme="dark"\]\s*\{/);
  const dark = block(/\[data-theme="dark"\]\s*\{/);

  test("every hex colour token is mirrored, and nothing extra", () => {
    expect(Object.keys(tempoV3Colors).map(kebab).sort()).toEqual(hexTokens(light));
    expect(Object.keys(tempoV3ColorsDark).map(kebab).sort()).toEqual(hexTokens(dark));
  });

  test("light", () => {
    for (const [key, value] of Object.entries(tempoV3Colors)) {
      expect([key, cssValue(light, kebab(key))]).toEqual([key, value.toUpperCase()]);
    }
  });

  test("dark", () => {
    expect(darkStart).toBeGreaterThan(-1);
    for (const [key, value] of Object.entries(tempoV3ColorsDark)) {
      expect([key, cssValue(dark, kebab(key))]).toEqual([key, value.toUpperCase()]);
    }
  });
});

describe("the mobile semantic aliases map to the same v3 tokens as the web", () => {
  const config = readFileSync(join(import.meta.dir, "../../../../apps/mobile/tailwind.config.js"), "utf8");
  const alias = (name: string) =>
    new RegExp(`(?:^|[\\s{,])['"]?${name}['"]?:\\s*['"](#[0-9A-Fa-f]{6})['"]`, "m").exec(config)?.[1]?.toUpperCase();
  // apps/web/app/globals.css: --color-<alias>: var(--tp-<token>).
  const mapping: Record<string, keyof typeof tempoV3Colors> = {
    background: "ground",
    foreground: "ink",
    card: "paper",
    "card-foreground": "ink",
    border: "line",
    "border-soft": "line",
    primary: "accent",
    "primary-foreground": "onAccent",
    muted: "sunken",
    "muted-foreground": "inkMuted",
    accent: "hover",
    destructive: "danger",
  };
  for (const [name, token] of Object.entries(mapping)) {
    test(`${name} is --tp-${kebab(token)}`, () => {
      expect(alias(name)).toBe(tempoV3Colors[token].toUpperCase());
    });
  }
});
