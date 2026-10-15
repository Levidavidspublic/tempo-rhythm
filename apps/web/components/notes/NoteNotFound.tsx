import Link from "next/link";

export function NoteNotFound() {
  return (
    <main className="container mx-auto max-w-3xl px-6 py-12">
      <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          We couldn&apos;t find that note
        </h1>
        <p className="mt-2 text-muted-foreground">
          It may have been removed, or the link may no longer be available.
        </p>
        <Link href="/notes" className="mt-6 inline-block text-sm font-medium text-primary">
          Back to notes
        </Link>
      </section>
    </main>
  );
}
