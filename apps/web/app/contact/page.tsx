import { BrandMark, Wordmark } from "@tempo/ui/brand";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * Public contact page, linked from the landing footer.
 * The old page was a form that only logged to the console and listed a support address on a
 * domain that doesn't resolve. Tempo has no contact backend, so this page sends people to the
 * one address the landing already publishes, as a plain mailto link.
 */

export const metadata: Metadata = {
  title: "Contact — Tempo Flow",
  description: "Write to Amit, who builds Tempo Flow.",
};

const CONTACT_EMAIL = "amit@tempoflow.app";

export default function ContactPage() {
  return (
    // English-only page, like the landing: keep it left to right even when the app language is Hebrew.
    <div className="min-h-screen bg-background text-foreground" dir="ltr" lang="en">
      <nav className="mx-auto flex w-full max-w-[1240px] items-center px-6 py-6 md:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Tempo Flow home">
          <BrandMark size={32} />
          <Wordmark size={22} />
        </Link>
      </nav>

      <main className="mx-auto w-full max-w-[780px] px-6 pb-20 pt-6 md:px-8 md:pt-12">
        <article className="rounded-2xl border border-border bg-card p-8 md:p-12">
          <p className="font-mono text-caption font-semibold uppercase tracking-[0.16em] text-primary">
            Contact
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2rem,4.4vw,2.75rem)] font-normal leading-tight tracking-tight">
            Write to Amit.
          </h1>
          <div className="mt-4 space-y-4 font-serif text-h3 leading-relaxed text-muted-foreground">
            <p>
              Tempo Flow is built by one person. For a question, an idea, or something that broke,
              email Amit.
            </p>
            <p>
              Signed up and still waiting for approval? Amit approves each new account by hand. Once
              you&apos;re in, signing in with the same email opens the app.
            </p>
          </div>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-8 inline-flex items-center justify-center whitespace-nowrap rounded-full bg-primary px-6 py-3.5 text-small font-medium text-primary-foreground hover:brightness-105"
          >
            {CONTACT_EMAIL}
          </a>
        </article>

        <p className="mt-8 text-center text-small">
          <Link href="/" className="text-primary hover:underline">
            ← Back to the home page
          </Link>
        </p>
      </main>
    </div>
  );
}
