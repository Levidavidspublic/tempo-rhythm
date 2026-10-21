"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { api } from "@/convex/_generated/api";
import type { MessageKey } from "@/lib/i18n";
import { isCurrent } from "@/lib/shell";
import { TpIcon, type TpIconName } from "./TpIcon";

type NavItem = { href: string; label: MessageKey; icon: TpIconName };

/** Top of the rail: the three places a day starts from (v3 today.html). */
const PRIMARY: readonly NavItem[] = [
  { href: "/today", label: "nav.today", icon: "today" },
  { href: "/brain-dump", label: "nav.inbox", icon: "inbox" },
  { href: "/coach", label: "nav.coach", icon: "coach" },
  { href: "/plan", label: "nav.plan", icon: "calendar-grid" },
];

const LIBRARY: readonly NavItem[] = [
  { href: "/tasks", label: "nav.tasks", icon: "checklist" },
  { href: "/journal", label: "nav.journal", icon: "edit" },
  { href: "/calendar", label: "nav.calendar", icon: "timeblock" },
  { href: "/habits", label: "nav.habits", icon: "habit" },
  { href: "/routines", label: "nav.routines", icon: "refresh" },
  { href: "/goals", label: "nav.goals", icon: "flag" },
  { href: "/projects", label: "nav.projects", icon: "folder" },
];

const YOU: readonly NavItem[] = [
  { href: "/insights", label: "nav.insights", icon: "chart" },
  { href: "/search", label: "nav.search", icon: "search" },
  { href: "/history", label: "nav.history", icon: "history" },
  { href: "/activity", label: "nav.activity", icon: "clock" },
  { href: "/settings/memory", label: "nav.memory", icon: "memory" },
  { href: "/settings/nags", label: "nav.nags", icon: "nag" },
];

/** Pages shown in the rail: pinned first, then the most recently edited. */
const RAIL_PAGE_LIMIT = 7;


function TreeLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string | null; onNavigate?: () => void }) {
  const { t } = useLocale();
  return (
    <li>
      <Link
        className="tp-tree-item"
        href={item.href}
        aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
        onClick={onNavigate}
      >
        <span className="tp-tree-item__icon">
          <TpIcon name={item.icon} size="sm" />
        </span>
        <span className="tp-tree-item__label">{t(item.label)}</span>
      </Link>
    </li>
  );
}

function RailPages({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  const { t } = useLocale();
  const { isAuthenticated } = useConvexAuth();
  // On a first sign-in the users row can land after auth; getProfile returns null until then,
  // so the rail waits for it instead of hitting requireUser early (same gate as NotesScreen).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  // Bounded and metadata-only: the shell never subscribes to page bodies.
  const notes = useQuery(api.notes.listForRail, profile ? { limit: RAIL_PAGE_LIMIT } : "skip");
  const pages = notes ?? [];

  return (
    <div className="tp-rail__group">
      <div className="tp-rail__label" id="pages-label">
        {t("rail.pages")}
      </div>
      <ul className="tp-tree" aria-labelledby="pages-label" data-component="PageTree">
        {pages.map((note) => {
          const href = `/notes/${note._id}`;
          return (
            <li key={note._id}>
              <Link
                className="tp-tree-item"
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                onClick={onNavigate}
              >
                <span className="tp-tree-item__icon">
                  <TpIcon name={note.pinned ? "pin" : "page"} size="sm" />
                </span>
                <span className="tp-tree-item__label" dir="auto">
                  {note.title.trim() || t("page.untitled")}
                </span>
              </Link>
            </li>
          );
        })}
        {notes !== undefined && pages.length === 0 ? (
          <li className="tp-tree-item tp-muted" aria-disabled="true">
            <span className="tp-tree-item__icon">
              <TpIcon name="leaf" size="sm" />
            </span>
            <span className="tp-tree-item__label">{t("rail.noPages")}</span>
          </li>
        ) : null}
        <TreeLink item={{ href: "/notes", label: "rail.allPages", icon: "list" }} pathname={pathname} onNavigate={onNavigate} />
        <TreeLink item={{ href: "/templates", label: "nav.templates", icon: "template" }} pathname={pathname} onNavigate={onNavigate} />
      </ul>
    </div>
  );
}

type SidebarProps = {
  /** Closed drawer under 1024 px: off-screen, so out of the tab order and the a11y tree. */
  inert?: boolean;
  onOpenPalette: () => void;
  /** Called after a link is followed, so the drawer can close under 1024 px. */
  onNavigate?: () => void;
};

/**
 * Sidebar / PageTree: the v3 rail (docs/design/v3/screens/web/today.html, DESIGN.md §9).
 * shadcn target: sidebar + collapsible. Classes and data-component names follow tempo.css.
 */
export function Sidebar({ inert = false, onOpenPalette, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { t, lang, setLang } = useLocale();
  const { dyslexia, setDyslexia } = useTheme();
  const { signOut } = useAuthActions();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
  };

  return (
    <nav className="tp-rail" data-component="Sidebar" aria-label={t("rail.label")} inert={inert}>
      <div className="tp-rail__brand">
        <span className="tp-rail__mark" aria-hidden="true">
          T
        </span>
        <span>Tempo</span>
      </div>
      <button
        className="tp-btn tp-btn--secondary tp-rail__search"
        type="button"
        data-component="CommandTrigger"
        onClick={onOpenPalette}
      >
        <TpIcon name="search" size="sm" />
        <span>{t("rail.search")}</span>
        <kbd className="tp-kbd tp-num">Ctrl K</kbd>
      </button>

      <div className="tp-rail__group">
        <ul className="tp-tree">
          {PRIMARY.map((item) => (
            <TreeLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </ul>
      </div>

      <RailPages pathname={pathname} onNavigate={onNavigate} />

      <div className="tp-rail__group">
        <div className="tp-rail__label" id="library-label">
          {t("rail.library")}
        </div>
        <ul className="tp-tree" aria-labelledby="library-label">
          {LIBRARY.map((item) => (
            <TreeLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </ul>
      </div>

      <div className="tp-rail__group">
        <div className="tp-rail__label" id="you-label">
          {t("rail.you")}
        </div>
        <ul className="tp-tree" aria-labelledby="you-label">
          {YOU.map((item) => (
            <TreeLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </ul>
      </div>

      <div className="tp-rail__foot">
        <button
          className="tp-tree-item"
          type="button"
          aria-pressed={dyslexia}
          onClick={() => setDyslexia(!dyslexia)}
        >
          <span className="tp-tree-item__icon">
            <TpIcon name="type" size="sm" />
          </span>
          <span className="tp-tree-item__label">{t("nav.dyslexia")}</span>
        </button>
        <button
          className="tp-tree-item"
          type="button"
          lang={lang === "he" ? "en" : "he"}
          onClick={() => setLang(lang === "he" ? "en" : "he")}
        >
          <span className="tp-tree-item__icon">
            <TpIcon name="globe" size="sm" />
          </span>
          <span className="tp-tree-item__label">{t("nav.language")}</span>
        </button>
        <TreeLink item={{ href: "/settings/profile", label: "nav.settings", icon: "settings" }} pathname={pathname} onNavigate={onNavigate} />
        <button className="tp-tree-item" type="button" onClick={handleSignOut}>
          <span className="tp-tree-item__icon">
            <TpIcon name="logout" size="sm" />
          </span>
          <span className="tp-tree-item__label">{t("nav.signOut")}</span>
        </button>
      </div>
    </nav>
  );
}
