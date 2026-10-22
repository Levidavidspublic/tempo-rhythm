"use client";

import { usePathname, useRouter } from "next/navigation";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachPageProvider } from "@/components/coach/CoachPage";
import { CoachPanel } from "@/components/coach/CoachPanel";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useAccountLanguage } from "@/components/providers/useAccountLanguage";
import { kb74t } from "@/lib/i18n-groups/kb-74";
import { CoachButton } from "./CoachButton";
import { CommandPalette } from "./CommandPalette";
import { type ShellSlots, ShellSlotsContext } from "./ShellSlots";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { Topbar } from "./Topbar";
import { TpIconSprite } from "./TpIcon";
import "@/app/v3/kb-74.css";

const RAIL_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const { lang, t } = useLocale();
  // A new device (nothing saved) shows every signed-in screen in the account's language.
  useAccountLanguage();
  // The coach panel docks beside the page at 1280 px and up and is a sheet below that. On /coach
  // the coach is the page itself, so the panel and the button stay away.
  const onCoachRoute = pathname === "/coach" || Boolean(pathname?.startsWith("/coach/"));
  const [coachOpen, setCoachOpen] = useState(false);
  const coachButton = useRef<HTMLButtonElement | null>(null);
  const [asideHost, setAsideHost] = useState<HTMLElement | null>(null);
  const [asideClaims, setAsideClaims] = useState(0);
  const panelOpen = coachOpen && !onCoachRoute;
  const appRef = useRef<HTMLDivElement | null>(null);
  const railOpener = useRef<HTMLElement | null>(null);
  const railOpenActive = useRef<Element | null>(null);
  const railReturnFocus = useRef(false);
  const railFocusMain = useRef(false);
  const ownedInert = useRef(new Set<HTMLElement>());
  // Closing the panel puts focus back on the coach button, once the shell is no longer inert.
  const refocusCoachButton = useRef(false);
  // The palette replaced the coach sheet: closing the palette returns focus to the coach button
  // (the control focused before it is gone with the sheet).
  const paletteReplacedCoach = useRef(false);
  const paletteOpenRef = useRef(paletteOpen);
  paletteOpenRef.current = paletteOpen;
  const drawerModal = narrow && railOpen && !paletteOpen && !panelOpen;
  const drawerSemantics = drawerModal
    ? { role: "dialog" as const, "aria-modal": true as const, "aria-label": kb74t(lang, "kb74.navigation") }
    : {};

  // On /coach the coach is the page, so a panel left open does not come back on the next page.
  useEffect(() => {
    if (onCoachRoute) setCoachOpen(false);
  }, [onCoachRoute]);

  const dismissRail = useCallback(() => {
    const rail = appRef.current?.querySelector<HTMLElement>('[data-component="Sidebar"]');
    const scrim = appRef.current?.querySelector<HTMLElement>(".tp-scrim");
    const active = document.activeElement;
    railReturnFocus.current = Boolean(
      active && (rail?.contains(active) || active === scrim),
    );
    setRailOpen(false);
  }, []);

  const toggleRail = useCallback((trigger: "topbar" | "tabbar") => {
    if (railOpen) {
      dismissRail();
      return;
    }
    railOpener.current = appRef.current?.querySelector<HTMLElement>(
      trigger === "topbar" ? '[data-component="Topbar"] .tp-topbar__menu' : '[data-component="TabBar"] button',
    ) ?? null;
    railOpenActive.current = document.activeElement;
    railReturnFocus.current = false;
    railFocusMain.current = false;
    setRailOpen(true);
  }, [dismissRail, railOpen]);

  const openPalette = useCallback(() => {
    railReturnFocus.current = false;
    setRailOpen(false);
    setPaletteOpen(true);
  }, []);

  const openCoach = useCallback(() => {
    railReturnFocus.current = false;
    setRailOpen(false);
    setCoachOpen(true);
  }, []);

  // The opener is still focused immediately after the drawer renders. Move focus before making
  // the rest of the shell inert; a later user or overlay focus change wins over this effect.
  useEffect(() => {
    if (!drawerModal) return;
    const active = document.activeElement;
    if (active !== railOpenActive.current) return;
    appRef.current
      ?.querySelector<HTMLElement>('[data-component="Sidebar"] [data-component="CommandTrigger"]')
      ?.focus();
  }, [drawerModal]);

  // The drawer and coach sheet share one inert owner, so a transition between them never lets
  // one overlay's cleanup expose the page underneath the other. Sidebar's own inert prop remains
  // React-owned and is deliberately excluded here.
  const coachModal = panelOpen && coachSheet;
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    for (const child of Array.from(app.children)) {
      if (!(child instanceof HTMLElement)) continue;
      const sidebar = child.classList.contains("kb74-rail-boundary");
      const scrim = child.classList.contains("tp-scrim");
      const panel = child.classList.contains("tp-coach-panel");
      const shouldInert = coachModal
        ? !sidebar && !scrim && !panel
        : drawerModal && !sidebar && !scrim;
      if (shouldInert && !child.inert) {
        child.inert = true;
        ownedInert.current.add(child);
      } else if (!shouldInert && ownedInert.current.delete(child)) {
        child.inert = false;
      }
    }
  }, [coachModal, drawerModal]);
  useEffect(() => () => {
    for (const child of ownedInert.current) child.inert = false;
    ownedInert.current.clear();
  }, []);

  useEffect(() => {
    if (drawerModal || railOpen) return;
    const main = appRef.current?.querySelector<HTMLElement>("#main");
    if (railFocusMain.current) {
      railFocusMain.current = false;
      railReturnFocus.current = false;
      if (!paletteOpen && !panelOpen) main?.focus();
      return;
    }
    if (!railReturnFocus.current) return;
    railReturnFocus.current = false;
    if (paletteOpen || panelOpen) return;
    const opener = railOpener.current;
    if (opener?.isConnected && opener.getClientRects().length > 0 && !opener.matches(":disabled") && !opener.closest("[inert]")) {
      opener.focus();
      if (document.activeElement !== opener) main?.focus();
    } else {
      main?.focus();
    }
  }, [drawerModal, railOpen, paletteOpen, panelOpen]);

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
  const handleRailNavigate = useCallback(() => {
    if (narrow && railOpen) railFocusMain.current = true;
    railReturnFocus.current = false;
    setRailOpen(false);
  }, [narrow, railOpen]);
  const claimAside = useCallback(() => {
    setAsideClaims((n) => n + 1);
    return () => setAsideClaims((n) => n - 1);
  }, []);
  const slots = useMemo<ShellSlots>(
    () => ({
      coachOpen: panelOpen,
      coachAvailable: !onCoachRoute,
      openCoach,
      closeCoach,
      asideHost,
      claimAside,
    }),
    [panelOpen, onCoachRoute, openCoach, closeCoach, asideHost, claimAside],
  );

  // A followed link closes the drawer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => {
    if (railOpen) railFocusMain.current = true;
    setRailOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (narrow || !railOpen) return;
    railReturnFocus.current = false;
    railFocusMain.current = false;
    setRailOpen(false);
  }, [narrow, railOpen]);

  function keepRailFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!drawerModal || event.key !== "Tab") return;
    const rail = appRef.current?.querySelector<HTMLElement>('[data-component="Sidebar"]');
    if (!rail) return;
    const items = Array.from(rail.querySelectorAll<HTMLElement>(RAIL_FOCUSABLE)).filter(
      (item) => item.getClientRects().length > 0 && !item.closest("[inert]"),
    );
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!first || !last) {
      event.preventDefault();
    } else if (event.shiftKey && (active === first || !rail.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !rail.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (paletteOpenRef.current) setPaletteOpen(false);
        else openPalette();
      } else if (isMeta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (onCoachRoute) document.getElementById("coach-message")?.focus();
        else if (panelOpen) closeCoach();
        else openCoach();
      } else if (e.key === "Escape") {
        // An overlay above (the palette, an editor popup) already took this Escape: only the
        // topmost one closes.
        if (e.defaultPrevented || paletteOpenRef.current) return;
        if (panelOpen) closeCoach();
        else if (drawerModal) dismissRail();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCoachRoute, panelOpen, drawerModal, openPalette, openCoach, closeCoach, dismissRail]);

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
      onKeyDownCapture={keepRailFocus}
    >
      <TpIconSprite />
      <a className="tp-skip" href="#main">
        {t("skip")}
      </a>
      <div
        className="kb74-rail-boundary"
        {...drawerSemantics}
      >
        <Sidebar
          inert={(narrow && !railOpen) || coachModal}
          onOpenPalette={openPalette}
          onNavigate={handleRailNavigate}
        />
      </div>
      <Topbar
        railOpen={railOpen}
        onToggleRail={() => toggleRail("topbar")}
        onOpenPalette={openPalette}
      />
      <main className="tp-app__main" id="main" tabIndex={-1}>
        {children}
      </main>
      <div className="tp-app__aside" ref={setAsideHost} data-component="PageAside" hidden={asideClaims === 0} />
      {onCoachRoute ? null : (
        <CoachButton ref={coachButton} expanded={panelOpen} onOpen={openCoach} />
      )}
      {panelOpen ? <CoachPanel onClose={closeCoach} modal={coachSheet} /> : null}
      <button
        type="button"
        className="tp-scrim"
        aria-label={drawerModal ? kb74t(lang, "kb74.closeNavigation") : t("coachPanel.close")}
        tabIndex={-1}
        onClick={() => {
          if (panelOpen) closeCoach();
          else if (drawerModal) dismissRail();
        }}
      />
      <TabBar railOpen={railOpen} onToggleRail={() => toggleRail("tabbar")} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} returnFocus={returnFocusFromPalette} />
    </div>
    </ShellSlotsContext.Provider>
    </CoachPageProvider>
  );
}

/** Fictional, interactive browser fixture around the same mounted shell and real controls. */
export function Kb74Gallery() {
  const { lang, setLang } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <TempoShell>
      <section className="tp-paper kb74-gallery" data-component="Kb74Gallery">
        <h1>{kb74t(lang, "kb74.galleryTitle")}</h1>
        <p>{kb74t(lang, "kb74.galleryHint")}</p>
        <div className="kb74-gallery__controls">
          <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setLang(lang === "he" ? "en" : "he")}>
            {kb74t(lang, "kb74.switchLanguage")}
          </button>
          <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {kb74t(lang, "kb74.switchTheme")}
          </button>
        </div>
      </section>
    </TempoShell>
  );
}
