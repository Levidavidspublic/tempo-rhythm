import { describe, expect, test } from "bun:test";
import { isValidElement, type ReactNode } from "react";
import { InsforgeSessionProvider } from "@/lib/insforge/session";

// providers.tsx builds its Convex client at import time and the constructor needs a URL. Same
// placeholder as the CI build step (AGENTS.md); only set when the run has none.
process.env.NEXT_PUBLIC_CONVEX_URL ??= "https://example.convex.cloud";
const { mountsInsforgeSession, withInsforgeSession } = await import("./providers");

describe("mountsInsforgeSession", () => {
  test("true only for insforge", () => {
    expect(mountsInsforgeSession("insforge")).toBe(true);
    expect(mountsInsforgeSession("convex")).toBe(false);
    expect(mountsInsforgeSession("firebase")).toBe(false);
  });
});

describe("withInsforgeSession", () => {
  test("insforge wraps the children in InsforgeSessionProvider", () => {
    const children = "app";
    const tree = withInsforgeSession("insforge", children);
    expect(isValidElement(tree)).toBe(true);
    if (!isValidElement<{ children: unknown }>(tree)) return;
    expect(tree.type).toBe(InsforgeSessionProvider);
    expect(tree.props.children).toBe(children);
  });

  test.each(["convex", "firebase"] as const)("%s returns the children unchanged", (backend) => {
    const children = { marker: true } as unknown as ReactNode;
    expect(withInsforgeSession(backend, children)).toBe(children);
  });
});
