"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { MessageKey } from "@/lib/i18n";
import { isCurrent } from "@/lib/shell";
import { TpIcon, type TpIconName } from "./TpIcon";

const TABS: readonly { href: string; label: MessageKey; icon: TpIconName }[] = [
  { href: "/tasks", label: "tab.inbox", icon: "inbox" },
  { href: "/today", label: "nav.today", icon: "today" },
  { href: "/plan", label: "tab.upcoming", icon: "calendar-grid" },
  { href: "/coach", label: "tab.chat", icon: "coach" },
];

/** TabBar: glass, under 768 px only (tempo.css hides it above). shadcn target: tabs (nav). */
export function TabBar({ railOpen, onToggleRail }: { railOpen: boolean; onToggleRail: () => void }) {
  const pathname = usePathname();
  const { t } = useLocale();
  return (
    <nav className="tp-tabbar tp-glass" data-component="TabBar" aria-label={t("tab.label")}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          className="tp-tab"
          href={tab.href}
          aria-current={isCurrent(pathname, tab.href) ? "page" : undefined}
        >
          <TpIcon name={tab.icon} />
          <span>{t(tab.label)}</span>
        </Link>
      ))}
      <button className="tp-tab" type="button" aria-expanded={railOpen} onClick={onToggleRail}>
        <TpIcon name="sidebar" />
        <span>{t("tab.more")}</span>
      </button>
    </nav>
  );
}
