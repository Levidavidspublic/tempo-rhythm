import { spawn } from "bun";
import { beforeEach, expect, mock, test } from "bun:test";
import { createElement, Fragment } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import type { InsforgeSession } from "../../apps/web/lib/insforge/session";

const childBackend = process.env.P41_FIXTURE_RENDER;

if (childBackend !== "convex" && childBackend !== "insforge") {
  for (const backend of ["convex", "insforge"]) {
    test(`isolated shell render in ${backend} mode`, async () => {
      const env = {
        ...process.env,
        NODE_ENV: "test",
        NEXT_PUBLIC_DATA_BACKEND: backend,
        P41_FIXTURE_RENDER: backend,
      };
      Reflect.deleteProperty(env, "NEXT_PUBLIC_INSFORGE_URL");
      Reflect.deleteProperty(env, "NEXT_PUBLIC_INSFORGE_ANON_KEY");
      const child = spawn([process.execPath, "test", import.meta.path], {
        env,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, status] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      if (status !== 0) throw new Error(`Shell render failed in ${backend}:\n${stdout}${stderr}`);
      expect(stderr).toContain("4 pass");
      expect(stderr).toContain("0 fail");
    });
  }
} else {
  const isInsforge = childBackend === "insforge";
  const app = new URL("../../apps/web/", import.meta.url).pathname;
  const { getFunctionName } = await import("../../apps/web/node_modules/convex/server");
  let pathname = "/projects";
  let session: InsforgeSession;
  const note = { _id: "fixture-note", title: "Convex fixture page", pinned: true };
  const convexCalls: string[] = [];

  const convexCall = (name: string) => {
    if (isInsforge) throw new Error(`Unexpected Convex hook in InsForge shell: ${name}`);
    convexCalls.push(name);
  };

  void mock.module(Bun.resolveSync("convex/react", app), () => ({
    useConvexAuth() {
      convexCall("useConvexAuth");
      return { isAuthenticated: true, isLoading: false };
    },
    useQuery(query: Parameters<typeof getFunctionName>[0], args: unknown) {
      const name = getFunctionName(query);
      convexCall(name);
      if (args === "skip") return undefined;
      if (name === "users:getProfile") return { greetingName: "Convex Owner" };
      if (name === "notes:listForRail") return [note];
      if (name === "notes:getSafe") return note;
      return undefined;
    },
    useMutation(mutation: Parameters<typeof getFunctionName>[0]) {
      convexCall(getFunctionName(mutation));
      return async () => note._id;
    },
  }));
  void mock.module("../../apps/web/node_modules/@convex-dev/auth/react", () => ({
    useAuthActions() {
      convexCall("useAuthActions");
      return { signOut: async () => undefined };
    },
  }));
  void mock.module("../../apps/web/node_modules/next/navigation", () => ({
    usePathname: () => pathname,
    useRouter: () => ({ push() {}, replace() {} }),
  }));
  void mock.module("../../apps/web/lib/insforge/session", () => ({
    useInsforgeSession() {
      if (!isInsforge) throw new Error("Convex shell read the InsForge session");
      return session;
    },
  }));

  const dialogPath = Bun.resolveSync("@radix-ui/react-dialog", app);
  const dialog = await import(dialogPath);
  void mock.module(dialogPath, () => ({
    ...dialog,
    Portal: Fragment,
  }));

  const { Sidebar } = await import("../../apps/web/components/tempo/Sidebar");
  const { Topbar } = await import("../../apps/web/components/tempo/Topbar");
  const { CommandPalette, CommandPanel } = await import(
    "../../apps/web/components/tempo/CommandPalette"
  );
  const { LocaleProvider } = await import("../../apps/web/components/providers/LocaleProvider");
  const { ThemeProvider } = await import("../../apps/web/components/providers/ThemeProvider");
  const noop = () => undefined;

  const render = (component: Parameters<typeof renderToStaticMarkup>[0]) =>
    renderToStaticMarkup(
      createElement(LocaleProvider, null, createElement(ThemeProvider, null, component))
    );

  beforeEach(() => {
    convexCalls.length = 0;
    pathname = "/projects";
    session = { status: "signedIn", uid: "fixture-owner", email: "insforge.owner@example.invalid" };
  });

  test("Sidebar keeps core navigation with backend-appropriate account and page controls", () => {
    const markup = render(createElement(Sidebar, { onOpenPalette: noop }));
    expect(markup).toContain('data-component="Sidebar"');
    for (const route of ["/today", "/tasks", "/projects", "/notes", "/settings/profile"]) {
      expect(markup).toContain(`href="${route}"`);
    }
    expect(markup).toMatch(/<a(?=[^>]*href="\/projects")(?=[^>]*aria-current="page")[^>]*>/);
    expect(markup.includes(note.title)).toBe(!isInsforge);
    expect(markup.includes("Sign out")).toBe(!isInsforge);
    expect(markup).not.toContain("No pages yet");
    expect(convexCalls).toEqual(
      isInsforge ? [] : ["useConvexAuth", "users:getProfile", "notes:listForRail", "useAuthActions"]
    );
  });

  test("Topbar renders route breadcrumbs and uses only its backend's profile source", () => {
    const props = { railOpen: false, onToggleRail: noop, onOpenPalette: noop };
    const markup = render(createElement(Topbar, props));
    expect(markup).toContain("<strong>Projects</strong>");
    expect(markup).toContain(isInsforge ? "insforge.owner@example.invalid" : "Convex Owner");
    pathname = "/notes/fixture-note";
    const noteMarkup = render(createElement(Topbar, props));
    expect(noteMarkup).toContain(isInsforge ? "<strong>Pages</strong>" : note.title);
    expect(convexCalls.includes("notes:getSafe")).toBe(!isInsforge);
  });

  test("open palette keeps navigation and omits unavailable page operations", () => {
    const markup = render(createElement(CommandPalette, { open: true, onOpenChange: noop }));
    expect(markup).toContain('data-component="CommandPalette"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain("Today");
    expect(markup).toContain("Tasks");
    expect(markup.includes('data-group="recent"')).toBe(!isInsforge);
    expect(markup.includes(note.title)).toBe(!isInsforge);
    expect(markup.includes("New page")).toBe(!isInsforge);
    expect(convexCalls).toEqual(
      isInsforge
        ? []
        : [
            "useConvexAuth",
            "notes:create",
            "users:getProfile",
            "notes:listForRail",
            "notes:searchTitles",
          ]
    );
  });

  test("inline command panel keeps navigation with the same backend gate", () => {
    const markup = render(createElement(CommandPanel));
    expect(markup).toContain('role="listbox"');
    expect(markup).toContain("Today");
    expect(markup).not.toContain('data-group="recent"');
    expect(markup.includes("New page")).toBe(!isInsforge);
  });
}
