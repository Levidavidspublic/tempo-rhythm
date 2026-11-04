"use client";

import Link from "next/link";

export default function NoteError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container mx-auto max-w-3xl px-6 py-12">
      <div className="space-y-4">
        <Link href="/notes" className="text-sm font-medium text-primary">
          ← Back to notes
        </Link>
        <p className="text-lg font-medium text-foreground">We couldn&apos;t open this note.</p>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
