/**
 * Brain-dump results are Markdown pages (v3 OVERNIGHT-RUN.md decision 6): "Save as a page"
 * writes the sorted plan as ordinary Markdown, grouped by urgency, with plain `- [ ]` lines
 * (decision 4: a Markdown checkbox, not a Tempo task).
 */
export type DumpUrgency = "now" | "soon" | "later";
export type DumpItem = { title: string; reason: string; urgency: DumpUrgency };

const ORDER: readonly DumpUrgency[] = ["now", "soon", "later"];

/** One line of Markdown: no line breaks, and nothing that would start a heading or a list. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The page for a sorted dump: the summary, then a "## Now / Soon / Later" section per urgency
 * that has items, each item a `- [ ] title — reason` line. Set-aside items are left out.
 */
export function brainDumpPageBody(
  plan: { summary: string; priorities: readonly DumpItem[] },
  options: { skip?: readonly number[]; labels: Record<DumpUrgency, string> },
): string {
  const skip = new Set(options.skip ?? []);
  const parts: string[] = [];
  const summary = oneLine(plan.summary);
  if (summary) parts.push(summary);
  for (const urgency of ORDER) {
    const lines = plan.priorities
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => item.urgency === urgency && !skip.has(index) && oneLine(item.title))
      .map(({ item }) => {
        const reason = oneLine(item.reason);
        return `- [ ] ${oneLine(item.title)}${reason ? ` — ${reason}` : ""}`;
      });
    if (lines.length > 0) parts.push(`## ${options.labels[urgency]}\n\n${lines.join("\n")}`);
  }
  return `${parts.join("\n\n")}\n`;
}
