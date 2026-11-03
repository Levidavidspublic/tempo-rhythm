import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing-pages/LandingPage";
import { isLang } from "@/lib/i18n";
import { getLandingCopy } from "@/lib/landing-copy";

/**
 * Public marketing page.
 * @source docs/design/claude-export/design-system/landing.html
 * @auth public for signed-out visitors. Signed-in "/" is redirected to /today.
 *
 * Every word, the metadata included, comes from lib/landing-copy.ts (English and Hebrew), and
 * says only what the beta does today. The page follows the site language like /about: ?lang=en|he,
 * else the choice saved on this device, else English; Hebrew is right to left.
 * The server sees only ?lang=, so it picks the metadata from that; LandingPage retitles the tab
 * when the saved choice differs. Account buttons go to /sign-in and /sign-up. No payment form.
 */

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang } = await searchParams;
  return getLandingCopy(isLang(lang) ? lang : "en").meta;
}

export default function Page() {
  return <LandingPage />;
}
