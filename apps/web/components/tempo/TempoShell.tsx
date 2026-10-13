"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachPageProvider } from "@/components/coach/CoachPage";
import { CoachPanel } from "@/components/coach/CoachPanel";
import { useLocale } from "@/components/providers/LocaleProvider";
import { CoachButton } from "./CoachButton";
import { CommandPalette } from "./CommandPalette";
import { type ShellSlots, ShellSlotsContext } from "./ShellSlots";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { Topbar } from "./Topbar";
import { TpIconSprite } from "./TpIcon";

function useMaxWidth(px: number): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${px}px)`);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [px]);
  return matches;
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
  // Under 1024 px the rail is a drawer; under 1280 px the coach panel is a sheet over the page
  // (tempo.css "Responsive").
  const narrow = useMaxWidth(1023);
  const coachSheet = useMaxWidth(1279);
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
  const appRef = useRef<HTMLDivElement | null>(null);
  // Closing the panel puts focus back on the coach button, once the shell is no longer inert.
  const refocusCoachButton = useRef(false);
  // The palette replaced the coach sheet: closing the palette returns focus to the coach button
  // (the control focused before it is gone with the sheet).
  const paletteReplacedCoach = useRef(false);
  const paletteOpenRef = useRef(paletteOpen);
  paletteOpenRef.current = paletteOpen;

  // On /coach the coach is the page, so a panel left open does not come back on the next page.
  useEffect(() => {
    if (onCoachRoute) setCoachOpen(false);
  }, [onCoachRoute]);

  // As a sheet the panel is modal: everything else in the shell is inert until it closes. The
  // rail's inert is React's own (drawer state, below), so it is left out here and set by prop.
  const coachModal = panelOpen && coachSheet;
  useEffect(() => {
    const app = appRef.current;
    if (!coachModal || !app) return;
    const made = Array.from(app.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        !el.classList.contains("tp-coach-panel") &&
        !el.classList.contains("tp-scrim") &&
        el.getAttribute("data-component") !== "Sidebar" &&
        !el.hasAttribute("inert"),
    );
    for (const el of made) el.inert = true;
    return () => {
      for (const el of made) el.inert = false;
    };
  }, [coachModal]);

  // The palette and the coach sheet are both modal: opening one closes the other. Opening the
  // coach also closes the rail drawer, whose scrim would sit above the sheet.
  useEffect(() => {
    if (!(paletteOpen && coachSheet)) return;
    setCoachOpen((open) => {
      if (open) paletteReplacedCoach.current = true;
      return false;
    });
  }, [paletteOpen, coachSheet]);
  useEffect(() => {
    if (!panelOpen) return;
    setPaletteOpen(false);
    setRailOpen(false);
  }, [panelOpen]);
  const returnFocusFromPalette = useCallback(() => {
    if (!paletteReplacedCoach.current) return false;
    paletteReplacedCoach.current = false;
    coachButton.current?.focus();
    return true;
  }, []);

  useEffect(() => {
    if (panelOpen || !refocusCoachButton.current) return;
    refocusCoachButton.current = false;
    coachButton.current?.focus();
  }, [panelOpen]);

  const closeCoach = useCallback(() => {
    refocusCoachButton.current = true;
    setCoachOpen(false);
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
        else
          setCoachOpen((open) => {
            // Closing with Ctrl J puts focus back on the coach button, like Escape does.
            if (open) refocusCoachButton.current = true;
            return !open;
          });
      } else if (e.key === "Escape") {
        // An overlay above (the palette, an editor popup) already took this Escape: only the
        // topmost one closes.
        if (e.defaultPrevented || paletteOpenRef.current) return;
        setRailOpen(false);
        setCoachOpen((open) => {
          if (open) refocusCoachButton.current = true;
          return false;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCoachRoute]);

  return (
    <CoachPageProvider>
    <ShellSlotsContext.Provider value={slots}>
    <div
      ref={appRef}
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
        inert={(narrow && !railOpen) || coachModal}
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
      {panelOpen ? <CoachPanel onClose={closeCoach} modal={coachSheet} /> : null}
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
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} returnFocus={returnFocusFromPalette} />
    </div>
    </ShellSlotsContext.Provider>
    </CoachPageProvider>
  );
}
