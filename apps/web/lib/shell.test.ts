import { describe, expect, test } from "bun:test";
import { MESSAGES, type MessageKey } from "./i18n";
import { type Crumbs, crumbsFor, initialsFor, isCurrent, pageIdFor } from "./shell";
import { TEMPO_SCREENS } from "./tempo-nav";

const HEBREW = /[֐-׿]/;

/** The crumbs as the English or Hebrew top bar reads them, section first. */
function read(crumbs: Crumbs, lang: "en" | "he"): string[] {
  const current = "key" in crumbs.current ? MESSAGES[lang][crumbs.current.key] : crumbs.current.text;
  return crumbs.section ? [MESSAGES[lang][crumbs.section], current] : [current];
}

describe("isCurrent", () => {
  test("matches the route and the routes below it, not siblings", () => {
    expect(isCurrent("/notes", "/notes")).toBe(true);
    expect(isCurrent("/notes/abc", "/notes")).toBe(true);
    expect(isCurrent("/notes-old", "/notes")).toBe(false);
    expect(isCurrent(null, "/notes")).toBe(false);
  });
});

describe("crumbsFor: every screen", () => {
  test.each(TEMPO_SCREENS.map((s) => [s.route, s.label] as const))(
    "%s names itself with %s, in English and real Hebrew",
    (route, label) => {
      const crumbs = crumbsFor(route);
      expect(crumbs.current).toEqual({ key: label });
      const en = read(crumbs, "en");
      const he = read(crumbs, "he");
      for (const text of en) expect(text.trim().length).toBeGreaterThan(0);
      for (const text of he) expect(text).toMatch(HEBREW);
      expect(he).not.toEqual(en);
    },
  );
  test("screen labels are message keys in both languages", () => {
    for (const screen of TEMPO_SCREENS) {
      expect(Object.hasOwn(MESSAGES.en, screen.label)).toBe(true);
      expect(Object.hasOwn(MESSAGES.he, screen.label)).toBe(true);
    }
  });
});

describe("crumbsFor: pages", () => {
  test("a page reads Pages › its title", () => {
    const crumbs = crumbsFor("/notes/k17abc", "  Weekend reset ");
    expect(crumbs).toEqual({ section: "top.crumb", current: { text: "Weekend reset" } });
    expect(read(crumbs, "en")).toEqual(["Pages", "Weekend reset"]);
    expect(read(crumbs, "he")).toEqual(["דפים", "Weekend reset"]);
  });
  test("a page with no title reads Pages › Untitled", () => {
    expect(read(crumbsFor("/notes/k17abc", ""), "en")).toEqual(["Pages", "Untitled"]);
    expect(read(crumbsFor("/notes/k17abc", "   "), "he")).toEqual(["דפים", "ללא כותרת"]);
  });
  test("while the page loads, or when it can't be shown, only the section shows", () => {
    expect(crumbsFor("/notes/k17abc")).toEqual({ section: null, current: { key: "top.crumb" } });
    expect(crumbsFor("/notes/k17abc", null)).toEqual({ section: null, current: { key: "top.crumb" } });
  });
  test("the /p alias is a page too", () => {
    expect(read(crumbsFor("/p/k17abc", "Week 42"), "en")).toEqual(["Pages", "Week 42"]);
  });
  test("the page list and the week opener are screens, not pages", () => {
    expect(read(crumbsFor("/notes", "ignored"), "en")).toEqual(["Pages", "Notes"]);
    expect(read(crumbsFor("/week/2026-W42"), "en")).toEqual(["Pages", "This week"]);
    expect(read(crumbsFor("/week"), "he")).toEqual(["דפים", "השבוע"]);
  });
  test("pageIdFor finds the id only on a single page route", () => {
    expect(pageIdFor("/notes/k17abc")).toBe("k17abc");
    expect(pageIdFor("/p/k17abc")).toBe("k17abc");
    expect(pageIdFor("/notes")).toBeNull();
    expect(pageIdFor("/notes/k17abc/more")).toBeNull();
    expect(pageIdFor("/today")).toBeNull();
  });
});

describe("crumbsFor: settings", () => {
  test("settings sub-pages read Settings › the sub-page", () => {
    expect(read(crumbsFor("/settings/preferences"), "en")).toEqual(["Settings", "Preferences"]);
    expect(read(crumbsFor("/settings/preferences"), "he")).toEqual(["הגדרות", "העדפות"]);
    expect(read(crumbsFor("/settings/profile"), "en")).toEqual(["Settings", "Profile"]);
    expect(read(crumbsFor("/settings/integrations"), "en")).toEqual(["Settings", "Integrations"]);
    expect(read(crumbsFor("/settings/privacy"), "en")).toEqual(["Settings", "Privacy"]);
    expect(read(crumbsFor("/settings/nags"), "en")).toEqual(["Settings", "Nags"]);
    expect(read(crumbsFor("/settings/memory"), "en")).toEqual(["Settings", "Memory"]);
    expect(read(crumbsFor("/settings/memory/import"), "en")).toEqual(["Settings", "Memory"]);
  });
  test("the settings pages outside /settings sit under Settings too (billing.html)", () => {
    expect(read(crumbsFor("/billing"), "en")).toEqual(["Settings", "Plan and billing"]);
    expect(read(crumbsFor("/notifications"), "en")).toEqual(["Settings", "Notifications"]);
    expect(read(crumbsFor("/ask-founder"), "en")).toEqual(["Settings", "Ask the founder"]);
  });
  test("the settings index is Settings alone, never Settings › Settings", () => {
    expect(crumbsFor("/settings")).toEqual({ section: null, current: { key: "nav.settings" } });
  });
});

describe("crumbsFor: other screens", () => {
  const cases: [string, string[], string[]][] = [
    ["/today", ["Pages", "Today"], ["דפים", "היום"]],
    ["/tracking", ["Pages", "Session tracking"], ["דפים", "מעקב ריכוז"]],
    ["/history", ["Pages", "Coach history"], ["דפים", "היסטוריית מאמן"]],
    ["/goals/abc", ["Pages", "Goals"], ["דפים", "מטרות"]],
    ["/projects/abc/kanban", ["Pages", "Projects"], ["דפים", "פרויקטים"]],
    ["/templates/editor/abc", ["Pages", "Templates"], ["דפים", "תבניות"]],
    ["/modules/preview/abc", ["Pages", "Modules"], ["דפים", "מודולים"]],
    ["/command", ["Pages", "Command"], ["דפים", "פקודות"]],
  ];
  test.each(cases)("%s", (route, en, he) => {
    expect(read(crumbsFor(route), "en")).toEqual(en);
    expect(read(crumbsFor(route), "he")).toEqual(he);
  });
  test("a sibling route is not a sub-route", () => {
    expect(read(crumbsFor("/goals-old"), "en")).toEqual(["Pages"]);
  });
  test("an unknown route shows the section name, never an English fallback", () => {
    const crumbs = crumbsFor("/somewhere");
    expect(crumbs.current).toEqual({ key: "top.crumb" satisfies MessageKey });
    expect(read(crumbs, "he")).toEqual(["דפים"]);
  });
});

describe("initialsFor", () => {
  test("two initials from a two-word name", () => {
    expect(initialsFor({ greetingName: "Maya Ronen" })).toBe("MR");
  });
  test("falls back to the email name and never shows the User placeholder", () => {
    expect(initialsFor({ greetingName: "User", email: "dana.levi@example.com" })).toBe("DL");
    expect(initialsFor({ email: "yoni@example.com" })).toBe("YO");
  });
  test("no profile gives no initials", () => {
    expect(initialsFor(null)).toBe("");
    expect(initialsFor(undefined)).toBe("");
  });
});
