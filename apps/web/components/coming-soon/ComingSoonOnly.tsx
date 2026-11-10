"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import type { ReactNode } from "react";
import { isComingSoonRoute } from "@/lib/surface";

/**
 * Coming-soon surface only (lib/surface.ts). The root layout has no app providers there, so an
 * app page must not render: it throws without them, and that fails the build when Next
 * prerenders it. This renders its children for the coming-soon route and nothing for any other
 * route. The proxy already answers 404 for those routes before they are reached.
 */
export function ComingSoonOnly({ children }: { children: ReactNode }) {
  return isComingSoonRoute(useSelectedLayoutSegments()) ? children : null;
}
