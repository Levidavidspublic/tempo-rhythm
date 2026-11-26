"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type EditorTrigger,
  LivePreviewEditor,
  type LivePreviewEditorHandle,
  type MenuKey,
} from "@/components/editor/LivePreviewEditor";
import { focusTaskTitleWhenDrawn } from "@/components/editor/live-preview";
import { type MenuItem, SlashMenu } from "@/components/editor/SlashMenu";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { TpIconName } from "@/components/tempo/TpIcon";
import {
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

/** "For templates": {{tokens}} the page fills in when it is made (lib/editor/markdown-model dayTokens). */
const TOKENS = [
  { id: "tok:day", token: "{{day}}", label: "tb.slash.day", keywords: "date day תאריך" },
  { id: "tok:weekday", token: "{{weekday}}", label: "tb.slash.weekday", keywords: "weekday day יום" },
  { id: "tok:week", token: "{{week}}", label: "tb.slash.week", keywords: "week number שבוע" },
] as const satisfies readonly { id: string; token: string; label: MessageKey; keywords: string }[];

/** Links need a page to point at; a template has none yet, so the builder leaves "Link to a page" out. */
const TEMPLATE_COMMANDS = SLASH_COMMANDS.filter((command) => command.id !== "link");

type Props = {
  /** The body as loaded; the editor is uncontrolled after mount (remount with `key`). */
  initialValue: string;
  ariaLabel: string;
  placeholder: string;
  onChange: (body: string) => void;
};

/**
 * The template body in the same live-preview editor every page uses (OVERNIGHT-RUN.md
 * decision 2), with the slash menu (template-builder.html SlashMenu): template tokens first,
 * then Tempo blocks and Text. Arrows move, Enter adds, Esc closes.
 */
export function TemplateBodyEditor({ initialValue, ariaLabel, placeholder, onChange }: Props) {
  const { t } = useLocale();
  const editor = useRef<LivePreviewEditorHandle | null>(null);
  const [trigger, setTrigger] = useState<EditorTrigger | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  // Templates have no [[ picker; only the slash menu opens here.
  const onTrigger = (next: EditorTrigger | null) => {
    const slash = next?.kind === "slash" ? next : null;
    setTrigger(slash);
    if (!slash) setDismissedAt(null);
  };
  const open = trigger && trigger.from !== dismissedAt ? trigger : null;

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
    const words = open.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const tokens = TOKENS.filter((token) => {
      const hay = `${t(token.label)} ${token.keywords}`.toLowerCase();
      return words.every((word) => hay.includes(word));
    }).map((token) => ({
      id: token.id,
      group: t("tb.slash.g"),
      name: t(token.label),
      hint: t("tb.slash.fill"),
      icon: "calendar-grid" as TpIconName,
    }));
    const allowed = new Set(TEMPLATE_COMMANDS.map((c) => c.id));
    const commands = filterSlashCommands(open.query, slashLabels)
      .filter((c) => allowed.has(c.id))
      .map((c) => ({
        id: c.id,
        group: t(c.group === "tempo" ? "slash.g.tempo" : "slash.g.text"),
        name: slashLabels[c.id],
        hint: c.id === "task" ? t("slash.task.h") : undefined,
        icon: SLASH_ICONS[c.id],
      }));
    return [...tokens, ...commands];
  }, [open, slashLabels, t]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new trigger or filter starts at the first item
  useEffect(() => {
    setActive(0);
  }, [open?.query, open?.from]);

  const choose = (item: MenuItem | undefined) => {
    const view = editor.current;
    if (!open || !item || !view) return;
    const token = TOKENS.find((entry) => entry.id === item.id);
    if (token) {
      view.replace(open.from, open.to, token.token, token.token.length);
    } else {
      const insertion = slashInsertion(item.id as SlashCommandId, open.atLineStart);
      const newBlock = item.id === "task" ? insertedBlockId(insertion.text) : null;
      if (newBlock) focusTaskTitleWhenDrawn(newBlock);
      view.replace(open.from, open.to, insertion.text, insertion.cursor);
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

  const labels = {
    minutes: t("editor.minutes"),
    removeBlock: t("editor.remove"),
    brokenBlock: t("editor.broken"),
    template: t("editor.template"),
    taskDone: t("editor.done"),
    taskTitle: t("editor.taskTitle"),
  };

  return (
    <>
      <LivePreviewEditor
        ref={editor}
        initialValue={initialValue}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        labels={labels}
        onChange={onChange}
        onTrigger={onTrigger}
        onMenuKey={onMenuKey}
      />
      {open ? (
        <SlashMenu
          label={t("slash.label")}
          hint={t("slash.hint")}
          empty={t("slash.empty")}
          items={items}
          active={active}
          coords={open.coords}
          onChoose={choose}
          onHover={setActive}
        />
      ) : null}
    </>
  );
}
