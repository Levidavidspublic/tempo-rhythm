"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient, useConvexAuth } from "convex/react";
import type React from "react";
import { useClearTabStateOnSignOut } from "@/lib/tab-state";

// Initialize the Convex client with the server URL
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ProvidersProps {
  children: React.ReactNode;
}

// Providers component that wraps the application
// Provides the Convex Auth context to every component in the application
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
