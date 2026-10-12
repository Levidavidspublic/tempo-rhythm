"use client";

import { isLinkableTitle, parseTempoBlocks, sameTitle, titleKey } from "@tempo/utils";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type EditorTrigger,
  LivePreviewEditor,
  type LivePreviewEditorHandle,
  type MenuKey,
} from "@/components/editor/LivePreviewEditor";
import { focusTaskTitleWhenDrawn } from "@/components/editor/live-preview";
import { ReadView } from "@/components/editor/ReadView";
import { type MenuItem, SlashMenu } from "@/components/editor/SlashMenu";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import {
  exportContents,
  exportFileName,
  filterSlashCommands,
  insertedBlockId,
  SLASH_COMMANDS,
  type SlashCommandId,
  slashInsertion,
} from "@/lib/editor/markdown-model";
import type { MessageKey } from "@/lib/i18n";

const SLASH_ICONS: Record<SlashCommandId, TpIconName> = {
  task: "task",
  link: "link",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  bullet: "list",
  numbered: "list",
  checklist: "checklist",
  quote: "text",
  code: "text",
  divider: "minus",
  table: "calendar-grid",
};

type SaveState = "idle" | "saving" | "saved";

type Props = {
  noteId: string;
  title: string;
  initialBody: string;
  body: string;
  pinned: boolean;
  saveState: SaveState;
  confirmingDelete: boolean;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onTogglePin: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

/** Tags from the page's page-meta block (the only place tags live, NT-05). */
function pageTags(body: string): string[] {
  for (const segment of parseTempoBlocks(body)) {
    if (segment.kind === "valid" && segment.block.type === "page-meta") return segment.block.data.tags;
  }
  return [];
}

/**
 * PageEditor (docs/design/v3/screens/web/page-editor.html): the one page route, /notes/[id].
 * A plain Markdown page drawn on paper: title, meta, the live-preview editor with the slash
 * menu and the [[ picker, the page menu (Copy as Markdown, Export .md, Read) and "Linked here".
 */
export function PageEditorView(props: Props) {
  const { noteId, title, initialBody, body, pinned, saveState, confirmingDelete } = props;
  const { t } = useLocale();
  const router = useRouter();
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const createNote = useMutation(api.notes.create);
  const backlinks = useQuery(api.notes.backlinks, isAuthenticated ? { noteId } : "skip");

  const editor = useRef<LivePreviewEditorHandle | null>(null);
  const [mode, setMode] = useState<"edit" | "read">("edit");
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [trigger, setTrigger] = useState<EditorTrigger | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  // The text the editor mounts with: the loaded body first, then the current body each time
  // Edit comes back after Read (the editor is uncontrolled; a stale seed would revert edits).
  const [editSeed, setEditSeed] = useState(initialBody);

  // Esc dismisses the menu for this trigger only; once the trigger is gone, a new one opens again.
  const onTrigger = (next: EditorTrigger | null) => {
    setTrigger(next);
    if (!next) setDismissedAt(null);
  };

  const open = trigger && trigger.from !== dismissedAt ? trigger : null;
  const wikiResults = useQuery(
    api.notes.searchTitles,
    isAuthenticated && open?.kind === "wiki" ? { query: open.query, limit: 8 } : "skip",
  );

  const slashLabels = useMemo(
    () =>
      Object.fromEntries(SLASH_COMMANDS.map((c) => [c.id, t(`slash.${c.id}` as MessageKey)])) as Record<
        SlashCommandId,
        string
      >,
    [t],
  );

  const items: MenuItem[] = useMemo(() => {
    if (!open) return [];
    if (open.kind === "slash") {
      return filterSlashCommands(open.query, slashLabels).map((c) => ({
        id: c.id,
        group: t(c.group === "tempo" ? "slash.g.tempo" : "slash.g.text"),
        name: slashLabels[c.id],
        hint: c.id === "task" ? t("slash.task.h") : c.id === "link" ? t("slash.link.h") : undefined,
        icon: SLASH_ICONS[c.id],
      }));
    }
    // A title a [[link]] cannot hold (brackets, "|", line breaks, over 200 characters) would
    // point at another page, so the picker leaves it out.
    const pages = (wikiResults ?? []).filter((p) => p._id !== noteId && isLinkableTitle(p.title));
    const list: MenuItem[] = pages.map((p) => ({
      id: p._id,
      group: t("rail.pages"),
      name: p.title,
      icon: "page" as TpIconName,
    }));
    const q = open.query.trim();
    if (q && !pages.some((p) => sameTitle(p.title, q))) {
      list.push({ id: "__new__", group: t("wiki.new"), name: q, icon: "plus" });
    }
    return list;
  }, [open, slashLabels, wikiResults, noteId, t]);

  // A new trigger or a new filter starts at the first item.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on query/kind change only
  useEffect(() => {
    setActive(0);
  }, [open?.kind, open?.query]);

  const choose = (item: MenuItem | undefined) => {
    if (!open || !item) return;
    if (open.kind === "slash") {
      const insertion = slashInsertion(item.id as SlashCommandId, open.atLineStart);
      // A new task card opens with its title selected, ready to be named.
      const newBlock = item.id === "task" ? insertedBlockId(insertion.text) : null;
      if (newBlock) focusTaskTitleWhenDrawn(newBlock);
      editor.current?.replace(open.from, open.to, insertion.text, insertion.cursor);
    } else {
      const text = `[[${item.name.trim()}]]`;
      editor.current?.replace(open.from, open.to, text, text.length);
    }
    setTrigger(null);
  };

  const onMenuKey = (key: MenuKey): boolean => {
    if (!open) return false;
    if (key === "Escape") {
      setDismissedAt(open.from);
      return true;
    }
    if (items.length === 0) return false;
    if (key === "ArrowDown") setActive((a) => (a + 1) % items.length);
    else if (key === "ArrowUp") setActive((a) => (a - 1 + items.length) % items.length);
    else choose(items[active]);
    return true;
  };

  // One lookup-or-create per title at a time: a double click never makes two pages.
  const opening = useRef(new Set<string>());
  const openLink = async (linkTitle: string) => {
    const key = titleKey(linkTitle);
    if (!key || opening.current.has(key)) return;
    opening.current.add(key);
    try {
      const results = await convex.query(api.notes.searchTitles, { query: linkTitle, limit: 20 });
      const hit = results.find((r) => sameTitle(r.title, linkTitle));
      if (hit) {
        router.push(`/notes/${hit._id}`);
        return;
      }
      // Like a wiki: following a link to a page that doesn't exist yet makes it.
      const id = await createNote({ title: linkTitle.trim(), body: "" });
      router.push(`/notes/${id}`);
    } finally {
      opening.current.delete(key);
    }
  };

  const copyMarkdown = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(exportContents(body));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: nothing to undo */
    }
  };

  const exportMarkdown = () => {
    setMenuOpen(false);
    const blob = new Blob([exportContents(body)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName(title);
    a.click();
    URL.revokeObjectURL(url);
  };

  const tags = pageTags(body);
  const labels = {
    minutes: t("editor.minutes"),
    removeBlock: t("editor.remove"),
    brokenBlock: t("editor.broken"),
    template: t("editor.template"),
    taskDone: t("editor.done"),
    taskTitle: t("editor.taskTitle"),
  };

  return (
    <article className="tp-paper" data-component="PageEditor" aria-labelledby="page-title">
      <div className="tp-page-cover" data-component="PageCover" aria-hidden="true" />
      <div className="tp-page__body">
        <div className="tp-page-icon" data-component="PageIcon" aria-hidden="true">
          <TpIcon name="page" />
        </div>
        <div className="tp-page-head" data-component="PageHead" data-variant="note">
          <div className="tp-page-head__row">
            <h1 className="tp-page-title" id="page-title">
              <input
                aria-label={t("page.titleLabel")}
                className="w-full min-w-0 border-0 bg-transparent p-0 placeholder:text-ink-subtle"
                dir="auto"
                value={title}
                placeholder={t("page.untitled")}
                onChange={(event) => props.onTitleChange(event.target.value)}
              />
            </h1>
            <div className="tp-page-head__actions">
              <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" onClick={props.onTogglePin}>
                <TpIcon name="pin" size="sm" />
                <span>{pinned ? t("page.unpin") : t("page.pin")}</span>
              </button>
              {confirmingDelete ? (
                <>
                  <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" onClick={props.onConfirmDelete}>
                    {t("page.confirmDelete")}
                  </button>
                  <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" onClick={props.onCancelDelete}>
                    {t("page.cancel")}
                  </button>
                </>
              ) : null}
              <div className="tp-menu" data-component="PageMenu">
                <button
                  className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={t("page.menu")}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <TpIcon name="more" size="sm" />
                </button>
                {menuOpen ? (
                  <div className="tp-menu__list tp-glass" role="menu">
                    <button className="tp-menu__item" type="button" role="menuitem" onClick={() => void copyMarkdown()}>
                      <TpIcon name="card" size="sm" />
                      {t("page.copy")}
                    </button>
                    <button className="tp-menu__item" type="button" role="menuitem" onClick={exportMarkdown}>
                      <TpIcon name="download" size="sm" />
                      {t("page.export")}
                    </button>
                    <button
                      className="tp-menu__item"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (mode === "read") setEditSeed(body);
                        setMode(mode === "edit" ? "read" : "edit");
                        setMenuOpen(false);
                      }}
                    >
                      <TpIcon name={mode === "edit" ? "page" : "edit"} size="sm" />
                      {mode === "edit" ? t("page.read") : t("page.edit")}
                    </button>
                    <button
                      className="tp-menu__item"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        props.onAskDelete();
                      }}
                    >
                      <TpIcon name="x" size="sm" />
                      {t("page.delete")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="tp-page-meta" data-component="PageMeta">
            {tags.map((tag) => (
              <span className="tp-tag" data-component="Tag" key={tag} dir="auto">
                {tag}
              </span>
            ))}
            <Link className="tp-muted" href="/notes">
              {t("page.back")}
            </Link>
            <output className="tp-muted" data-state={saveState}>
              {copied ? t("page.copied") : saveState === "saving" ? t("page.saving") : saveState === "saved" ? t("page.saved") : ""}
            </output>
          </div>
        </div>

        <div className="tp-page-content tp-slash-anchor" data-component="BlockList">
          {mode === "edit" ? (
            <LivePreviewEditor
              ref={editor}
              initialValue={editSeed}
              ariaLabel={t("page.bodyLabel")}
              placeholder={t("editor.placeholder")}
              labels={labels}
              onChange={props.onBodyChange}
              onTrigger={onTrigger}
              onMenuKey={onMenuKey}
              onOpenLink={(linkTitle) => void openLink(linkTitle)}
            />
          ) : (
            <ReadView body={body} onOpenLink={(linkTitle) => void openLink(linkTitle)} labels={labels} />
          )}
          {open && mode === "edit" ? (
            <SlashMenu
              label={open.kind === "slash" ? t("slash.label") : t("wiki.label")}
              hint={open.kind === "slash" ? t("slash.hint") : t("wiki.hint")}
              empty={open.kind === "slash" ? t("slash.empty") : t("wiki.empty")}
              items={items}
              active={active}
              coords={open.coords}
              onChoose={choose}
              onHover={setActive}
            />
          ) : null}
        </div>

        {backlinks && backlinks.length > 0 ? (
          <section className="tp-backlinks" data-component="Backlinks" aria-labelledby="bl-h">
            <div className="tp-backlinks__head">
              <TpIcon name="link" size="sm" />
              <h2 className="tp-eyebrow" id="bl-h">
                {t("bl.head")}
              </h2>
              <span className="tp-muted tp-small">
                · <span className="tp-num">{backlinks.length}</span>
              </span>
            </div>
            {backlinks.map((link) => (
              <Link className="tp-backlink" href={`/notes/${link.id}`} key={link.id}>
                <span className="tp-backlink__page" dir="auto">
                  {link.title}
                </span>
                <span className="tp-backlink__ctx" dir="auto">
                  {link.context}
                </span>
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    </article>
  );
}
