import { Fragment, type ReactNode } from "react";

/**
 * Shared helpers for the study components (kitchen T3): reading direction, the keyboard map and
 * copy templates. Every visible word comes from the host's `labels`; templates name their numbers
 * in braces (`"{current} of {total}"`) so each language keeps its own word order.
 */

export type StudyDir = "ltr" | "rtl";

/** The direction to use: the `dir` prop when given, else the closest `[dir]` ancestor, else LTR. */
export function resolveDir(prop: StudyDir | undefined, element?: Element | null): StudyDir {
  if (prop) return prop;
  const found = element?.closest?.("[dir]")?.getAttribute("dir");
  return found === "rtl" ? "rtl" : "ltr";
}

/**
 * Which way an arrow key moves through a sequence. Right is forward in LTR and back in RTL, so
 * the arrow always points where the next card sits on screen. Other keys return null.
 */
export function stepForKey(key: string, dir: StudyDir): "next" | "prev" | null {
  if (key === "ArrowRight") return dir === "rtl" ? "prev" : "next";
  if (key === "ArrowLeft") return dir === "rtl" ? "next" : "prev";
  return null;
}

/** Space or Enter: the keys that flip a card or show an answer. */
export function isActivationKey(key: string): boolean {
  return key === " " || key === "Spacebar" || key === "Enter";
}

/** True when the key event started on a control that handles Space and Enter on its own. */
export function isFromControl(target: EventTarget | null): boolean {
  const element = target as Element | null;
  if (!element || typeof element.closest !== "function") return false;
  return element.closest("button, input, textarea, select, a[href]") !== null;
}

type TemplateValues = Record<string, number | string>;

const PLACEHOLDER = /\{(\w+)\}/g;

/** A template as plain text, for `aria-label`s. Unknown placeholders are kept as written. */
export function fillText(template: string, values: TemplateValues): string {
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole
  );
}

/** A template as React nodes: numbers are wrapped in `.tp-num`, text values stay plain. */
export function fillNodes(template: string, values: TemplateValues): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = match[1] as string;
    const at = match.index ?? 0;
    if (!Object.hasOwn(values, name)) continue;
    if (at > cursor) parts.push(template.slice(cursor, at));
    const value = values[name];
    parts.push(
      typeof value === "number" ? (
        <span className="tp-num" key={`${name}-${at}`}>
          {value}
        </span>
      ) : (
        <Fragment key={`${name}-${at}`}>{value}</Fragment>
      )
    );
    cursor = at + match[0].length;
  }
  if (cursor < template.length) parts.push(template.slice(cursor));
  return <>{parts}</>;
}

/** Keys of a labels object whose text is empty or only spaces. A host test can assert none. */
export function emptyLabelKeys(labels: object, prefix = ""): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(labels)) {
    if (typeof value === "string" && value.trim() === "") out.push(`${prefix}${key}`);
    else if (value && typeof value === "object")
      out.push(...emptyLabelKeys(value, `${prefix}${key}.`));
  }
  return out;
}
