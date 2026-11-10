import "@tempo/ui/theme/tempo-flow-tokens.css";
import "./coming-soon.css";
import "./export.generated.css";
import { ComingSoonEffects } from "./ComingSoonEffects";
import { Closing } from "./sections/Closing";
import { Compare } from "./sections/Compare";
import { Defs } from "./sections/Defs";
import { Demo } from "./sections/Demo";
import { Fibre } from "./sections/Fibre";
import { Footer } from "./sections/Footer";
import { Header } from "./sections/Header";
import { Hero } from "./sections/Hero";
import { Keynote } from "./sections/Keynote";
import { Metronome } from "./sections/Metronome";
import { Problem } from "./sections/Problem";
import { Pledge } from "./sections/Pledge";
import { WaitlistForm } from "./WaitlistForm";

const TRIAL_LABEL = "Start your $1 trial";
const TRIAL_TERMS = "$1 today, a 21-day trial, then $10 a month.";

/**
 * The public coming-soon page, ported from the design export (public-coming-soon.html; the phone
 * file is the same markup plus one stylesheet rule, so this is one responsive page).
 *
 * Differences from the export, all because production shows only this page and has no sign-in:
 * - no Pricing / About / Contact / Hebrew / Privacy / Terms links (no pages behind them here);
 * - no "Beta tester? Sign in" links;
 * - a "$1 trial" link in those same three places, only when `trialHref` is set (checkout flag on).
 */
export function ComingSoon({ trialHref }: { trialHref: string | null }) {
  const nav = trialHref ? (
    <nav
      aria-label="Main"
      style={{
        display: "flex",
        gap: "18px",
        alignItems: "center",
        flexWrap: "wrap",
        fontSize: "15px",
      }}
    >
      <a
        href={trialHref}
        className="tf-shine"
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: "44px",
          padding: "0 16px",
          borderRadius: "999px",
          background: "var(--tp-ink)",
          color: "var(--tp-ground)",
          textDecoration: "none",
          fontWeight: "600",
        }}
      >
        {TRIAL_LABEL}
      </a>
    </nav>
  ) : null;

  const note = trialHref ? (
    <>
      Don't want to wait?{" "}
      <a href={trialHref} style={{ color: "var(--tp-accent)", fontWeight: "600" }}>
        {TRIAL_LABEL}
      </a>
      {": "}
      {TRIAL_TERMS} No spam, ever.
    </>
  ) : (
    "No spam, ever."
  );

  const closingTrial = trialHref ? (
    <a
      href={trialHref}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "48px",
        padding: "0 22px",
        borderRadius: "999px",
        border: "1.5px solid var(--tp-ground)",
        color: "var(--tp-ground)",
        fontWeight: "600",
        textDecoration: "none",
      }}
    >
      {TRIAL_LABEL}
    </a>
  ) : null;

  return (
    <div className="tf-page" data-tempo-flow="">
      <div
        className="tf-root"
        style={{
          position: "relative",
          background: "var(--tp-ground)",
          color: "var(--tp-ink)",
          fontFamily: "'Source Sans 3',sans-serif",
          minHeight: "100%",
          overflowX: "hidden",
        }}
      >
        <Defs />
        <Fibre />
        <Header nav={nav} />
        <Hero waitlist={<WaitlistForm note={note} />} />
        <Keynote />
        <Problem />
        <Metronome />
        <Demo />
        <Pledge />
        <Compare />
        <Closing trial={closingTrial} />
        <Footer />
      </div>
      <ComingSoonEffects />
    </div>
  );
}
