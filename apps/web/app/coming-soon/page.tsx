import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon/ComingSoon";
import { trialCheckoutUrl } from "@/lib/checkout";

/**
 * Coming-soon page.
 * @source design export: public-coming-soon.html (phone: mobile/public-coming-soon.html)
 * @auth public. On the coming-soon surface (live) this is what "/" shows; see lib/surface.ts.
 */
export const metadata: Metadata = {
  title: "Tempo Flow - Coming soon",
  description:
    "Brain-dump everything. Tempo turns it into one next step, plans the day around your energy, and nudges you in your own words.",
};

// Reads the checkout flag when the page is requested, not when it is built.
export const dynamic = "force-dynamic";

export default function Page() {
  return <ComingSoon trialHref={trialCheckoutUrl()} />;
}
