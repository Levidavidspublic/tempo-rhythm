import type { StudyBlockType, TempoBlock } from "@tempo/utils";

/** A study block as the page codec returns it (flashcards, quiz or practice test). */
export type StudyBlock = Extract<TempoBlock, { type: StudyBlockType }>;

export function isStudyBlock(block: TempoBlock): block is StudyBlock {
  return block.type === "flashcards" || block.type === "quiz" || block.type === "test";
}

/** How many cards or questions the block holds (test parts count as questions). */
export function studyItemCount(block: StudyBlock): number {
  if (block.type === "flashcards") return block.data.cards.length;
  if (block.type === "quiz") return block.data.questions.length;
  return block.data.sections.reduce((sum, section) => sum + section.questions.length, 0);
}

const KIND: Record<"en" | "he", Record<StudyBlockType, string>> = {
  en: { flashcards: "Flashcards", quiz: "Quiz", test: "Practice test" },
  he: { flashcards: "כרטיסיות", quiz: "בוחן", test: "מבחן תרגול" },
};
const COUNT: Record<"en" | "he", Record<StudyBlockType, (n: number) => string>> = {
  en: {
    flashcards: (n) => (n === 1 ? "1 card" : `${n} cards`),
    quiz: (n) => (n === 1 ? "1 question" : `${n} questions`),
    test: (n) => (n === 1 ? "1 question" : `${n} questions`),
  },
  he: {
    flashcards: (n) => (n === 1 ? "כרטיס אחד" : `${n} כרטיסים`),
    quiz: (n) => (n === 1 ? "שאלה אחת" : `${n} שאלות`),
    test: (n) => (n === 1 ? "שאלה אחת" : `${n} שאלות`),
  },
};

/** The card's kind word and count, in the page's language. */
export function studyBlockSummary(
  block: StudyBlock,
  lang: string
): { kind: string; count: string } {
  const l = lang === "he" ? "he" : "en";
  return { kind: KIND[l][block.type], count: COUNT[l][block.type](studyItemCount(block)) };
}

/**
 * Where a study block's "Study" link goes. With the page's id (read from the closest
 * `[data-note-id]`, which PageEditorView puts on its content), /study/new registers the block as a
 * set and moves on to /study/<setId>. Without it, the study hub.
 */
export function studyBlockHref(noteId: string | null | undefined, blockId: string): string {
  if (!noteId) return "/study";
  return `/study/new?from=${encodeURIComponent(noteId)}&block=${encodeURIComponent(blockId)}`;
}

/** The page id around a study block's card, or null. */
export function noteIdAround(element: Element | null): string | null {
  return element?.closest?.("[data-note-id]")?.getAttribute("data-note-id") ?? null;
}

/**
 * A study link asks the page's host to navigate with the app router (a client-side move), so the
 * page unmounts first and its pending autosave is sent before /study/new reads the block. A full
 * reload would drop an edit made in the last half second.
 */
export const STUDY_NAVIGATE_EVENT = "tempo:study-navigate";

type ClickLike = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  preventDefault: () => void;
};

/** A plain left click (no new tab or window asked for). */
export function isPlainClick(event: ClickLike): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * On a plain click, stop the browser's own navigation and send `STUDY_NAVIGATE_EVENT` up from
 * the link. When no host takes it (nothing listening), `fallback` navigates instead.
 */
export function openStudyLink(
  event: ClickLike,
  link: EventTarget,
  href: string,
  fallback: (href: string) => void
): void {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  const request = new CustomEvent(STUDY_NAVIGATE_EVENT, {
    bubbles: true,
    cancelable: true,
    detail: { href },
  });
  const taken = !link.dispatchEvent(request);
  if (!taken) fallback(href);
}

/** The host's side: navigate on each study link request under `target`. Returns the cleanup. */
export function listenForStudyLinks(
  target: EventTarget,
  navigate: (href: string) => void
): () => void {
  const onRequest = (event: Event) => {
    const href = (event as CustomEvent<{ href?: unknown }>).detail?.href;
    if (typeof href !== "string" || !href.startsWith("/study")) return;
    event.preventDefault();
    navigate(href);
  };
  target.addEventListener(STUDY_NAVIGATE_EVENT, onRequest);
  return () => target.removeEventListener(STUDY_NAVIGATE_EVENT, onRequest);
}
