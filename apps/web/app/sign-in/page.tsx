"use client";

import { useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { getPostAuthDestination, SignInForm } from "@/components/auth/SignInForm";
import { DATA_BACKEND } from "@/lib/backend-flag";
import { useInsforgeSession } from "@/lib/insforge/session";

export default function SignInPage() {
  return DATA_BACKEND === "insforge" ? <InsforgeSignInPage /> : <ConvexSignInPage />;
}

function ConvexSignInPage() {
  const auth = useConvexAuth();
  return <SignInScreen {...auth} />;
}

function InsforgeSignInPage() {
  const { status } = useInsforgeSession();
  return <SignInScreen isAuthenticated={status === "signedIn"} isLoading={status === "loading"} />;
}

function SignInScreen({
  isAuthenticated,
  isLoading,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getPostAuthDestination(searchParams.get("next"));

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, isLoading, nextPath, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    // English-only page: keep it left to right even when the app language is Hebrew.
    <main className="tp-auth" id="main" dir="ltr" lang="en">
      <SignInForm variant="page" nextPath={nextPath} />
    </main>
  );
}
