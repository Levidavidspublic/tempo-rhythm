import { BrandMark, Wordmark } from "@tempo/ui/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/marketing/ThemeToggle";

/**
 * Public marketing page.
 * @source docs/design/claude-export/design-system/landing.html
 * @auth public for signed-out visitors. Signed-in "/" is redirected to /today.
 *
 * landing.html has no FAQ section (the design README mentions one). This page
 * ports the sections that file actually contains.
 * Account buttons go to /sign-in and /sign-up. No payment form.
 */

export const metadata: Metadata = {
  title: "Tempo Flow — A gentle planner for messy brains",
  description:
    "Tempo Flow is a calm, AI-gentle planner for ADHD brains, autistic brains, anxious brains, and anyone who's tried seventeen productivity apps and bounced off all of them.",
};

const wrap = "mx-auto w-full max-w-[1240px] px-6 md:px-8";

const ctaPrimary =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full bg-primary px-6 py-3.5 text-small font-medium text-primary-foreground hover:brightness-105";
const ctaGradient =
  "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3.5 text-small font-medium text-primary-foreground hover:brightness-105";
const ctaGhost =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-small font-medium text-foreground hover:bg-surface-sunken";
const ctaOnDark =
  "inline-flex items-center justify-center rounded-full bg-background px-6 py-3.5 text-small font-semibold text-primary hover:brightness-105";

const eyebrow =
  "font-mono text-caption font-semibold uppercase tracking-[0.16em] text-primary";
/** The eyebrow on the fixed dark sections: the light-theme accent is too dark there. */
const eyebrowOnDark =
  "font-mono text-caption font-semibold uppercase tracking-[0.16em] text-tempo-orange";
const sectionTitle =
  "mt-3 max-w-[18ch] font-serif text-[clamp(2rem,4.4vw,3.625rem)] font-normal leading-[1.08] tracking-tight";
const sectionLede = "mt-5 max-w-[62ch] font-serif text-h3 leading-relaxed text-muted-foreground";

const PROOF = [
  ["42", "handcrafted screens"],
  ["1", "person, one year"],
  ["Free", "during beta"],
  ["0", "guilt trips, ever"],
] as const;

const WEEK_INCLUDES = [
  "All 42 screens, unlocked",
  "AI coach · warmth dial · voice",
  "Web + iOS + Android",
  "No auto-enrollment",
] as const;

const PRO_INCLUDES = [
  "Everything in the beta",
  "Unlimited journal + templates",
  "Cloud sync across devices",
  "Email the founder any time",
] as const;

export default function LandingPage() {
  return (
    // English-only page: keep it left to right even when the app language is Hebrew.
    <div className="min-h-screen bg-background text-foreground" dir="ltr" lang="en">
      <nav className={`${wrap} flex flex-wrap items-center gap-4 py-6 md:gap-8`}>
        <Link href="/" className="flex items-center gap-3" aria-label="Tempo Flow home">
          <BrandMark size={32} />
          <Wordmark size={22} />
        </Link>
        <div className="ml-auto hidden items-center gap-6 text-small text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#coach" className="hover:text-foreground">
            Coach
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#letter" className="hover:text-foreground">
            Manifesto
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/sign-in" className={ctaGhost}>
            Sign in
          </Link>
          {/* Phones: "Join the free beta" next to it already goes to /sign-up. */}
          <Link href="/sign-up" className={`${ctaGhost} max-sm:hidden`}>
            Sign up
          </Link>
          <Link href="/sign-up" className={`${ctaPrimary} px-4 py-2`}>
            Join the free beta
          </Link>
        </div>
      </nav>

      <main>
        <header className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-12">
          <div className={`${wrap} relative z-[2]`}>
            <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-small text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              Closed beta open now
            </p>
            <h1 className="max-w-[12ch] font-serif text-[clamp(2.75rem,6.8vw,5.75rem)] font-normal leading-[1.02] tracking-tight">
              A planner that won&apos;t <em className="italic text-primary">shame</em>
              <br />
              your nervous system.
            </h1>
            <p className="mt-6 max-w-[54ch] font-serif text-[clamp(1.125rem,1.8vw,1.5rem)] leading-relaxed text-muted-foreground">
              Tempo Flow is a calm, AI-gentle planner for ADHD brains, autistic brains, anxious
              brains, and anyone who&apos;s tried seventeen productivity apps and bounced off all of
              them. Dump your thoughts. We&apos;ll help you find the next doable thing.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className={ctaGradient}>
                Join the free beta
              </Link>
              <Link href="/sign-up" className={ctaGhost}>
                Sign up
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-10">
              {PROOF.map(([value, label]) => (
                <div key={label}>
                  <dt className="font-serif text-[28px] font-medium leading-none">{value}</dt>
                  <dd className="mt-1 text-small text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 right-[-120px] hidden w-[48%] lg:block"
            aria-hidden
          >
            <article className="absolute left-5 top-10 w-[280px] -rotate-3 rounded-xl border border-border bg-card p-4 shadow-lift">
              <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                Brain Dump · 09:41
              </p>
              <p className="font-serif text-[15px] leading-relaxed">
                Finish landing copy. Book dentist. Ask Sam about Convex. Pick up groceries. Am I
                shipping fast enough?
              </p>
            </article>
            <article className="absolute left-[180px] top-[180px] w-[300px] rotate-2 rounded-xl bg-primary p-4 text-primary-foreground shadow-lift">
              <p className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-foreground/85">
                Coach
              </p>
              <p className="mb-1.5 font-serif text-h3 font-medium text-primary-foreground">
                Three things look doable this afternoon.
              </p>
              <p className="text-small leading-relaxed text-primary-foreground/85">
                I pulled them from your dump. The worry I left on the side — we&apos;ll look at it
                tomorrow.
              </p>
            </article>
            <article className="absolute left-[60px] top-[380px] w-[260px] -rotate-2 rounded-xl border border-border bg-card p-4 shadow-lift">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                Today · 5-day streak
              </p>
              <div className="my-2 flex gap-1.5">
                {["a", "b", "c", "d", "e"].map((day) => (
                  <span key={day} className="h-7 w-7 rounded-md bg-moss" />
                ))}
                {["f", "g"].map((day) => (
                  <span key={day} className="h-7 w-7 rounded-md bg-surface-sunken" />
                ))}
              </div>
              <p className="text-small">Morning pages — five days running. Nice.</p>
            </article>
          </div>
        </header>

        <section id="features" className="py-10 md:py-16">
          <div className={wrap}>
            <p className={eyebrow}>What&apos;s inside</p>
            <h2 className={sectionTitle}>
              Tasks, notes, and calendar — one markdown page per day.
            </h2>
            <p className={sectionLede}>
              Every feature below started as a frustration with another app. Dump, sort, plan, do,
              reflect — in a single plaintext file you actually own. Linked, searchable, yours
              forever.
            </p>

            <div className="mt-8 grid items-center gap-8 rounded-xl bg-mkt-dark-bg p-8 text-mkt-dark-fg md:grid-cols-2">
              <div>
                <p className={eyebrowOnDark}>★ Daily Note</p>
                <h3 className="my-3 font-serif text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-tight tracking-tight text-mkt-dark-fg">
                  Markdown-native. Bi-directionally linked. Gently animated.
                </h3>
                <p className="text-body leading-relaxed text-mkt-dark-fg-muted">
                  Inspired by the clarity of tools like NotePlan — but warmer, quieter, and tuned
                  for brains that need a little help staying on the page. A focus ring that
                  breathes. Task completes that gently delight. Time blocks that pulse where you are
                  right now.
                </p>
                <p className="mt-5 flex flex-wrap gap-5 font-mono text-[11px] uppercase tracking-[0.08em] text-mkt-dark-fg-subtle">
                  <span>[[ bi-di links ]]</span>
                  <span>⌘K command bar</span>
                  <span>#tags · @people</span>
                </p>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-card p-5 font-mono text-caption leading-[1.9] text-foreground shadow-lift">
                <span className="block text-muted-foreground"># ☀️ Thursday</span>
                <span className="block text-primary">## Intentions</span>
                <span className="block">Ship launch post by noon. Protect the afternoon.</span>
                <span className="mt-2 block text-primary">## Tasks</span>
                <span className="block">* [x] Morning pages — [[Journal]]</span>
                <span className="block">* [ ] Draft launch post @09:30 #writing</span>
                <span className="block">* [ ] Ten-minute walk @12:30</span>
                <span className="mt-2 block text-primary">## Notes</span>
                <span className="block text-muted-foreground">
                  Sam replied on [[Convex migration]]...
                </span>
              </pre>
            </div>

            <div className="mt-10 grid grid-cols-12 gap-6">
              <article className="relative col-span-12 min-h-[260px] overflow-hidden rounded-xl border border-border bg-[linear-gradient(145deg,var(--color-card),var(--color-surface-sunken))] p-6 lg:col-span-7 lg:min-h-[420px]">
                <p className="font-mono text-caption font-semibold uppercase tracking-[0.16em] text-amber">
                  01 — Brain Dump
                </p>
                <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                  Empty your head onto the page. We&apos;ll do the sorting.
                </h3>
                <p className="max-w-[36ch] text-small leading-relaxed text-muted-foreground">
                  Write everything — tasks, worries, ideas, grocery items — in one messy stream. Our
                  AI untangles it into tasks, notes, journal fragments, and quiet &quot;let&apos;s
                  sit with this&quot; items. No format to learn, no tags to choose.
                </p>
                <div className="mt-6 rounded-lg bg-card p-4 shadow-lift lg:absolute lg:bottom-[-20px] lg:right-[-20px] lg:w-[60%]">
                  <p className="mb-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
                    SORTED · 6 ITEMS
                  </p>
                  <ul className="flex flex-col gap-1.5 text-small">
                    <li className="flex justify-between gap-3 rounded-md bg-surface-sunken px-2.5 py-2">
                      <span>✓ Finish landing copy</span>
                      <span className="font-mono text-[10px] text-primary">TASK</span>
                    </li>
                    <li className="flex justify-between gap-3 rounded-md bg-surface-sunken px-2.5 py-2">
                      <span>✓ Book dentist</span>
                      <span className="font-mono text-[10px] text-primary">TASK</span>
                    </li>
                    <li className="flex justify-between gap-3 rounded-md bg-surface-sunken px-2.5 py-2">
                      <span>◉ Am I shipping fast enough?</span>
                      <span className="font-mono text-[10px] text-muted-foreground">WORRY</span>
                    </li>
                  </ul>
                </div>
              </article>

              <article className="col-span-12 min-h-[260px] rounded-xl border border-border bg-card p-6 lg:col-span-5">
                <p className={eyebrow}>02 — Coach</p>
                <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                  A voice that checks in, not checks up.
                </h3>
                <p className="text-small leading-relaxed text-muted-foreground">
                  Tap a warmth dial from 0 (businesslike) to 10 (your kindest friend). The coach
                  reads your dump, suggests a plan, and stays quiet when you don&apos;t need it.
                </p>
                <p className="mt-5 rounded-[10px] bg-surface-sunken p-3 font-serif text-small italic leading-relaxed">
                  &quot;Three doable things. The rest can wait.&quot;
                </p>
              </article>

              <article className="col-span-12 min-h-[260px] rounded-xl bg-mkt-dark-bg p-6 text-mkt-dark-fg">
                <p className={eyebrowOnDark}>03 — First Plan</p>
                <h3 className="my-2 max-w-[24ch] font-serif text-[26px] font-medium tracking-tight text-mkt-dark-fg">
                  A three-block day, already scheduled. You can still say no.
                </h3>
                <p className="max-w-[54ch] text-small leading-relaxed text-mkt-dark-fg-muted">
                  On launch mornings, the plan is waiting. Drag to rearrange. Tap to skip. The
                  calendar respects your energy — high-focus before noon, soft blocks after three,
                  zero guilt if you close the laptop.
                </p>
              </article>

              <article className="col-span-12 min-h-[220px] rounded-xl border border-border bg-card p-6 md:col-span-4">
                <p className={eyebrow}>04 — Journal</p>
                <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                  Prompts that fit your day.
                </h3>
                <p className="text-small leading-relaxed text-muted-foreground">
                  Encrypted at rest, prompts that shift with your mood, and never, ever a red streak
                  warning.
                </p>
              </article>
              <article className="col-span-12 min-h-[220px] rounded-xl border border-border bg-card p-6 md:col-span-4">
                <p className={eyebrow}>05 — Routines</p>
                <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                  Guided, not gamified.
                </h3>
                <p className="text-small leading-relaxed text-muted-foreground">
                  Run a morning routine like a meditation — one step at a time, with gentle audio
                  cues. Skip anything.
                </p>
              </article>
              <article className="col-span-12 min-h-[220px] rounded-xl border border-border bg-card p-6 md:col-span-4">
                <p className={eyebrow}>06 — Weekly</p>
                <h3 className="my-2 font-serif text-[26px] font-medium tracking-tight">
                  Sunday, softly.
                </h3>
                <p className="text-small leading-relaxed text-muted-foreground">
                  A weekly recap written in the coach&apos;s voice — proud of what got done, gentle
                  about what didn&apos;t.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="coach" className="bg-mkt-dark-bg py-16 text-mkt-dark-fg md:py-20">
          <div className={wrap}>
            <p className={eyebrowOnDark}>The coach</p>
            <h2 className={`${sectionTitle} text-mkt-dark-fg`}>
              It sounds like a person who&apos;s met you before.
            </h2>
            <p className="mt-5 max-w-[62ch] font-serif text-h3 leading-relaxed text-mkt-dark-fg-muted">
              Warmth dial set to 6 by default. Moves lower when you&apos;re heads-down, higher when
              the dump feels anxious. Below: actual lines from actual days.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <blockquote className="rounded-lg border border-mkt-dark-border bg-mkt-dark-bubble p-5 font-serif text-h3 leading-relaxed text-mkt-dark-fg">
                &quot;You finished two of three yesterday. That counts. Want to start with the
                unfinished one, or a lighter warm-up?&quot;
                <span className="mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-mkt-dark-fg-subtle">
                  Monday · 09:12 · warmth 6
                </span>
              </blockquote>
              <blockquote className="rounded-lg border border-mkt-dark-border bg-mkt-dark-bubble p-5 font-serif text-h3 leading-relaxed text-mkt-dark-fg">
                &quot;The dump looks heavy today. Three items feel like worries, not tasks. Want to
                park them, or look at one?&quot;
                <span className="mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-mkt-dark-fg-subtle">
                  Wednesday · 08:40 · warmth 7
                </span>
              </blockquote>
              <blockquote className="rounded-lg border border-mkt-dark-border bg-mkt-dark-bubble p-5 font-serif text-h3 leading-relaxed text-mkt-dark-fg">
                &quot;You protected the afternoon yesterday. That was a hard call. Noting it.&quot;
                <span className="mt-4 block font-mono text-[11px] uppercase tracking-[0.08em] text-mkt-dark-fg-subtle">
                  Friday · evening recap · warmth 5
                </span>
              </blockquote>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-16 md:py-20">
          <div className={wrap}>
            <p className={eyebrow}>Pricing</p>
            <h2 className={sectionTitle}>Free during beta. Sign up, then Amit lets you in.</h2>
            <p className={sectionLede}>
              Amit approves each new account by hand. Once you&apos;re in, you get the whole app
              while beta lasts. No card, and no trial clock.
            </p>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="rounded-xl border border-border bg-card p-8">
                <p className="mb-4 font-mono text-caption uppercase tracking-[0.12em] opacity-70">
                  Beta
                </p>
                <p className="font-serif text-[64px] font-medium leading-none">
                  Free
                  <span className="font-sans text-h3 font-normal text-muted-foreground">
                    {" "}
                    · sign up
                  </span>
                </p>
                <p className="my-6 text-small leading-relaxed">
                  The whole app, for as long as beta stays open. Sign up when you want a place to
                  put today.
                </p>
                <ul className="mb-6 space-y-2 text-small leading-8">
                  {WEEK_INCLUDES.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary" aria-hidden>
                        →
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className={ctaPrimary}>
                  Join the free beta →
                </Link>
              </article>
              <article className="relative rounded-xl bg-gradient-to-br from-mkt-dark-bg to-mkt-dark-bg-2 p-8 text-mkt-dark-fg">
                <p className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                  Included now
                </p>
                <p className="mb-4 font-mono text-caption uppercase tracking-[0.12em] text-mkt-dark-fg-subtle">
                  What you get
                </p>
                <p className="font-serif text-[64px] font-medium leading-none">
                  Free
                  <span className="font-sans text-h3 font-normal text-mkt-dark-fg-muted">
                    {" "}
                    · during beta
                  </span>
                </p>
                <p className="my-6 text-small leading-relaxed">
                  Journal, templates, and sync are part of the beta. A paid price is not on this
                  page, because signup does not charge one.
                </p>
                <ul className="mb-6 space-y-2 text-small leading-8">
                  {PRO_INCLUDES.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary" aria-hidden>
                        →
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className={ctaGradient}>
                  Join the free beta →
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className={wrap}>
            <p className={eyebrow}>Beta testers</p>
            <h2 className={sectionTitle}>
              Thirty people used it for four weeks. Here&apos;s what they said.
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <figure className="rounded-lg border border-border bg-card p-6">
                <blockquote className="font-serif text-h3 leading-relaxed">
                  &quot;It&apos;s the first planner that didn&apos;t make me feel like a broken
                  version of a neurotypical person. I used it for 23 out of 28 days. That&apos;s a
                  record.&quot;
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5 text-small">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                    M
                  </span>
                  <span className="font-medium">
                    Mira K.
                    <span className="block text-caption font-normal text-muted-foreground">
                      Designer · ADHD
                    </span>
                  </span>
                </figcaption>
              </figure>
              <figure className="rounded-lg border border-border bg-card p-6">
                <blockquote className="font-serif text-h3 leading-relaxed">
                  &quot;I pay for Notion and Sunsama and Things. I&apos;d cancel all three for this.
                  The coach understood when I was having a hard week without me having to spell it
                  out.&quot;
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5 text-small">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                    J
                  </span>
                  <span className="font-medium">
                    Jonah R.
                    <span className="block text-caption font-normal text-muted-foreground">
                      Engineer · autistic
                    </span>
                  </span>
                </figcaption>
              </figure>
              <figure className="rounded-lg border border-border bg-card p-6">
                <blockquote className="font-serif text-h3 leading-relaxed">
                  &quot;The brain dump is genuinely unreasonable. I&apos;ve written 3000 words into
                  it in two weeks and none of them are wasted.&quot;
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5 text-small">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-serif text-primary-foreground">
                    S
                  </span>
                  <span className="font-medium">
                    Sana P.
                    <span className="block text-caption font-normal text-muted-foreground">
                      Writer
                    </span>
                  </span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section id="letter" className="bg-surface-sunken py-16 md:py-20">
          <div className={wrap}>
            <article className="mx-auto max-w-[780px] rounded-2xl border border-border bg-card p-8 md:p-12">
              <p className={eyebrow}>A letter from Amit</p>
              <h2 className="mt-3 font-serif text-[36px] font-normal leading-tight tracking-tight">
                Why I built this alone.
              </h2>
              <div className="mt-4 space-y-4 font-serif text-[19px] leading-[1.7]">
                <p>
                  I&apos;ve had sixteen planners. I&apos;ve paid for eight. I was diagnosed with
                  ADHD at thirty-four, and the thing that surprised me most was not the diagnosis —
                  it was how much software in my life had quietly been shaming me for not being a
                  person I wasn&apos;t.
                </p>
                <p>
                  Tempo Flow is one person&apos;s answer to that. It&apos;s small. It doesn&apos;t
                  try to be your operating system. It tries to be the friend who texts &quot;what
                  are you doing today?&quot; without judgment.
                </p>
                <p>
                  If it works for you, that is enough. Beta is free while it is open. If it does not
                  fit, you can leave it there.
                </p>
                <p className="pt-2 font-serif text-[28px] italic">— Amit</p>
              </div>
            </article>
          </div>
        </section>

        <section className="bg-primary py-16 text-center text-primary-foreground md:py-20">
          <div className={wrap}>
            <h2 className="mx-auto max-w-[20ch] font-serif text-[clamp(2rem,4.4vw,3.625rem)] font-normal leading-[1.08] tracking-tight text-primary-foreground">
              Free during beta. One gentle week at a time.
            </h2>
            <p className="mx-auto mt-4 max-w-[62ch] font-serif text-h3 leading-relaxed text-primary-foreground/90">
              No credit card. No newsletter enrollment. No growth loops. Just the app.
            </p>
            <Link href="/sign-up" className={`${ctaOnDark} mt-8`}>
              Join the free beta
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
                <Wordmark size={22} color="var(--color-mkt-dark-fg)" />
              </div>
              <p className="max-w-[30ch] font-serif text-h3 leading-relaxed text-mkt-dark-fg-muted">
                A gentle planner for messy brains. Made in Tel Aviv by one person.
              </p>
            </div>
            <div>
              <h2 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-mkt-dark-fg-subtle">
                Product
              </h2>
              <a
                href="#features"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                Features
              </a>
              <a
                href="#coach"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                The Coach
              </a>
              <a
                href="#pricing"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                Pricing
              </a>
              <Link
                href="/sign-up"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                Sign up
              </Link>
            </div>
            <div>
              <h2 className="mb-4 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-mkt-dark-fg-subtle">
                Legal
              </h2>
              <Link
                href="/privacy"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                Terms
              </Link>
              <Link
                href="/contact"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                Contact
              </Link>
              <a
                href="mailto:amit@tempoflow.app"
                className="block text-small leading-8 text-mkt-dark-fg-muted hover:text-mkt-dark-fg"
              >
                amit@tempoflow.app
              </a>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap justify-between gap-3 border-t border-mkt-dark-border pt-6 font-mono text-caption text-mkt-dark-fg-subtle">
            <span>© 2026 Tempo Flow · BUSL-1.1</span>
            <span>v1.0.0 · Closed beta</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
