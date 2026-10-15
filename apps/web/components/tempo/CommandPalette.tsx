"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, type RefObject, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { api } from "@/convex/_generated/api";
import {
  type CommandGroup,
  type CommandRow,
  DEFAULT_JUMP_SLUGS,
  filterRows,
  moveActive,
  REAL_SCREENS,
  recentPages,
  SCREEN_LABEL,
  searchHref,
} from "@/lib/command-palette";
import type { MessageKey } from "@/lib/i18n";
import { useOnline } from "@/lib/useOnline";
import { TpIcon, type TpIconName } from "./TpIcon";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called as the palette closes; returns true when it moved focus itself. */
  returnFocus?: () => boolean;
};

type Row = CommandRow & { icon: TpIconName; kbd?: string };

/** The rail's page list size, so the palette shares the rail's subscription (notes.listForRail). */
const RAIL_LIMIT = 7;

const JUMP_HINT: Readonly<Record<string, MessageKey>> = {
  today: "cmd.j.today",
  tasks: "cmd.j.tasks",
  calendar: "cmd.j.calendar",
  coach: "cmd.j.coach",
  notes: "cmd.j.notes",
  templates: "cmd.j.templates",
  search: "cmd.j.search",
  settings: "cmd.j.settings",
};

const JUMP_ICON: Readonly<Record<string, TpIconName>> = {
  today: "today",
  "brain-dump": "inbox",
  coach: "coach",
  plan: "calendar-grid",
  tasks: "checklist",
  notes: "page",
  calendar: "calendar-grid",
  habits: "habit",
  routines: "refresh",
  goals: "flag",
  projects: "folder",
  analytics: "chart",
  history: "history",
  activity: "clock",
  tracking: "chart",
  templates: "template",
  search: "search",
  settings: "user",
  "settings-prefs": "settings",
  "settings-integrations": "link",
  "settings-nags": "nag",
  "settings-memory": "memory",
  billing: "card",
  notifications: "bell",
};

const GROUP_LABEL: Record<CommandGroup, MessageKey> = { recent: "cmd.g.recent", jump: "cmd.g.jump", act: "cmd.g.act" };

type Variant = "dialog" | "page";

/**
 * The command bar's body (docs/design/v3/screens/web/command.html): a combobox box over a
 * grouped listbox. Up / Down move (wrapping), Home / End jump when the box is empty, Enter
 * opens. The Ctrl K dialog adds Recent pages; the /command page lists screens and actions.
 */
function CommandBody({
  variant,
  onDone,
  inputRef,
}: {
  variant: Variant;
  /** Called after a row is chosen (the dialog closes). */
  onDone: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const online = useOnline();
  const { resolvedTheme, setTheme, dyslexia, setDyslexia } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const createNote = useMutation(api.notes.create);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [newError, setNewError] = useState(false);
  // One "New page" at a time: a double click or a held Enter must not make several blank pages.
  const creating = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const inputId = `${uid}-q`;
  const optionId = (row: Row) => `${uid}-${row.id}`;

  const withRecent = variant === "dialog";
  const typed = query.trim();
  // The same gate as the rail: page queries wait for the users row (getProfile is null until then).
  const profile = useQuery(api.users.getProfile, withRecent && isAuthenticated ? {} : "skip");
  const rail = useQuery(api.notes.listForRail, withRecent && profile && !typed ? { limit: RAIL_LIMIT } : "skip");
  const found = useQuery(api.notes.searchTitles, withRecent && profile && typed ? { query: typed, limit: 6 } : "skip");

  const rows = useMemo(() => {
    const out: Row[] = [];
    if (withRecent) {
      const pages = typed ? (found ?? []) : recentPages(rail);
      for (const page of pages) {
        out.push({
          id: `p-${page._id}`,
          group: "recent",
          name: page.title.trim() || t("page.untitled"),
          hint: page.pinned ? t("cmd.pinned") : t("cmd.page"),
          href: `/notes/${page._id}`,
          icon: page.pinned ? "pin" : "page",
        });
      }
    }
    const screens = typed
      ? REAL_SCREENS
      : DEFAULT_JUMP_SLUGS.map((slug) => REAL_SCREENS.find((s) => s.slug === slug)).filter((s) => s !== undefined);
    const jump: Row[] = screens.map((screen) => {
      const label = SCREEN_LABEL[screen.slug];
      const hint = JUMP_HINT[screen.slug];
      return {
        id: `j-${screen.slug}`,
        group: "jump",
        name: label ? t(label) : screen.title,
        alt: screen.title,
        hint: hint ? t(hint) : undefined,
        href: screen.route,
        icon: JUMP_ICON[screen.slug] ?? "page",
        kbd: screen.slug === "coach" ? "Ctrl J" : undefined,
      };
    });
    const actions: Row[] = [
      { id: "a-new", group: "act", name: t("cmd.a.new"), hint: t("cmd.a.new.h"), action: "new-page", icon: "plus" },
      { id: "a-task", group: "act", name: t("cmd.a.task"), hint: t("cmd.a.task.h"), href: "/tasks", icon: "task" },
      { id: "a-dump", group: "act", name: t("cmd.a.dump"), hint: t("cmd.a.dump.h"), href: "/brain-dump", icon: "inbox" },
      { id: "a-theme", group: "act", name: t("cmd.a.theme"), hint: t("cmd.a.theme.h"), action: "theme", icon: "moon" },
      { id: "a-font", group: "act", name: t("cmd.a.font"), hint: t("cmd.a.font.h"), action: "font", icon: "type" },
      { id: "a-all", group: "act", name: t("cmd.all"), hint: t("cmd.all.h"), href: "/search", icon: "search", always: true },
    ];
    // Page matches already come filtered from the server; screens and actions filter here.
    return [...out, ...filterRows(jump, typed), ...filterRows(actions, typed)];
  }, [withRecent, typed, found, rail, t]);

  // A new query starts at the first row.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on query change only
  useEffect(() => {
    setActive(0);
  }, [typed]);

  const current = rows[Math.min(active, rows.length - 1)];

  useEffect(() => {
    if (!current) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[id="${optionId(current)}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  });

  const choose = async (row: Row | undefined) => {
    if (!row) return;
    if (row.action === "theme") {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
      onDone();
      return;
    }
    if (row.action === "font") {
      setDyslexia(!dyslexia);
      onDone();
      return;
    }
    if (row.action === "new-page") {
      if (creating.current) return;
      creating.current = true;
      setNewError(false);
      try {
        const id = await createNote({ title: "", body: "" });
        onDone();
        router.push(`/notes/${id}`);
      } catch {
        setNewError(true);
      } finally {
        creating.current = false;
      }
      return;
    }
    const href = row.always ? searchHref(query) : row.href;
    if (!href) return;
    onDone();
    router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => moveActive(index, event.key as "ArrowDown" | "ArrowUp", rows.length));
    } else if ((event.key === "Home" || event.key === "End") && query === "") {
      event.preventDefault();
      setActive(moveActive(active, event.key, rows.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      void choose(current);
    }
  };

  const recentLoading =
    withRecent && !typed && isAuthenticated && (profile === undefined || (profile !== null && rail === undefined));
  const recentEmpty = withRecent && !typed && rail !== undefined && rail.length === 0;
  const recentRows = rows.filter((row) => row.group === "recent");
  const count = rows.length;

  const groups: CommandGroup[] = withRecent ? ["recent", "jump", "act"] : ["jump", "act"];

  return (
    <>
      <div className="cmd__head">
        <div className="tp-search" data-component="SearchInput">
          <label className="tp-label tp-sr-only" htmlFor={inputId}>
            {t("cmd.label")}
          </label>
          <div className="tp-search__box">
            <span className="tp-search__icon">
              <TpIcon name="search" size="sm" />
            </span>
            <input
              ref={inputRef}
              className="tp-input"
              id={inputId}
              type="text"
              dir="auto"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-label={variant === "page" ? t("cmd.filter") : undefined}
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={current ? optionId(current) : undefined}
              placeholder={t("cmd.label")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
        {variant === "dialog" ? (
          <Dialog.Close className="tp-btn tp-btn--ghost tp-btn--icon" aria-label={t("cmd.close")}>
            <TpIcon name="x" />
          </Dialog.Close>
        ) : null}
      </div>

      {online ? null : (
        <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
          <span className="tp-notice__icon">
            <TpIcon name="wifi-off" size="sm" />
          </span>
          <span className="tp-notice__text">{t("cmd.offline")}</span>
        </output>
      )}
      {newError ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("cmd.newError")}</span>
        </p>
      ) : null}

      <div className="cmd__list" role="listbox" id={listId} aria-label={t("cmd.list")} data-component="SlashMenu" ref={listRef}>
        {groups.map((group) => {
          const groupRows = rows.filter((row) => row.group === group);
          const isRecent = group === "recent";
          if (!isRecent && groupRows.length === 0) return null;
          if (isRecent && typed && recentRows.length === 0) return null;
          const headId = `${uid}-g-${group}`;
          const label = isRecent && typed ? t("cmd.g.pages") : t(GROUP_LABEL[group]);
          return (
            // biome-ignore lint/a11y/useSemanticElements: a listbox group (command.html); fieldset is not allowed inside a listbox
            <div role="group" aria-labelledby={headId} data-group={group} key={group}>
              <div className="tp-slash-menu__group" id={headId}>
                {label}
              </div>
              {isRecent && recentLoading ? (
                <div className="tp-skel-list">
                  <output className="tp-sr-only">{t("cmd.recent.loading")}</output>
                  <div className="tp-skel-row">
                    <span className="tp-skeleton tp-skel-row__box" />
                    <span className="tp-skel-row__lines">
                      <span className="tp-skeleton tp-skeleton--w60" />
                      <span className="tp-skeleton tp-skeleton--sm tp-skeleton--w40" />
                    </span>
                  </div>
                </div>
              ) : null}
              {isRecent && recentEmpty ? <p className="tp-slash-item__hint">{t("cmd.recent.empty")}</p> : null}
              {groupRows.map((row) => {
                const selected = row === current;
                return (
                  <div
                    key={row.id}
                    className="tp-slash-item"
                    role="option"
                    id={optionId(row)}
                    aria-selected={selected}
                    tabIndex={-1}
                    onMouseDown={(event) => {
                      // Keep focus in the box; the box's keys drive the list, a press chooses.
                      event.preventDefault();
                      setActive(rows.indexOf(row));
                      void choose(row);
                    }}
                    onMouseEnter={() => {
                      if (!selected) setActive(rows.indexOf(row));
                    }}
                  >
                    <span className="tp-slash-item__icon">
                      <TpIcon name={row.icon} />
                    </span>
                    <span className="tp-slash-item__text">
                      <span className="tp-slash-item__name" dir="auto">
                        {row.always && typed ? (
                          <>
                            {row.name}{" "}
                            <q dir="auto">{typed}</q>
                          </>
                        ) : (
                          row.name
                        )}
                      </span>
                      {row.hint ? <span className="tp-slash-item__hint">{row.hint}</span> : null}
                    </span>
                    {row.kbd ? <kbd className="tp-kbd tp-num">{row.kbd}</kbd> : <span />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <output className="tp-sr-only">
        {count === 1 ? t("cmd.count1") : t("cmd.count").replace("{n}", String(count))}
      </output>

      <div className="tp-slash-menu__search cmd__foot" aria-hidden="true">
        <span>
          <kbd className="tp-kbd">↑</kbd>
          <kbd className="tp-kbd">↓</kbd> <span>{t("cmd.f.move")}</span>
        </span>
        <span>
          <kbd className="tp-kbd">Enter</kbd> <span>{t("cmd.f.open")}</span>
        </span>
        {variant === "dialog" ? (
          <span>
            <kbd className="tp-kbd">Esc</kbd> <span>{t("cmd.f.close")}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}

/**
 * The /command page (command.html, rendered as a page): the same box and list, inline. It
 * lists screens and actions only, so typing gives the same order every time.
 */
export function CommandPanel() {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="tp-slash-menu tp-glass cmd cmd--page" data-component="CommandPalette" aria-label={t("cmd.title")}>
      <CommandBody variant="page" onDone={() => undefined} inputRef={inputRef} />
    </section>
  );
}

/**
 * CommandPalette: the Ctrl K command bar (docs/design/v3/screens/web/command.html), a glass
 * modal dialog over the current page. Focus goes to the box; Esc closes and focus returns to
 * where it was (Radix restores it, or `returnFocus` moves it). Tab stays inside.
 * shadcn target: command in dialog.
 */
export function CommandPalette({ open, onOpenChange, returnFocus }: Props) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tp-sheet-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className="tp-slash-menu tp-glass cmd"
          data-component="CommandPalette"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus?.()) event.preventDefault();
          }}
        >
          <Dialog.Title className="tp-sr-only">{t("cmd.title")}</Dialog.Title>
          <CommandBody variant="dialog" onDone={() => onOpenChange(false)} inputRef={inputRef} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
