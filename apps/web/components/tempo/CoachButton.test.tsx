/**
 * On a phone the floating coach button must not cover a list's last row (TEMPO-B07-26). No
 * browser here: the test reads tempo.css and the tokens in globals.css and checks the geometry
 * of the phone layout, so main's bottom padding ends a gap above the button's top edge.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { CoachButton } from "./CoachButton";

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const tempoCss = strip(readFileSync(join(import.meta.dir, "../../app/tempo.css"), "utf8"));
const globalsCss = strip(readFileSync(join(import.meta.dir, "../../app/globals.css"), "utf8"));

const PHONE = "@media (max-width: 767px)";

type Rule = { selectors: string[]; body: string; at: string[]; offset: number };

/** Every style rule in source order, with the at-rules (layers, media queries) around it. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const open: string[] = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") {
      open.push(css.slice(start, i).split(";").pop()?.trim() ?? "");
      start = i + 1;
    } else if (css[i] === "}") {
      const prelude = open.pop() ?? "";
      if (!prelude.startsWith("@")) {
        out.push({
          selectors: prelude.split(",").map((s) => s.trim()),
          body: css.slice(start, i),
          at: open.filter((p) => p.startsWith("@")),
          offset: i,
        });
      }
      start = i + 1;
    }
  }
  return out;
}

const all = rules(tempoCss);
const declared = (rule: Rule, prop: string) =>
  new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(rule.body)?.[1]?.trim();
const inPhone = (rule: Rule) => rule.at.includes(PHONE);
const unconditional = (rule: Rule) => !rule.at.some((a) => a.startsWith("@media"));

/** The `--tp-*` lengths in px, from the :root tokens in globals.css. */
const tokens = new Map(
  [...globalsCss.matchAll(/--tp-([a-z0-9-]+):\s*(\d+)px\s*;/g)].map((m) => [m[1], Number(m[2])] as const),
);

/** A length in px: a sum of var(--tp-*) tokens, plain px, and env() at its fallback (no notch). */
function px(value: string): number {
  const inner = value.replace(/^calc\(([\s\S]*)\)$/, "$1");
  return inner.split("+").reduce((sum, raw) => {
    const term = raw.trim();
    const token = /^var\(--tp-([a-z0-9-]+)\)$/.exec(term);
    if (token) {
      const length = tokens.get(token[1] as string);
      if (length === undefined) throw new Error(`unknown token ${term}`);
      return sum + length;
    }
    const env = /^env\([a-z-]+,\s*(\d+)px\)$/.exec(term);
    if (env) return sum + Number(env[1]);
    const plain = /^(\d+)px$/.exec(term);
    if (plain) return sum + Number(plain[1]);
    throw new Error(`cannot measure "${term}"`);
  }, 0);
}

/** The phone rule that wins for main's bottom padding: the last one in source order. */
function phoneMainClearance(): Rule | undefined {
  return all
    .filter(
      (r) =>
        inPhone(r) &&
        r.selectors.includes(".tp-app__main") &&
        (declared(r, "padding") || declared(r, "padding-bottom") || declared(r, "padding-block-end")),
    )
    .at(-1);
}

describe("CoachButton", () => {
  test("is the floating .tp-coach-fab the phone clearance is measured against", () => {
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, null, createElement(CoachButton, { expanded: false, onOpen: () => {} })),
    );
    expect(html).toContain('class="tp-coach-fab tp-glass"');
    expect(html).toContain('data-component="CoachButton"');
    expect(html).toContain('aria-controls="coach-panel"');
  });
});

describe("on a phone, main scrolls clear of the coach button", () => {
  test("main's bottom padding ends at least a space-4 gap above the button's top edge", () => {
    const fab = all.find((r) => unconditional(r) && r.selectors.includes(".tp-coach-fab"));
    const phoneFab = all.find((r) => inPhone(r) && r.selectors.includes(".tp-coach-fab"));
    const height = declared(fab as Rule, "min-height");
    const bottom = declared(phoneFab as Rule, "bottom");
    expect(height).toBeDefined();
    expect(bottom).toBeDefined();
    const buttonTop = px(bottom as string) + px(height as string);

    const main = phoneMainClearance();
    const clearance = declared(main as Rule, "padding-block-end");
    expect(clearance).toBeDefined();
    expect(px(clearance as string) - buttonTop).toBeGreaterThanOrEqual(tokens.get("space-4") as number);
  });

  test("the clearance comes after the locked phone padding, in the same layer, so it wins", () => {
    const main = phoneMainClearance() as Rule;
    const locked = all.find((r) => inPhone(r) && r.selectors.includes(".tp-app__main") && declared(r, "padding"));
    expect(locked).toBeDefined();
    expect(main.offset).toBeGreaterThan((locked as Rule).offset);
    expect(main.at.filter((a) => a.startsWith("@layer"))).toEqual(
      (locked as Rule).at.filter((a) => a.startsWith("@layer")),
    );
  });

  test("uses tokens and the safe-area inset, no physical sides and no motion", () => {
    const main = phoneMainClearance() as Rule;
    const clearance = declared(main, "padding-block-end") as string;
    expect(clearance).toContain("env(safe-area-inset-bottom");
    expect(clearance.replace(/env\([^)]*\)/g, "")).not.toMatch(/\d+(px|rem|em)\b/);
    expect(main.body.replace(/env\([^)]*\)/g, "")).not.toMatch(/\b(left|right|top|bottom)\b/);
    expect(main.body).not.toMatch(/\b(transition|animation)\b/);
  });

  test("desktop keeps its padding", () => {
    const desktop = all.filter((r) => unconditional(r) && r.selectors.includes(".tp-app__main"));
    expect(desktop.map((r) => declared(r, "padding"))).toEqual([
      "var(--tp-space-8) var(--tp-space-6) var(--tp-space-20)",
    ]);
    expect(desktop.some((r) => declared(r, "padding-block-end") || declared(r, "padding-bottom"))).toBe(false);
  });
});
