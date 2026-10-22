/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test covers the same checks.
 */
import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type Lang, type MessageKey, translate } from "@/lib/i18n";
import { formatUsd, TIERS, tierPrice } from "@/lib/settings/billing";
import type { CurrentPlan } from "./PlanCard";

const betaTester: CurrentPlan = {
  plan: "max",
  status: "active",
  label: "Beta tester",
  betaAccess: "tester",
  entitlementTier: "max",
  userType: "paid",
  isBeta: true,
};

const paidPro: CurrentPlan = {
  plan: "pro",
  status: "active",
  label: "Pro",
  betaAccess: "none",
  entitlementTier: "pro",
  userType: "paid",
  isBeta: false,
};

let planResult: CurrentPlan | null | undefined = betaTester;
let language: Lang = "en";
beforeEach(() => { language = "en"; planResult = betaTester; });

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("convex/react", () => ({
  useQuery: () => planResult,
}));

mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: language, dir: language === "he" ? "rtl" : "ltr", setLang() {}, t: (key: MessageKey) => translate(language, key) }),
}));

const { BillingPlan } = await import("./BillingPlan");
const { PlanCard } = await import("./PlanCard");
const { PublicPricing } = await import("../marketing-pages/PublicPricing");

function renderPlan(): string {
  return renderToStaticMarkup(createElement(BillingPlan) as ReactElement);
}

function controls(html: string): string[] {
  return html.match(/<(button|a)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
}

describe("BillingPlan", () => {
  test("early access: Max is the current plan, every price shows, and nothing can be bought", () => {
    planResult = betaTester;
    const html = renderPlan();
    expect(html).toContain('aria-label="Current plan"');
    expect(html).toContain("You were approved early, so you have Max.");
    expect(html).toMatch(/data-current="true" aria-labelledby="t-max"/);
    expect(html).toContain("Your plan");
    expect(html).toContain("Included with your early access.");
    for (const price of ["$1", "$10", "$20", "$40"]) expect(html).toContain(price);
    expect(html).toContain("Checkout is not open yet. Nothing is charged here.");
    expect(html).not.toContain("{");

    const interactive = controls(html);
    expect(interactive.join("\n")).not.toMatch(/upgrade|checkout|choose|\bpay\b/i);
    // The only buttons are the Monthly / Yearly radio options; the only link asks the founder.
    for (const control of interactive) {
      if (control.startsWith("<button")) expect(control).toContain('role="radio"');
      else expect(control).toContain('href="/ask-founder"');
    }
  });

  test("a live paid plan is named and marked; loading shows no prices", () => {
    planResult = paidPro;
    const html = renderPlan();
    expect(html).toContain("Your plan is Pro.");
    expect(html).toMatch(/data-current="true" aria-labelledby="t-pro"/);
    expect(html).not.toContain("You were approved early");

    planResult = undefined;
    const loading = renderPlan();
    expect(loading).toContain("Loading your plan");
    expect(loading).not.toContain("$");
  });

  test("every paid card has the catalog trial amount and duration in both billing periods", () => {
    const trial = TIERS.find((tier) => tier.id === "trial")!;
    for (const interval of ["month", "year"] as const) {
      for (const tier of TIERS.filter((tier) => tier.id !== "trial")) {
        const html = renderToStaticMarkup(createElement(PlanCard, { tier, interval, current: false, early: false }));
        expect(html).toContain(`Starts with a <bdi class="tp-num">${formatUsd(trial.monthly)}</bdi> trial for 3 weeks.`);
        expect(html).toContain(`<span class="tp-tier__amount tp-num">${formatUsd(tierPrice(tier, interval).amount)}</span>`);
        expect(html).not.toMatch(/\{amount\}|\{period\}|set\.billing\.planTrial/);
        expect(controls(html)).toEqual([]);
      }
    }
  });

  test("the standalone trial retains its catalog price and no longer promises Basic-only conversion", () => {
    const tier = TIERS.find((item) => item.id === "trial")!;
    const html = renderToStaticMarkup(createElement(PlanCard, { tier, interval: "year", current: false, early: false }));
    expect(html).toContain(`<span class="tp-tier__amount tp-num">${formatUsd(tier.monthly)}</span>`);
    expect(html).toContain("for 3 weeks");
    expect(html).toContain("A trial for your chosen plan.");
    expect(html).toContain("Continue with your chosen plan only after confirmation");
    expect(html).not.toContain("Then Basic at");
    expect(html).not.toContain("Everything in Basic");
    expect(html).toContain("Checkout is not open yet.");
  });

  test("public pricing preserves all monthly prices and keeps account access separate from checkout", () => {
    const html = renderToStaticMarkup(createElement(PublicPricing));
    for (const tier of TIERS) expect(html).toContain(`<span class="tp-tier__amount tp-num">${formatUsd(tier.monthly)}</span>`);
    expect(html.match(/Starts with a <bdi/g)).toHaveLength(3);
    expect(html).toContain("Checkout is not open yet. No payment is collected on this page.");
    expect(html).toContain('href="/sign-up">Sign up or request access</a>');
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("Account access currently needs approval.");
    expect(html).toContain("Beta requests wait for approval.");
    expect(html).toContain("Approved beta testers and existing testers get Max free.");
    expect(html).not.toMatch(/free plan|free forever|start for free/i);
    for (const control of controls(html)) if (control.startsWith("<button")) expect(control).toContain('role="radio"');
    expect(controls(html).join("\n")).not.toMatch(/checkout|buy now|start trial/i);
    expect(html.match(/<h1\b/g)).toHaveLength(1); expect(html.match(/<main\b/g)).toHaveLength(1);
  });

  test("Hebrew cards isolate the trial amount and translate every new pricing message", () => {
    language = "he";
    for (const tier of TIERS.filter((item) => item.id !== "trial")) {
      const html = renderToStaticMarkup(createElement(PlanCard, { tier, interval: "year", current: false, early: false }));
      expect(html).toContain('מתחילים בניסיון של <bdi class="tp-num">$1</bdi> ל־3 שבועות.');
      expect(html).toContain("התשלום עדיין לא זמין. לא נגבה כאן תשלום.");
      expect(html).not.toMatch(/Starts with|Checkout|\{amount\}|\{period\}|set\.billing\.planTrial/);
    }
    const trial = TIERS.find((tier) => tier.id === "trial")!;
    const trialHtml = renderToStaticMarkup(createElement(PlanCard, { tier: trial, interval: "month", current: false, early: false }));
    expect(trialHtml).toContain("ממשיכים במסלול שנבחר רק אחרי אישור");
    expect(trialHtml).not.toContain("כל מה שיש ב־Basic");
    const html = renderToStaticMarkup(createElement(PublicPricing));
    expect(html).toContain('lang="he" dir="rtl"');
    expect(html).toContain("הגישה לחשבון עדיין דורשת אישור.");
    expect(html).toContain('href="/sign-up">הרשמה או בקשת גישה</a>');
    expect(html).toContain("בקשות בטא ממתינות לאישור.");
    expect(html).toContain("בודקי בטא שאושרו והבודקים הקיימים מקבלים Max בחינם.");
    expect(html).not.toContain("מסלול חינמי");
    expect(html.match(/<h1\b/g)).toHaveLength(1); expect(html.match(/<main\b/g)).toHaveLength(1);
  });

  test("account copy grants free Max only to approved testers and makes payment unavailability explicit", () => {
    const html = renderPlan();
    expect(html).toContain("Approved beta testers and existing testers have Max free. No plan purchase is needed.");
    expect(html).toContain("Checkout is not open. Payment details are not collected here.");
    expect(html).not.toContain("Payments go through Polar");
    expect(html).not.toMatch(/free plan|free forever|start for free/i);
    language = "he";
    const hebrew = renderPlan();
    expect(hebrew).toContain("התשלום עדיין לא זמין. לא נאספים כאן פרטי תשלום.");
    expect(hebrew).toContain("בודקי בטא שאושרו והבודקים הקיימים מקבלים Max בחינם.");
  });
});
