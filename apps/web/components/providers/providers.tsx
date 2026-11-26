"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import type React from "react";
import { useClearTabStateOnSignOut } from "@/lib/tab-state";

// אתחול לקוח Convex עם כתובת השרת
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ProvidersProps {
  children: React.ReactNode;
}

// רכיב ספקים (Providers) העוטף את האפליקציה
// מספק את הקונטקסט של Convex Auth לכל הרכיבים בתוך האפליקציה
export function Providers({ children }: ProvidersProps) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <ClearTabStateOnSignOut />
      {children}
    </ConvexAuthNextjsProvider>
  );
}

/** Signing out clears this tab's kept brain dump and task draft (lib/tab-state.ts). Renders nothing. */
function ClearTabStateOnSignOut() {
  useClearTabStateOnSignOut(useConvexAuth());
  return null;
}
