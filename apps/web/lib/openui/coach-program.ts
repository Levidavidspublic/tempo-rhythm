/**
 * The OpenUI Lang program for one coach proposal (`toolCalls.coachProposal`).
 *
 * The server's stored proposal stays the contract (HARD_RULES §6.2): the program is built from it
 * here, never from model text, so the card always shows the exact change that Accept or Save will
 * make. Components and actions are the ones in components/coach/openui/CoachOpenUiLibrary.tsx.
 * Strings are JSON string literals, which OpenUI Lang reads back unchanged (quotes, newlines,
 * Hebrew); the tests parse every program with the library's own parser.
 */

export type ProgramStep = { title: string; minutes: number; reason?: string };

export type ProgramProposal = (
  | { kind: "task"; title: string; minutes: number; when: "today" | "later" }
  | { kind: "note"; title: string; body: string }
  | { kind: "template"; name: string; body: string; period: "daily" | "weekly" | "none" }
  | { kind: "decision"; title?: string; steps: ProgramStep[] }
) & {
  status: "pending" | "accepted" | "rejected" | "undone";
  createdId?: string;
  undoUntilMs?: number;
};

/** The first line of a body, as plain words. */
export function firstLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim()) ?? "";
  return line.replace(/^\s*(#{1,6}\s|[-*+]\s(\[[ xX]\]\s)?|\d+[.)]\s|>\s?)/, "").trim().slice(0, 120);
}

/** Where an accepted proposal's result lives, or null while there is none. */
export function proposalHref(p: ProgramProposal): string | null {
  if (p.status !== "accepted") return null;
  if (p.kind === "decision") return p.createdId ? `/notes/${p.createdId}` : "/today";
  if (!p.createdId) return null;
  if (p.kind === "note") return `/notes/${p.createdId}`;
  if (p.kind === "template") return "/templates";
  return p.when === "today" ? "/today" : "/tasks";
}

/** Where a change lands, as the card's target label key. */
export function proposalTarget(p: Exclude<ProgramProposal, { kind: "decision" }>): "today" | "tasks" | "notes" | "templates" {
  if (p.kind === "task") return p.when === "today" ? "today" : "tasks";
  return p.kind === "note" ? "notes" : "templates";
}

const str = (value: string) => JSON.stringify(value);
const int = (value: number) => String(Number.isFinite(value) ? Math.round(value) : 0);
const opt = (value: string | undefined) => (value === undefined ? "null" : str(value));

/** The OpenUI Lang program that draws this proposal with the coach library. */
export function proposalProgram(p: ProgramProposal): string {
  const footer = p.status === "pending" ? "actions" : "outcome";
  const lines: string[] = [];
  if (p.kind === "decision") {
    const steps = p.steps
      .map((s) => `{title: ${str(s.title)}, minutes: ${int(s.minutes)}${s.reason ? `, reason: ${str(s.reason)}` : ""}}`)
      .join(", ");
    lines.push(`root = DecisionCard(${opt(p.title)}, ${str(p.status)}, [${steps}], ${footer})`);
  } else {
    lines.push(`root = ProposalCard(${str(p.kind)}, ${str(p.status)}, ${str(proposalTarget(p))}, change, ${footer})`);
    if (p.kind === "task") {
      lines.push(`change = TaskChange(${str(p.title)}, ${int(p.minutes)})`);
    } else {
      const name = p.kind === "note" ? p.title : p.name;
      const period = p.kind === "template" ? str(p.period) : "null";
      // The whole body rides along while the proposal waits, so "Show all of it" can show it before Accept.
      const body = p.status === "pending" ? str(p.body) : "null";
      lines.push(`change = PageChange(${str(name)}, ${str(firstLine(p.body))}, ${period}, ${body})`);
    }
  }
  if (p.status === "pending") {
    const buttons: [string, string][] =
      p.kind === "decision"
        ? [["save", "Save"], ["reject", "Reject"]]
        : [["accept", "Accept"], ["edit", "Edit"], ["reject", "Reject"]];
    lines.push(`actions = Actions([${buttons.map(([id]) => id).join(", ")}])`);
    for (const [id, act] of buttons) lines.push(`${id} = Button(${str(id)}, @${act}())`);
  } else {
    const until = p.status === "accepted" && p.undoUntilMs !== undefined ? int(p.undoUntilMs) : "null";
    const href = proposalHref(p);
    lines.push(`outcome = Outcome(${str(p.status)}, ${until}, ${href ? str(href) : "null"}, @Undo())`);
  }
  return lines.join("\n");
}
