import { describe, expect, test } from "bun:test";
import React from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { LocaleProvider } from "../../apps/web/components/providers/LocaleProvider";
import { translate } from "../../apps/web/lib/i18n";
import { convexErrorMessage } from "../../apps/web/lib/convex-error";
import type { Id } from "../../convex/_generated/dataModel";
import { CompactTaskRow } from "../../apps/web/components/today/CompactTaskRow";
import { DraftRecoveryNotice } from "../../apps/web/components/brain-dump/BrainDumpRecovery";
import { isPlanningDraft } from "../../apps/web/components/tempo/MobileAskBar";

const render = (child: React.ReactNode) => renderToStaticMarkup(React.createElement(LocaleProvider, null, child));

describe("mobile Today rendering", () => {
  test("compact row escapes user text and uses the real project and duration", () => {
    const html = render(React.createElement(CompactTaskRow, { task: { _id: "fictional" as Id<"tasks">, title: "Maya <draft>", status: "todo", projectName: "Writing", timeEstimate: 900_000 }, onToggle: async () => {} }));
    expect(html).toContain("Maya &lt;draft&gt;");
    expect(html).toContain("#Writing");
    expect(html).toContain("15m");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('dir="auto"');
    expect(html).toContain("Mark Maya &lt;draft&gt; complete");
  });
  test("done row exposes reopening and omits absent metadata", () => {
    const html = render(React.createElement(CompactTaskRow, { task: { _id: "fictional" as Id<"tasks">, title: "Reply to Dana", status: "done" }, onToggle: async () => {} }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Mark Reply to Dana as not done");
    expect(html).not.toContain("tp-compact-task__project");
    expect(html).not.toContain("tp-compact-task__time");
  });
  test("recovery distinguishes the draft from an existing proposal and choices", () => {
    const draft = render(React.createElement(DraftRecoveryNotice, { onDismiss() {} }));
    const choices = render(React.createElement(DraftRecoveryNotice, { withChoices: true, disabled: true, onDismiss() {} }));
    expect(draft).toContain(translate("en", "mobile.recoveredDraft"));
    expect(choices).toContain(translate("en", "mobile.recoveredPlan"));
    expect(choices).toContain('disabled=""');
  });
  test("new navigation and capture controls have Hebrew copy", () => {
    for (const key of ["tab.inbox", "tab.upcoming", "tab.chat", "mobile.addToday", "mobile.plan", "mobile.voice", "mobile.recoveredDraft", "mobile.retryToday"] as const) {
      expect(translate("he", key).trim().length).toBeGreaterThan(0);
      expect(translate("he", key)).not.toBe(translate("en", key));
    }
  });
});

describe("capture routing and public errors", () => {
  test("one small line quick adds while multiline thoughts hand off to planning", () => {
    expect(isPlanningDraft("Reply to Dana")).toBe(false);
    expect(isPlanningDraft("Reply to Dana\nPlan a walk")).toBe(true);
  });
  test("a long single line also hands off to planning", () => {
    expect(isPlanningDraft("a".repeat(140))).toBe(false);
    expect(isPlanningDraft("a".repeat(141))).toBe(true);
  });
  test("public Convex data wins over an opaque server wrapper", () => {
    expect(convexErrorMessage({ data: "Your account is waiting for approval.", message: "Server Error" }, "Try again")).toBe("Your account is waiting for approval.");
  });
  test("internal errors and malformed public data use friendly fallback", () => {
    for (const error of [new Error("Server Error at internal handler"), { data: { unsafe: "object" } }, { data: "" }, { data: "x".repeat(1001) }, null]) expect(convexErrorMessage(error, "Your draft is still here.")).toBe("Your draft is still here.");
  });
});
