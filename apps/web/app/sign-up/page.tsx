"use client";

import { useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AuthCardLoading } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

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

export default function SignUpPage() {
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
    return <AuthCardLoading />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    // English-only page: keep it left to right even when the app language is Hebrew.
    <main className="tp-auth" id="main" dir="ltr" lang="en">
      <SignUpForm variant="page" nextPath={nextPath} />
    </main>
  );
}
