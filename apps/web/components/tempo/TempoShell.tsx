"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachPanel } from "@/components/coach/CoachPanel";
import { useLocale } from "@/components/providers/LocaleProvider";
import { CoachButton } from "./CoachButton";
import { CommandPalette } from "./CommandPalette";
import { type ShellSlots, ShellSlotsContext } from "./ShellSlots";
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
  // The coach panel docks beside the page at 1280 px and up and is a sheet below that. On /coach
  // the coach is the page itself, so the panel and the button stay away.
  const onCoachRoute = pathname === "/coach" || Boolean(pathname?.startsWith("/coach/"));
  const [coachOpen, setCoachOpen] = useState(false);
  const coachButton = useRef<HTMLButtonElement | null>(null);
  const [asideHost, setAsideHost] = useState<HTMLElement | null>(null);
  const [asideClaims, setAsideClaims] = useState(0);
  const panelOpen = coachOpen && !onCoachRoute;

  const closeCoach = useCallback(() => {
    setCoachOpen(false);
    // Back to where the coach was opened from.
    window.requestAnimationFrame(() => coachButton.current?.focus());
  }, []);
  const claimAside = useCallback(() => {
    setAsideClaims((n) => n + 1);
    return () => setAsideClaims((n) => n - 1);
  }, []);
  const slots = useMemo<ShellSlots>(
    () => ({
      coachOpen: panelOpen,
      coachAvailable: !onCoachRoute,
      openCoach: () => setCoachOpen(true),
      closeCoach,
      asideHost,
      claimAside,
    }),
    [panelOpen, onCoachRoute, closeCoach, asideHost, claimAside],
  );

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
        if (onCoachRoute) document.getElementById("coach-message")?.focus();
        else setCoachOpen((open) => !open);
      } else if (e.key === "Escape") {
        setRailOpen(false);
        setCoachOpen((open) => {
          if (open) window.requestAnimationFrame(() => coachButton.current?.focus());
          return false;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCoachRoute]);

  return (
    <ShellSlotsContext.Provider value={slots}>
    <div
      className="tp-app"
      data-component="TempoShell"
      data-rail={railOpen ? "open" : "closed"}
      data-coach={panelOpen ? "open" : "closed"}
      data-aside={asideClaims > 0 ? "open" : "closed"}
    >
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
      <div className="tp-app__aside" ref={setAsideHost} data-component="PageAside" hidden={asideClaims === 0} />
      {onCoachRoute ? null : (
        <CoachButton ref={coachButton} expanded={panelOpen} onOpen={() => setCoachOpen(true)} />
      )}
      {panelOpen ? <CoachPanel onClose={closeCoach} /> : null}
      <button
        type="button"
        className="tp-scrim"
        aria-label={t("top.menu")}
        tabIndex={-1}
        onClick={() => {
          setRailOpen(false);
          if (panelOpen) closeCoach();
        }}
      />
      <TabBar railOpen={railOpen} onToggleRail={() => setRailOpen((open) => !open)} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
    </ShellSlotsContext.Provider>
  );
}
