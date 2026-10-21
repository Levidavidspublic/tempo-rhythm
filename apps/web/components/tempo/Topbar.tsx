"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { api } from "@/convex/_generated/api";
import { crumbsFor, initialsFor, pageIdFor } from "@/lib/shell";
import { TpIcon } from "./TpIcon";

type TopbarProps = {
  railOpen: boolean;
  onToggleRail: () => void;
  onOpenPalette: () => void;
};

/**
 * Topbar: glass, sticky (DESIGN.md §5). Breadcrumb, search, theme, avatar.
 * shadcn target: breadcrumb.
 */
export function Topbar({ railOpen, onToggleRail, onOpenPalette }: TopbarProps) {
  const pathname = usePathname() ?? "/";
  const { t } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, {});
  // On a page, read its title with the same query and arguments the page itself uses
  // (NotePage), so Convex shares one subscription. Until it arrives the bar shows "Pages".
  const pageId = pageIdFor(pathname);
  const page = useQuery(
    api.notes.getSafe,
    pageId && isAuthenticated && profile != null ? { noteId: pageId } : "skip",
  );
  const crumbs = crumbsFor(pathname, page === undefined ? undefined : (page?.title ?? null));
  const initials = initialsFor(profile);
  const dark = resolvedTheme === "dark";

  return (
    <header className="tp-topbar tp-glass" data-component="Topbar">
      <button
        className="tp-btn tp-btn--ghost tp-btn--icon tp-topbar__menu"
        type="button"
        aria-expanded={railOpen}
        aria-label={t("top.menu")}
        onClick={onToggleRail}
      >
        <TpIcon name="sidebar" />
      </button>
      <div className="tp-topbar__crumbs">
        {crumbs.section ? (
          <>
            <span className="tp-topbar__hide-sm">{t(crumbs.section)}</span>
            <TpIcon name="chevron" size="sm" flip className="tp-topbar__hide-sm" />
          </>
        ) : null}
        {"key" in crumbs.current ? (
          <strong>{t(crumbs.current.key)}</strong>
        ) : (
          // A page title is the person's own text: it takes its own direction (DESIGN.md §10).
          <strong dir="auto" title={crumbs.current.text}>
            {crumbs.current.text}
          </strong>
        )}
      </div>
      <button
        className="tp-btn tp-btn--ghost tp-btn--icon"
        type="button"
        aria-label={t("rail.search")}
        onClick={onOpenPalette}
      >
        <TpIcon name="search" />
      </button>
      <button
        className="tp-btn tp-btn--ghost tp-btn--icon"
        type="button"
        aria-pressed={dark}
        aria-label={dark ? t("top.themeLight") : t("top.themeDark")}
        onClick={() => setTheme(dark ? "light" : "dark")}
      >
        <TpIcon name={dark ? "sun" : "moon"} />
      </button>
      {initials ? (
        <span
          className="tp-avatar"
          role="img"
          aria-label={profile?.greetingName ?? profile?.email ?? initials}
          data-component="Avatar"
        >
          {initials}
        </span>
      ) : null}
    </header>
  );
}
