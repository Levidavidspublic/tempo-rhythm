"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { CoachButton } from "./CoachButton";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { Topbar } from "./Topbar";
import { TpIconSprite } from "./TpIcon";

/** Under 1024 px the rail is a drawer (tempo.css "Responsive"). */
function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const update = () => setNarrow(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return narrow;
}

/**
 * TempoShell: the v3 app shell (docs/design/v3/screens/web/today.html, DESIGN.md §8).
 * Rail (264) + glass top bar + main; the rail becomes a drawer under 1024 px and a glass
 * tab bar appears under 768 px. Owns Ctrl K (command palette) and Ctrl J (coach).
 * shadcn target: sidebar (SidebarProvider).
 */
export function TempoShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const narrow = useNarrowViewport();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();

  // A followed link closes the drawer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => {
    setRailOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      } else if (isMeta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        router.push("/coach");
      } else if (e.key === "Escape") {
        setRailOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="tp-app" data-component="TempoShell" data-rail={railOpen ? "open" : "closed"}>
      <TpIconSprite />
      <a className="tp-skip" href="#main">
        {t("skip")}
      </a>
      <Sidebar
        inert={narrow && !railOpen}
        onOpenPalette={() => setPaletteOpen(true)}
        onNavigate={() => setRailOpen(false)}
      />
      <Topbar
        railOpen={railOpen}
        onToggleRail={() => setRailOpen((open) => !open)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <main className="tp-app__main" id="main" tabIndex={-1}>
        {children}
      </main>
      <CoachButton />
      <button
        type="button"
        className="tp-scrim"
        aria-label={t("top.menu")}
        tabIndex={-1}
        onClick={() => setRailOpen(false)}
      />
      <TabBar railOpen={railOpen} onToggleRail={() => setRailOpen((open) => !open)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
