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

describe("tempoV3Colors mirrors docs/design/v3/tokens.css", () => {
  const light = css.slice(css.indexOf(":root"));
  const darkStart = css.search(/\[data-theme="dark"\]\s*\{/);
  const dark = css.slice(darkStart);

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
