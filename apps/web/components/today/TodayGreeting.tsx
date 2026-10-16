"use client";

import { cn } from "@/lib/utils";

type TodayGreetingProps = {
  greetingName: string | undefined;
};

export function TodayGreeting({ greetingName }: TodayGreetingProps) {
  const safeName = greetingName?.trim() || "there";

  return (
    <header className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Today</p>
      <h1
        aria-live="polite"
        className={cn(
          // A name taken from a long email handle has no spaces: it wraps instead of pushing the page sideways.
          "font-heading text-4xl font-semibold tracking-tight text-foreground wrap-anywhere md:text-5xl",
        )}
      >
        Hi, <span className="text-gradient-primary">{safeName}</span>
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        One calm screen to start from. A single small step is enough for now.
      </p>
    </header>
  );
}
