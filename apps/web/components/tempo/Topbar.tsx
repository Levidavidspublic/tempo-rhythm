"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { api } from "@/convex/_generated/api";
import { crumbKey, initialsFor } from "@/lib/shell";
import { TEMPO_SCREENS } from "@/lib/tempo-nav";
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
  const profile = useQuery(api.users.getProfile, {});
  const key = crumbKey(pathname);
  const fallback =
    TEMPO_SCREENS.find((s) => s.route === pathname)?.title ??
    TEMPO_SCREENS.find((s) => pathname.startsWith(`${s.route}/`))?.title ??
    "Tempo";
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
        <span className="tp-topbar__hide-sm">{t("top.crumb")}</span>
        <TpIcon name="chevron" size="sm" flip className="tp-topbar__hide-sm" />
        <strong>{key ? t(key) : fallback}</strong>
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
