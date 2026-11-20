"use client";

import { BrandMark, Wordmark } from "@tempo/ui/brand";
import Link from "next/link";
import { useEffect } from "react";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";
import { LanguageSwitch } from "@/components/marketing-pages/MarketingChrome";
import { useLocale } from "@/components/providers/LocaleProvider";
import { getLandingCopy, type SampleLine } from "@/lib/landing-copy";
import "@/app/v3/landing-motion.css";

/**
 * The landing page's body (apps/web/app/page.tsx).
 * @source docs/design/claude-export/design-system/landing.html
 * Words come from lib/landing-copy.ts. The language is the site's (LocaleProvider: ?lang=, then
 * the choice saved on this device, then English), like /about and /changelog; Hebrew is right to
 * left. Insets use start/end so the hero cards and badges mirror in Hebrew.
 */

const CONTACT_EMAIL = "amit@tempoflow.app";

const wrap = "mx-auto w-full max-w-[1240px] px-6 md:px-8";

const ctaPrimary =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full bg-primary px-6 py-3.5 text-small font-medium text-primary-foreground hover:brightness-105";
const ctaGradient =
  "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3.5 text-small font-medium text-primary-foreground hover:brightness-105";
const ctaGhost =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-small font-medium text-foreground hover:bg-surface-sunken";
const ctaOnDark =
  "inline-flex items-center justify-center rounded-full bg-background px-6 py-3.5 text-small font-semibold text-primary hover:brightness-105";

const eyebrow = "font-mono text-caption font-semibold uppercase tracking-[0.16em] text-primary";
/** The eyebrow on the fixed dark sections: the light-theme accent is too dark there. */
const eyebrowOnDark =
  "font-mono text-caption font-semibold uppercase tracking-[0.16em] text-tempo-orange";
const sectionTitle =
  "mt-3 max-w-[18ch] font-serif text-[clamp(2rem,4.4vw,3.625rem)] font-normal leading-[1.08] tracking-tight";
const sectionLede = "mt-5 max-w-[62ch] font-serif text-h3 leading-relaxed text-muted-foreground";
const footerLink = "block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg";

/** The example page's lines: the # line and closing note muted, ## headings in the accent. */
const SAMPLE_LINE: Record<SampleLine["kind"], string> = {
  title: "block text-muted-foreground",
  heading: "mt-2 block text-primary",
  line: "block",
  note: "block text-muted-foreground",
};

/** The hero's example week: filled days had something finished. Not a streak. */
const EXAMPLE_WEEK = [
  { day: "mon", done: true },
  { day: "tue", done: false },
  { day: "wed", done: true },
  { day: "thu", done: true },
  { day: "fri", done: false },
  { day: "sat", done: true },
  { day: "sun", done: false },
] as const;

export function LandingPage() {
  const { lang, dir } = useLocale();
  const copy = getLandingCopy(lang);
  const arrow = dir === "rtl" ? "←" : "→";

  // The server picks the <title> from ?lang= only; follow the saved choice too.
  useEffect(() => {
    document.title = copy.meta.title;
  }, [copy]);

  const { hero, features, coach, pricing, letter, closing, footer } = copy;

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir} lang={lang}>
      <nav className={`${wrap} flex flex-wrap items-center gap-4 py-6 md:gap-8`}>
        <Link href="/" className="flex items-center gap-3" aria-label={copy.nav.home}>
          <BrandMark size={32} />
          {/* The wordmark is a flex row: kept left to right so Hebrew doesn't read it "Flow Tempo". */}
          <span dir="ltr">
            <Wordmark size={22} />
          </span>
        </Link>
        <div className="ms-auto hidden items-center gap-6 text-small text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">
            {copy.nav.features}
          </a>
          <a href="#coach" className="hover:text-foreground">
            {copy.nav.coach}
          </a>
          <a href="#pricing" className="hover:text-foreground">
            {copy.nav.pricing}
          </a>
          <a href="#letter" className="hover:text-foreground">
            {copy.nav.letter}
          </a>
        </div>
        {/* Phones: on the logo's row. Wider screens: after the section links. */}
        <LanguageSwitch long={false} className="ms-auto md:ms-0" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/sign-in" className={ctaGhost}>
            {copy.nav.signIn}
          </Link>
          {/* Phones: the join button next to it already goes to /sign-up. */}
          <Link href="/sign-up" className={`${ctaGhost} max-sm:hidden`}>
            {copy.nav.signUp}
          </Link>
          <Link href="/sign-up" className={`${ctaPrimary} px-4 py-2`}>
            {copy.nav.join}
          </Link>
        </div>
      </nav>

      <main>
        <header className="tempo-hero relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-12">
          <div className={`tempo-hero__copy ${wrap} relative z-[2]`}>
            <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-small text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              {hero.badge}
            </p>
            <h1 className="max-w-[12ch] font-serif text-[clamp(2.75rem,6.8vw,5.75rem)] font-normal leading-[1.02] tracking-tight">
              {hero.titleStart}
              <em className="italic text-primary">{hero.titleEmphasis}</em>
              {hero.titleEnd}
            </h1>
            <p className="mt-6 max-w-[54ch] font-serif text-[clamp(1.125rem,1.8vw,1.5rem)] leading-relaxed text-muted-foreground">
              {hero.lede}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className={ctaGradient}>
                {copy.nav.join}
              </Link>
              <Link href="/sign-up" className={ctaGhost}>
                {copy.nav.signUp}
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-10">
              {hero.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="font-serif text-[28px] font-medium leading-none">{fact.value}</dt>
                  <dd className="mt-1 text-small text-muted-foreground">{fact.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div
            className="tempo-hero__examples pointer-events-none absolute inset-y-0 end-[-120px] hidden w-[48%] lg:block"
            aria-hidden
          >
            <article className="absolute start-5 top-10 w-[280px] -rotate-3 rounded-xl border border-border bg-card p-4 shadow-lift">
              <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                {hero.dumpLabel}
              </p>
              <p className="font-serif text-[15px] leading-relaxed">{hero.dump}</p>
            </article>
            <article className="absolute start-[180px] top-[180px] w-[300px] rotate-2 rounded-xl bg-primary p-4 text-primary-foreground shadow-lift">
              <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-foreground/85">
                {hero.coachLabel}
              </p>
              <p className="mb-1.5 font-serif text-h3 font-medium text-primary-foreground">
                {hero.coachTitle}
              </p>
              <p className="text-small leading-relaxed text-primary-foreground/85">
                {hero.coachBody}
              </p>
            </article>
            <article className="absolute start-[60px] top-[380px] w-[260px] -rotate-2 rounded-xl border border-border bg-card p-4 shadow-lift">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                {hero.weekLabel}
              </p>
              <div className="my-2 flex gap-1.5">
                {EXAMPLE_WEEK.map(({ day, done }) => (
                  <span
                    key={day}
                    className={`h-7 w-7 rounded-md ${done ? "bg-moss" : "bg-surface-sunken"}`}
                  />
                ))}
              </div>
              <p className="text-small">{hero.weekBody}</p>
            </article>
          </div>
        </header>

        <section id="features" className="py-10 md:py-16">
          <div className={wrap}>
            <p className={eyebrow}>{features.eyebrow}</p>
            <h2 className={sectionTitle}>{features.title}</h2>
            <p className={sectionLede}>{features.lede}</p>

            <div className="mt-8 grid items-center gap-8 rounded-xl bg-mkt-dark-bg p-8 text-mkt-dark-fg md:grid-cols-2">
              <div>
                <p className={eyebrowOnDark}>{features.page.eyebrow}</p>
                <h3 className="my-3 font-serif text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-tight tracking-tight text-mkt-dark-fg">
                  {features.page.title}
                </h3>
                <p className="text-body leading-relaxed text-mkt-dark-fg-muted">
                  {features.page.body}
                </p>
                <p className="mt-5 flex flex-wrap gap-5 font-mono text-[11px] uppercase tracking-[0.08em] text-mkt-dark-fg-subtle">
                  {features.page.chips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </p>
              </div>
              <figure className="min-w-0">
                <figcaption className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-mkt-dark-fg-subtle">
                  {features.page.sampleLabel}
                </figcaption>
                <pre className="overflow-x-auto rounded-lg bg-card p-5 font-mono text-caption leading-[1.9] text-foreground shadow-lift">
                  {features.page.sample.map((line) => (
                    <span key={line.text} className={SAMPLE_LINE[line.kind]}>
                      {line.text}
                    </span>
                  ))}
                </pre>
              </figure>
            </div>

            <div className="mt-10 grid grid-cols-12 gap-6">
              <article className="relative col-span-12 min-h-[260px] overflow-hidden rounded-xl border border-border bg-[linear-gradient(145deg,var(--color-card),var(--color-surface-sunken))] p-6 lg:col-span-7 lg:min-h-[420px]">
                <p className="font-mono text-caption font-semibold uppercase tracking-[0.16em] text-amber">
                  {features.brainDump.eyebrow}
                </p>
                <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                  {features.brainDump.title}
                </h3>
                <p className="max-w-[36ch] text-small leading-relaxed text-muted-foreground">
                  {features.brainDump.body}
                </p>
                <div className="mt-6 rounded-lg bg-card p-4 shadow-lift lg:absolute lg:bottom-[-20px] lg:end-[-20px] lg:w-[60%]">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {features.brainDump.orderLabel}
                  </p>
                  <ul className="flex flex-col gap-1.5 text-small">
                    {features.brainDump.order.map((item) => (
                      <li
                        key={item.text}
                        className="flex justify-between gap-3 rounded-md bg-surface-sunken px-2.5 py-2"
                      >
                        <span>{item.text}</span>
                        <span className="font-mono text-[10px] text-primary">{item.tag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="col-span-12 min-h-[260px] rounded-xl border border-border bg-card p-6 lg:col-span-5">
                <p className={eyebrow}>{features.coach.eyebrow}</p>
                <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                  {features.coach.title}
                </h3>
                <p className="text-small leading-relaxed text-muted-foreground">
                  {features.coach.body}
                </p>
                <p className="mt-5 rounded-[10px] bg-surface-sunken p-3 font-serif text-small italic leading-relaxed">
                  <span className="mb-1 block font-mono text-[10px] not-italic uppercase tracking-[0.08em] text-muted-foreground">
                    {features.coach.exampleLabel}
                  </span>
                  {features.coach.example}
                </p>
              </article>

              <article className="col-span-12 min-h-[260px] rounded-xl bg-mkt-dark-bg p-6 text-mkt-dark-fg">
                <p className={eyebrowOnDark}>{features.order.eyebrow}</p>
                <h3 className="my-2 max-w-[24ch] font-serif text-[26px] font-medium tracking-tight text-mkt-dark-fg">
                  {features.order.title}
                </h3>
                <p className="max-w-[54ch] text-small leading-relaxed text-mkt-dark-fg-muted">
                  {features.order.body}
                </p>
              </article>

              {[features.journal, features.routines, features.week].map((card) => (
                <article
                  key={card.eyebrow}
                  className="col-span-12 min-h-[220px] rounded-xl border border-border bg-card p-6 md:col-span-4"
                >
                  <p className={eyebrow}>{card.eyebrow}</p>
                  <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-small leading-relaxed text-muted-foreground">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="coach" className="bg-mkt-dark-bg py-16 text-mkt-dark-fg md:py-20">
          <div className={wrap}>
            <p className={eyebrowOnDark}>{coach.eyebrow}</p>
            <h2 className={`${sectionTitle} text-mkt-dark-fg`}>{coach.title}</h2>
            <p className="mt-5 max-w-[62ch] font-serif text-h3 leading-relaxed text-mkt-dark-fg-muted">
              {coach.lede}
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {coach.examples.map((example) => (
                <figure
                  key={example.caption}
                  className="rounded-lg border border-mkt-dark-border bg-mkt-dark-bubble p-5 font-serif text-h3 leading-relaxed text-mkt-dark-fg"
                >
                  <p>{example.line}</p>
                  <figcaption className="mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-mkt-dark-fg-subtle">
                    {example.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-16 md:py-20">
          <div className={wrap}>
            <p className={eyebrow}>{pricing.eyebrow}</p>
            <h2 className={sectionTitle}>{pricing.title}</h2>
            <p className={sectionLede}>{pricing.lede}</p>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="rounded-xl border border-border bg-card p-8">
                <p className="mb-4 font-mono text-caption uppercase tracking-[0.12em] opacity-70">
                  {pricing.beta.label}
                </p>
                <p className="font-serif text-[64px] font-medium leading-none">
                  {pricing.beta.price}
                  <span className="font-sans text-h3 font-normal text-muted-foreground">
                    {" "}
                    {pricing.beta.suffix}
                  </span>
                </p>
                <p className="my-6 text-small leading-relaxed">{pricing.beta.body}</p>
                <ul className="mb-6 space-y-2 text-small leading-8">
                  {pricing.beta.includes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary" aria-hidden>
                        {arrow}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className={ctaPrimary}>
                  {pricing.beta.cta}
                </Link>
              </article>
              <article className="relative rounded-xl bg-gradient-to-br from-mkt-dark-bg to-mkt-dark-bg-2 p-8 text-mkt-dark-fg">
                <p className="absolute end-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                  {pricing.now.badge}
                </p>
                <p className="mb-4 font-mono text-caption uppercase tracking-[0.12em] text-mkt-dark-fg-subtle">
                  {pricing.now.label}
                </p>
                <p className="font-serif text-[64px] font-medium leading-none">
                  {pricing.now.price}
                  <span className="font-sans text-h3 font-normal text-mkt-dark-fg-muted">
                    {" "}
                    {pricing.now.suffix}
                  </span>
                </p>
                <p className="my-6 text-small leading-relaxed">{pricing.now.body}</p>
                <ul className="mb-6 space-y-2 text-small leading-8">
                  {pricing.now.includes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary" aria-hidden>
                        {arrow}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className={ctaGradient}>
                  {pricing.now.cta}
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section id="letter" className="bg-surface-sunken py-16 md:py-20">
          <div className={wrap}>
            <article className="mx-auto max-w-[780px] rounded-2xl border border-border bg-card p-8 md:p-12">
              <p className={eyebrow}>{letter.eyebrow}</p>
              <h2 className="mt-3 font-serif text-[36px] font-normal leading-tight tracking-tight">
                {letter.title}
              </h2>
              <div className="mt-4 space-y-4 font-serif text-[19px] leading-[1.7]">
                {letter.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p className="pt-2 font-serif text-[28px] italic">{letter.signature}</p>
              </div>
            </article>
          </div>
        </section>

        <section className="bg-primary py-16 text-center text-primary-foreground md:py-20">
          <div className={wrap}>
            <h2 className="mx-auto max-w-[20ch] font-serif text-[clamp(2rem,4.4vw,3.625rem)] font-normal leading-[1.08] tracking-tight text-primary-foreground">
              {closing.title}
            </h2>
            <p className="mx-auto mt-4 max-w-[62ch] font-serif text-h3 leading-relaxed text-primary-foreground/90">
              {closing.body}
            </p>
            <Link href="/sign-up" className={`${ctaOnDark} mt-8`}>
              {closing.cta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-mkt-dark-bg py-12 text-mkt-dark-fg">
        <div className={wrap}>
          <div className="grid gap-8 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <BrandMark size={28} />
                <span dir="ltr">
                  <Wordmark size={22} color="var(--color-mkt-dark-fg)" />
                </span>
              </div>
              <p className="max-w-[30ch] font-serif text-h3 leading-relaxed text-mkt-dark-fg-muted">
                {footer.tagline}
              </p>
            </div>
            <div>
              <h2 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-mkt-dark-fg-subtle">
                {footer.product}
              </h2>
              <a href="#features" className={footerLink}>
                {footer.features}
              </a>
              <a href="#coach" className={footerLink}>
                {footer.coach}
              </a>
              <a href="#pricing" className={footerLink}>
                {footer.pricing}
              </a>
              <Link href="/sign-up" className={footerLink}>
                {footer.signUp}
              </Link>
            </div>
            <div>
              <h2 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-mkt-dark-fg-subtle">
                {footer.legal}
              </h2>
              <Link href="/privacy" className={footerLink}>
                {footer.privacy}
              </Link>
              <Link href="/terms" className={footerLink}>
                {footer.terms}
              </Link>
              <Link href="/contact" className={footerLink}>
                {footer.contact}
              </Link>
              <a href={`mailto:${CONTACT_EMAIL}`} className={footerLink}>
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-mkt-dark-border pt-6 font-mono text-caption text-mkt-dark-fg-subtle">
            <span>{footer.license}</span>
            <LanguageSwitch long className="font-sans" />
            <span>{footer.status}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
