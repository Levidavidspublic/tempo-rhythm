import { isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * A tiny element-tree walker for the study tests. `@testing-library/react` and a DOM are not
 * installed in this repo, so the views (which use no hooks) are called as plain functions and
 * their element trees searched; handlers are then called directly. Markup is checked separately
 * with `renderToStaticMarkup`.
 */

type AnyProps = Record<string, unknown> & { children?: ReactNode };
export type Found = ReactElement<AnyProps>;

/** Expands hook-free function components and returns every host element, depth first. */
export function hostElements(node: ReactNode): Found[] {
  const out: Found[] = [];
  const visit = (current: ReactNode): void => {
    if (Array.isArray(current)) {
      for (const child of current) visit(child);
      return;
    }
    if (!isValidElement(current)) return;
    const element = current as Found;
    if (typeof element.type === "function") {
      visit((element.type as (props: AnyProps) => ReactNode)(element.props));
      return;
    }
    if (typeof element.type === "string") out.push(element);
    visit(element.props.children);
  };
  visit(node);
  return out;
}

export function byAction(node: ReactNode, action: string): Found {
  const found = hostElements(node).find((element) => element.props["data-action"] === action);
  if (!found) throw new Error(`no element with data-action=${action}`);
  return found;
}

export function click(element: Found): void {
  (element.props.onClick as () => void)();
}
