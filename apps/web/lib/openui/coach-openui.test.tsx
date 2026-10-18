import { describe, expect, mock, test } from "bun:test";
import { createParser, Renderer } from "@openuidev/react-lang";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoachCardRuntimeContext, coachOpenUiLibrary } from "@/components/coach/openui/CoachOpenUiLibrary";
import { type Lang, translate } from "@/lib/i18n";
import { coachCardTask } from "./coach-actions";
import { choiceToStore, openUiDefault, resolveOpenUi } from "./coach-flag";
import { firstLine, type ProgramProposal, proposalHref, proposalProgram } from "./coach-program";

const parser = createParser(coachOpenUiLibrary.toJSONSchema(), coachOpenUiLibrary.root);

const STEPS = [
  { title: "Reply to Dana", minutes: 10, reason: "It unblocks her" },
  { title: "Draft the report", minutes: 45 },
];

const CASES: Record<string, ProgramProposal> = {
  "task pending": { kind: "task", title: "Ten-minute tidy", minutes: 10, when: "today", status: "pending" },
  "task accepted": { kind: "task", title: "Call", minutes: 5, when: "later", status: "accepted", createdId: "tasks:1", undoUntilMs: Date.now() + 240_000 },
  "task undone": { kind: "task", title: "Call", minutes: 5, when: "today", status: "undone" },
  "task rejected": { kind: "task", title: "Call", minutes: 5, when: "today", status: "rejected" },
  "note pending": { kind: "note", title: "Trip", body: "# Packing\n- passport", status: "pending" },
  "template accepted": { kind: "template", name: "Weekly reset", body: "## Look back", period: "weekly", status: "accepted", createdId: "t:1" },
  "decision pending": { kind: "decision", title: "This afternoon", steps: STEPS, status: "pending" },
  "decision accepted": { kind: "decision", steps: STEPS, status: "accepted", createdId: "notes:1", undoUntilMs: Date.now() + 240_000 },
};

function render(p: ProgramProposal, state: { busy?: boolean; failed?: boolean; lang?: Lang } = {}) {
  const runtime = {
    busy: state.busy ?? false,
    failed: state.failed ?? false,
    decision: p.kind === "decision",
    t: (key: Parameters<typeof translate>[1]) => translate(state.lang ?? "en", key),
  };
  return renderToStaticMarkup(
    createElement(
      CoachCardRuntimeContext.Provider,
      { value: runtime },
      createElement(Renderer, { response: proposalProgram(p), library: coachOpenUiLibrary }),
    ),
  );
}

describe("openui flag", () => {
  test("production builds default off, previews and local builds on", () => {
    expect(openUiDefault("production", "preview.tempoflow.dev")).toBe(false);
    expect(openUiDefault("preview", "tempoflow.dev")).toBe(true);
    expect(openUiDefault("development", "localhost")).toBe(true);
    // No Vercel environment name: the production domain stays off, everything else is on.
    expect(openUiDefault(undefined, "www.tempoflow.dev")).toBe(false);
    expect(openUiDefault(undefined, "TempoFlow.dev")).toBe(false);
    expect(openUiDefault(undefined, "preview.tempoflow.dev")).toBe(true);
    expect(openUiDefault(undefined, "localhost")).toBe(true);
  });

  test("?openui= wins over the stored choice, which wins over the default", () => {
    expect(resolveOpenUi("on", "off", false)).toBe(true);
    expect(resolveOpenUi("off", "on", true)).toBe(false);
    expect(resolveOpenUi(null, "on", false)).toBe(true);
    expect(resolveOpenUi(null, "off", true)).toBe(false);
    expect(resolveOpenUi("maybe", null, true)).toBe(true);
    expect(resolveOpenUi(null, "junk", false)).toBe(false);
    expect(choiceToStore("on")).toBe("on");
    expect(choiceToStore("yes")).toBeNull();
  });
});

describe("coachCardTask", () => {
  function deps(decision: boolean) {
    const calls: string[] = [];
    const step = (name: string) => mock(async () => void calls.push(name));
    return {
      calls,
      m: { decision, accept: step("accept"), save: step("save"), reject: step("reject"), undo: step("undo"), flushPage: step("flush") },
    };
  }

  test("a change: Accept, Not now and Undo run their mutation; Save and Edit do nothing on the server", async () => {
    const { calls, m } = deps(false);
    for (const type of ["Accept", "Reject", "Undo"]) await coachCardTask(type, m)?.();
    expect(calls).toEqual(["accept", "reject", "undo"]);
    expect(coachCardTask("Save", m)).toBeNull();
    expect(coachCardTask("Edit", m)).toBeNull();
    expect(coachCardTask("continue_conversation", m)).toBeNull();
  });

  test("a decision saves today's page first, before Save and before Undo", async () => {
    const { calls, m } = deps(true);
    await coachCardTask("Save", m)?.();
    await coachCardTask("Undo", m)?.();
    expect(calls).toEqual(["flush", "save", "flush", "undo"]);
    expect(coachCardTask("Accept", m)).toBeNull();
  });
});

describe("proposalProgram", () => {
  for (const [name, p] of Object.entries(CASES)) {
    test(`${name}: OpenUI's own parser reads it with no errors`, () => {
      const result = parser.parse(proposalProgram(p));
      expect(result.meta.errors).toEqual([]);
      expect(result.meta.incomplete).toBe(false);
      expect(result.root?.typeName).toBe(p.kind === "decision" ? "DecisionCard" : "ProposalCard");
    });
  }

  test("titles with quotes, backslashes, new lines and Hebrew come back unchanged", () => {
    const title = 'Say "hi" to דנה \\ then\nrest';
    const result = parser.parse(proposalProgram({ kind: "task", title, minutes: 15, when: "today", status: "pending" }));
    const change = (result.root?.props as { change: { props: { title: string; minutes: number } } }).change;
    expect(change.props.title).toBe(title);
    expect(change.props.minutes).toBe(15);
  });

  test("decision steps keep their order, minutes and reasons", () => {
    const result = parser.parse(proposalProgram(CASES["decision pending"] as ProgramProposal));
    expect((result.root?.props as { steps: unknown[] }).steps).toEqual(STEPS);
  });

  test("hrefs and first lines match the direct card", () => {
    expect(proposalHref(CASES["task accepted"] as ProgramProposal)).toBe("/tasks");
    expect(proposalHref({ ...(CASES["task accepted"] as ProgramProposal), when: "today" } as ProgramProposal)).toBe("/today");
    expect(proposalHref(CASES["decision accepted"] as ProgramProposal)).toBe("/notes/notes:1");
    expect(proposalHref(CASES["task pending"] as ProgramProposal)).toBeNull();
    expect(firstLine("\n\n- [ ] passport\nmore")).toBe("passport");
  });
});

describe("no third-party telemetry", () => {
  // OpenUI's runtime usage reports are opt-in (OPENUI_RUNTIME_TELEMETRY_ENABLED) and never sent from a
  // browser; its install report is a postinstall script, which Bun doesn't run for dependencies.
  test("parsing and rendering on a server runtime never calls fetch", async () => {
    const realFetch = globalThis.fetch;
    const spy = mock(async () => new Response(null, { status: 204 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    try {
      // Reports are sampled (1 in 10 parses): 80 parses would miss a broken opt-out 1 time in 4,000.
      for (let round = 0; round < 5; round += 1) {
        for (const p of Object.values(CASES)) {
          parser.parse(proposalProgram(p));
          render(p);
        }
      }
      // OpenUI sends its reports on a later tick; give them the chance.
      await new Promise((done) => setTimeout(done, 50));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("the coach library renders Tempo's cards", () => {
  test("a pending task: the exact change, Accept, Edit and Not now", () => {
    const html = render(CASES["task pending"] as ProgramProposal);
    expect(html).toContain('data-component="ProposalCard"');
    expect(html).toContain('data-renderer="openui"');
    expect(html).toContain('data-status="pending"');
    expect(html).toContain("Ten-minute tidy");
    expect(html).toContain(">Accept<");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Not now<");
  });

  test("an accepted task: done note, Open, and Undo while it lasts", () => {
    const html = render(CASES["task accepted"] as ProgramProposal);
    expect(html).toContain("Done. You can undo this for 5 minutes.");
    expect(html).toContain('href="/tasks"');
    expect(html).toContain(">Undo<");
    expect(html).not.toContain(">Accept<");
  });

  test("Undo is gone once the 5 minutes have passed, and an undone card says nothing changed", () => {
    const expired = render({ ...(CASES["task accepted"] as ProgramProposal), undoUntilMs: Date.now() - 1 } as ProgramProposal);
    expect(expired).toContain(">Done.<");
    expect(expired).not.toContain(">Undo<");
    expect(render(CASES["task undone"] as ProgramProposal)).toContain("Undone. Nothing changed.");
    expect(render(CASES["task rejected"] as ProgramProposal)).toContain("Left as it was.");
  });

  test("a decision draws its steps in order with Save to today and Not now", () => {
    const html = render(CASES["decision pending"] as ProgramProposal);
    expect(html).toContain('data-component="DecisionCard"');
    expect(html).toContain("This afternoon");
    expect(html).toContain("Suggested order");
    expect(html.indexOf("Draft the report")).toBeGreaterThan(html.indexOf("Reply to Dana"));
    expect(html).toContain("It unblocks her");
    expect(html).toContain("Save to today");
    expect(html).not.toContain(">Accept<");
  });

  test("a saved decision links to its page and offers Undo; an untitled one gets the default title", () => {
    const html = render(CASES["decision accepted"] as ProgramProposal);
    expect(html).toContain("An order for today");
    expect(html).toContain("Saved to today. You can undo this for 5 minutes.");
    expect(html).toContain('href="/notes/notes:1"');
    expect(html).toContain(">Undo<");
  });

  test("buttons are disabled while a mutation runs, and a failure is announced", () => {
    const html = render(CASES["task pending"] as ProgramProposal, { busy: true, failed: true });
    expect(html.match(/disabled=""/g)?.length).toBe(3);
    expect(html).toContain('role="alert"');
    expect(html).toContain("That didn&#x27;t go through. Try again.");
  });

  test("a pending note shows all of its body before Accept; an accepted template doesn't", () => {
    const html = render(CASES["note pending"] as ProgramProposal);
    expect(html).toContain("Show all of it");
    expect(html).toContain("# Packing\n- passport");
    expect(html).toContain('aria-label="What it says"');
    expect(html).toContain(">Accept<");
    const he = render(CASES["note pending"] as ProgramProposal, { lang: "he" });
    expect(he).toContain(translate("he", "proposal.showAll"));
    expect(render(CASES["template accepted"] as ProgramProposal)).not.toContain("Show all of it");
  });

  test("Hebrew: the same card in the page language, the person's own words unchanged", () => {
    const html = render(CASES["task accepted"] as ProgramProposal, { lang: "he" });
    expect(html).toContain(translate("he", "proposal.accepted"));
    expect(html).toContain(`>${translate("he", "proposal.undo")}<`);
    expect(html).toContain("Call");
    expect(html).not.toContain("Done. You can undo");
  });
});
