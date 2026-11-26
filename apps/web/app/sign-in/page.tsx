"use client";

import { useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { SignInForm } from "@/components/auth/SignInForm";

function getPostAuthDestination(nextPath: string | null) {
  const trimmed = nextPath?.trim();

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/today";
  }

  if (
    trimmed === "/dashboard" ||
    trimmed.startsWith("/dashboard?") ||
    trimmed.startsWith("/dashboard/") ||
    trimmed === "/sign-in" ||
    trimmed.startsWith("/sign-in?") ||
    trimmed === "/sign-up" ||
    trimmed.startsWith("/sign-up?")
  ) {
    return "/today";
  }

  return trimmed;
}

export default function SignInPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
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
