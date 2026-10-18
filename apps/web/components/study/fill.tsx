import { Fragment, type ReactNode } from "react";

/**
 * Fill a copy template's `{name}` slots with React nodes (a title with its own `dir="auto"`, a
 * count wrapped in .tp-num), so each language keeps its own word order. Unknown slots stay as
 * written.
 */
export function fillWith(template: string, values: Record<string, ReactNode>): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const name = match[1] as string;
    const at = match.index ?? 0;
    if (!Object.hasOwn(values, name)) continue;
    if (at > cursor) parts.push(template.slice(cursor, at));
    parts.push(<Fragment key={`${name}-${at}`}>{values[name]}</Fragment>);
    cursor = at + match[0].length;
  }
  if (cursor < template.length) parts.push(template.slice(cursor));
  return <>{parts}</>;
}
