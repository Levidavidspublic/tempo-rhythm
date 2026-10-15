/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test covers the same checks.
 */
import { describe, expect, mock, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type MessageKey, translate } from "@/lib/i18n";
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

mock.module("convex/react", () => ({
  useQuery: () => planResult,
}));

mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: MessageKey) => translate("en", key) }),
}));

const { BillingPlan } = await import("./BillingPlan");

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
    expect(html).toContain("Choosing a plan opens after early access.");
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
});
