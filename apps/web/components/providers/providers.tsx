"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import type React from "react";
import { DATA_BACKEND, type DataBackend } from "@/lib/backend-flag";
import { InsforgeSessionProvider } from "@/lib/insforge/session";
import { useClearTabStateOnSignOut } from "@/lib/tab-state";

// אתחול לקוח Convex עם כתובת השרת
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ProvidersProps {
  children: React.ReactNode;
}

/** TEMPO-IF-007 (#1868): the InsForge session is mounted only when the backend switch is `insforge`. */
export function mountsInsforgeSession(backend: DataBackend): boolean {
  return backend === "insforge";
}

/** Wraps `children` in the InsForge session provider for `insforge`; any other backend gets them unchanged. */
export function withInsforgeSession(backend: DataBackend, children: React.ReactNode) {
  return mountsInsforgeSession(backend) ? (
    <InsforgeSessionProvider>{children}</InsforgeSessionProvider>
  ) : (
    children
  );
}

// רכיב ספקים (Providers) העוטף את האפליקציה
// מספק את הקונטקסט של Convex Auth לכל הרכיבים בתוך האפליקציה
export function Providers({ children }: ProvidersProps) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ClearTabStateOnSignOut />
      {withInsforgeSession(DATA_BACKEND, children)}
    </ConvexAuthNextjsProvider>
  );
}

/** Signing out clears this tab's kept brain dump and task draft (lib/tab-state.ts). Renders nothing. */
function ClearTabStateOnSignOut() {
  useClearTabStateOnSignOut(useConvexAuth());
  return null;
}
