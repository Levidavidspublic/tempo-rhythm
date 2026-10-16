import type { StudyBlock } from "./study-block";
import { studyBlockSummary } from "./study-block";

/**
 * The editor's card for a study block (plain DOM: React never renders inside CodeMirror).
 * It shows the kind, the title and the count, never the JSON. Studying happens in /study.
 */
export function studyBlockDom(block: StudyBlock): HTMLElement {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "en";
  const { kind, count } = studyBlockSummary(block, lang);
  const root = document.createElement("div");
  root.className = "cm-tp-block tp-card";
  root.setAttribute("data-component", "StudyBlock");
  root.setAttribute("data-kind", block.type);
  const head = document.createElement("div");
  head.className = "tp-card__head";
  const title = document.createElement("span");
  title.className = "tp-card__title";
  title.dir = "auto";
  title.textContent = `${kind} · ${block.data.title}`;
  const meta = document.createElement("span");
  meta.className = "tp-muted tp-small";
  meta.textContent = count;
  head.append(title, meta);
  root.append(head);
  return root;
}
