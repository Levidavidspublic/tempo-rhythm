"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";

export function NoteNotFound() {
  const { t } = useLocale();
  // A div, not a main: the shell's <main id="main"> already holds this screen.
  return (
    <div className="container mx-auto max-w-3xl px-6 py-12">
      <section className="rounded-3xl border border-border bg-card p-8 shadow-card">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {t("notes.notFound")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("notes.notFoundHint")}</p>
        <Link href="/notes" className="mt-6 inline-block text-sm font-medium text-primary">
          {t("notes.backToList")}
        </Link>
      </section>
    </div>
  );
}
