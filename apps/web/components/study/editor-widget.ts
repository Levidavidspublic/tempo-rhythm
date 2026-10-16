import { translate } from "@/lib/i18n";
import type { StudyBlock } from "./study-block";
import { noteIdAround, openStudyLink, studyBlockHref, studyBlockSummary } from "./study-block";

/**
 * The editor's card for a study block (plain DOM: React never renders inside CodeMirror).
 * It shows the kind, the title and the count, never the JSON, and a "Study" link. The link
 * finds the page id when it is followed (the editor doesn't know it), so it opens this block's
 * set; studying happens in /study. A plain click navigates client-side through the page's host
 * (`STUDY_NAVIGATE_EVENT`), so the page's pending autosave is sent before the block is read.
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
  const link = document.createElement("a");
  link.className = "tp-btn tp-btn--secondary tp-btn--sm";
  link.setAttribute("data-action", "study-block");
  link.href = "/study";
  link.textContent = translate(lang === "he" ? "he" : "en", "st.block.study");
  // Pointing or focusing settles the target before the click follows it.
  const settle = () => {
    link.href = studyBlockHref(noteIdAround(root), block.id);
  };
  link.addEventListener("pointerenter", settle);
  link.addEventListener("focus", settle);
  link.addEventListener("click", (event) => {
    settle();
    openStudyLink(event, link, link.getAttribute("href") ?? "/study", (href) =>
      window.location.assign(href)
    );
  });
  head.append(title, meta, link);
  root.append(head);
  return root;
}
