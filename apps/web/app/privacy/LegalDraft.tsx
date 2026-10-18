"use client";

import { BrandMark, Wordmark } from "@tempo/ui/brand";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { Lang } from "@/lib/i18n";

/**
 * The shared view for /privacy and /terms: plain first drafts, in English and Hebrew.
 * Each page passes both languages as data; this picks the visitor's language from LocaleProvider
 * (the ?lang= parameter, then the choice saved on this device, then English), like /about and
 * /changelog, and sets dir from it. The draft banner always shows both languages.
 */

/** A paragraph, or a bulleted list when it is an array. */
export type LegalBlock = string | readonly string[];

export type LegalSection = {
  id: string;
  heading: string;
  blocks: readonly LegalBlock[];
};

export type LegalDoc = {
  title: string;
  /** The draft's date line. */
  updated: string;
  lede: string;
  sections: readonly LegalSection[];
};

type Kind = "privacy" | "terms";

const CONTACT_EMAIL = "amit@tempoflow.app";

const BANNER: Record<Lang, { title: string; body: string }> = {
  en: {
    title: "Draft — to be reviewed.",
    body: "This is a plain first draft, not final legal text, and not legal advice. Amit reviews it before release.",
  },
  he: {
    title: "טיוטה — לבדיקה.",
    body: "זו טיוטה ראשונה בשפה פשוטה, לא נוסח משפטי סופי ולא ייעוץ משפטי. עמית בודק אותה לפני ההשקה.",
  },
};

const CHROME: Record<
  Lang,
  { home: string; back: string; also: string; privacy: string; terms: string }
> = {
  en: {
    home: "Tempo Flow home",
    back: "← Back to the home page",
    also: "Also read:",
    privacy: "Privacy",
    terms: "Terms of use",
  },
  he: {
    home: "Tempo Flow — דף הבית",
    back: "→ חזרה לדף הבית",
    also: "כדאי לקרוא גם:",
    privacy: "פרטיות",
    terms: "תנאי שימוש",
  },
};

const OTHER_LANG: Record<Lang, Lang> = { en: "he", he: "en" };

/** The text with the contact address as a mail link, kept left to right inside Hebrew. */
function withEmail(text: string): ReactNode {
  const at = text.indexOf(CONTACT_EMAIL);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        dir="ltr"
        className="text-primary underline underline-offset-2"
      >
        {CONTACT_EMAIL}
      </a>
      {withEmail(text.slice(at + CONTACT_EMAIL.length))}
    </>
  );
}

function BannerLine({ lang }: { lang: Lang }) {
  const copy = BANNER[lang];
  return (
    <p lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <span className="tp-notice__title">{copy.title}</span> <span>{copy.body}</span>
    </p>
  );
}

export function LegalDraft({ kind, docs }: { kind: Kind; docs: Record<Lang, LegalDoc> }) {
  const { lang, dir, setLang, t } = useLocale();
  const doc = docs[lang];
  const chrome = CHROME[lang];
  const other: { href: string; label: string } =
    kind === "privacy"
      ? { href: "/terms", label: chrome.terms }
      : { href: "/privacy", label: chrome.privacy };

  const pick = (next: Lang) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setLang(next);
  };

  return (
    <div
      className="min-h-screen bg-background px-4 py-8 text-foreground md:py-14"
      dir={dir}
      lang={lang}
    >
      <div className="mx-auto w-full max-w-3xl">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label={chrome.home}>
            <BrandMark size={28} />
            <Wordmark size={20} />
          </Link>
          {/* biome-ignore lint/a11y/useSemanticElements: same labelled group of two links as the marketing LanguageSwitch */}
          <div
            className="tp-lang-switch"
            data-component="LanguageSwitch"
            role="group"
            aria-label={t("mk.lang")}
          >
            <a
              href="?lang=en"
              hrefLang="en"
              lang="en"
              aria-current={lang === "en" ? "true" : undefined}
              onClick={pick("en")}
            >
              English
            </a>
            <a
              href="?lang=he"
              hrefLang="he"
              lang="he"
              aria-current={lang === "he" ? "true" : undefined}
              onClick={pick("he")}
            >
              עברית
            </a>
          </div>
        </nav>

        <div className="tp-notice mb-10" data-tone="caution" data-component="Notice" role="note">
          <div className="tp-notice__text">
            <BannerLine lang={lang} />
            <BannerLine lang={OTHER_LANG[lang]} />
          </div>
        </div>

        <h1 className="text-4xl font-bold md:text-5xl">{doc.title}</h1>
        <p className="mt-3 text-small text-muted-foreground">{doc.updated}</p>
        <p className="mt-6 text-h3 leading-relaxed text-foreground">{doc.lede}</p>

        <div className="mt-10 space-y-10 leading-relaxed text-muted-foreground">
          {doc.sections.map((section) => (
            <section key={section.id} aria-labelledby={`legal-${section.id}`}>
              <h2
                id={`legal-${section.id}`}
                className="mb-3 text-2xl font-semibold text-foreground"
              >
                {section.heading}
              </h2>
              <div className="space-y-3">
                {section.blocks.map((block) =>
                  typeof block === "string" ? (
                    <p key={block}>{withEmail(block)}</p>
                  ) : (
                    <ul key={block.join("\n")} className="list-outside list-disc space-y-2 ps-6">
                      {block.map((item) => (
                        <li key={item}>{withEmail(item)}</li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-small">
          <p>
            {chrome.also}{" "}
            <Link href={other.href} className="text-primary hover:underline">
              {other.label}
            </Link>
          </p>
          <Link href="/" className="text-primary hover:underline">
            {chrome.back}
          </Link>
        </footer>
      </div>
    </div>
  );
}
