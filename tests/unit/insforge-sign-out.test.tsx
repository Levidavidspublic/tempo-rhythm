import { spawn } from "bun";
import { beforeEach, expect, mock, test } from "bun:test";

const fixtureOrigin = "https://insforge.example.invalid";
const isolated = process.env.P36B_SIGN_OUT === "1";

if (!isolated) {
  test("InsForge sign-out checks run in an isolated process", async () => {
    const env = {
      ...process.env,
      P36B_SIGN_OUT: "1",
      NEXT_PUBLIC_DATA_BACKEND: "insforge",
      NEXT_PUBLIC_INSFORGE_URL: fixtureOrigin,
      NEXT_PUBLIC_INSFORGE_ANON_KEY: "fixture",
    };
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
    if (status !== 0) throw new Error(`sign-out checks failed:\n${stdout}${stderr}`);
    expect(stderr).toContain("6 pass");
    expect(stderr).toContain("0 fail");
  }, 60_000);
}

type CookieCall = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

const cookieCalls: CookieCall[] = [];
const cookieStore = {
  get: () => undefined,
  set: (
    nameOrCookie: string | { name: string; value: string },
    value?: string,
    options?: Record<string, unknown>
  ) => {
    if (typeof nameOrCookie === "string") {
      cookieCalls.push({ name: nameOrCookie, value: value ?? "", options });
      return;
    }
    const { name, value: cookieValue, ...rest } = nameOrCookie;
    cookieCalls.push({ name, value: cookieValue, options: rest });
  },
};

const fetchMock = Object.assign(
  mock(async () => new Response(JSON.stringify({ ok: false }), { status: 500 })),
  { preconnect: mock() }
);
const useAuthActions = mock(() => ({ signOut: mock(async () => {}) }));
const useQuery = mock(() => undefined);
const useMutation = mock(() => async () => {});
const replace = mock(() => {});

if (isolated) {
  void mock.module("next/headers", () => ({
    cookies: async () => cookieStore,
  }));
  void mock.module("@convex-dev/auth/react", () => ({ useAuthActions }));
  void mock.module("convex/react", () => ({ useQuery, useMutation }));
  void mock.module("next/navigation", () => ({
    useRouter: () => ({ replace }),
    usePathname: () => "/today",
  }));
}

const actions = isolated ? await import("../../apps/web/app/sign-in/insforge-actions") : null;
const locale = isolated ? await import("../../apps/web/components/providers/LocaleProvider") : null;
const waiting = isolated
  ? await import("../../apps/web/components/approval/WaitingForApproval")
  : null;
const react = isolated ? await import("../../apps/web/node_modules/react") : null;
const reactServer = isolated ? await import("../../apps/web/node_modules/react-dom/server") : null;

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

function cleared(name: string): CookieCall[] {
  return cookieCalls.filter((call) => call.name === name && call.value === "");
}

function assertCookiesCleared() {
  for (const name of ["insforge_access_token", "insforge_refresh_token"]) {
    const matches = cleared(name);
    expect(matches.length).toBeGreaterThan(0);
    for (const call of matches) {
      expect(call.options).toEqual(
        expect.objectContaining({
          path: "/",
          sameSite: "lax",
          secure: true,
          maxAge: 0,
        })
      );
      expect(call.options).not.toHaveProperty("domain");
    }
  }
}

function logoutUrls(): URL[] {
  return fetchMock.mock.calls.map((call) => {
    const input = call[0];
    const href =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : "";
    return new URL(href);
  });
}

function assertFixtureLogout() {
  const urls = logoutUrls();
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    if (url.origin !== fixtureOrigin || url.pathname !== "/api/auth/logout") {
      throw new Error("logout request left the fixture host");
    }
  }
}

if (actions && locale && waiting && react && reactServer) {
  const { signOutInsforge } = actions;
  const { LocaleProvider } = locale;
  const { WaitingForApproval } = waiting;
  const { createElement } = react;
  const { renderToStaticMarkup } = reactServer;

  beforeEach(() => {
    cookieCalls.length = 0;
    fetchMock.mockReset();
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ ok: false }), { status: 500 })
    );
    useAuthActions.mockClear();
    useQuery.mockClear();
    useMutation.mockClear();
    replace.mockClear();
    setEnv("NEXT_PUBLIC_DATA_BACKEND", "insforge");
    setEnv("NEXT_PUBLIC_INSFORGE_URL", fixtureOrigin);
    setEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", "fixture");
    globalThis.fetch = fetchMock;
  });

  test("the action clears both session cookies when the provider rejects logout", async () => {
    const result = await signOutInsforge();
    expect(result).toBeUndefined();
    assertFixtureLogout();
    assertCookiesCleared();
  });

  test("a provider failure still clears the local cookies", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("provider unavailable");
    });
    const result = await signOutInsforge();
    expect(result).toBeUndefined();
    assertCookiesCleared();
  });

  test("Convex mode does not call the provider and still clears the cookies", async () => {
    setEnv("NEXT_PUBLIC_DATA_BACKEND", "convex");
    const result = await signOutInsforge();
    expect(result).toBeUndefined();
    expect(fetchMock.mock.calls.length).toBe(0);
    assertCookiesCleared();
  });

  test("missing InsForge config still clears the cookies without a provider call", async () => {
    setEnv("NEXT_PUBLIC_INSFORGE_URL", undefined);
    setEnv("NEXT_PUBLIC_INSFORGE_ANON_KEY", undefined);
    const result = await signOutInsforge();
    expect(result).toBeUndefined();
    expect(fetchMock.mock.calls.length).toBe(0);
    assertCookiesCleared();
  });

  const renderWaiting = (backend: "convex" | "insforge") =>
    renderToStaticMarkup(
      createElement(
        LocaleProvider,
        null,
        createElement(WaitingForApproval, {
          email: "person@example.invalid",
          revoked: false,
          backend,
        })
      )
    );

  test("InsForge waiting screen shows sign-out and no Convex name form", () => {
    const html = renderWaiting("insforge");
    expect(html).toContain("Sign out");
    expect(html).toContain("border-input");
    expect(html).not.toContain("approval-name");
    expect(useAuthActions).not.toHaveBeenCalled();
    expect(useQuery).not.toHaveBeenCalled();
    expect(useMutation).not.toHaveBeenCalled();
  });

  test("Convex waiting screen still shows the name form and sign-out", () => {
    const html = renderWaiting("convex");
    expect(html).toContain("approval-name");
    expect(html).toContain("Sign out");
    expect(html).toContain("border-input");
    expect(useAuthActions).toHaveBeenCalledTimes(1);
    expect(useQuery).toHaveBeenCalledTimes(1);
    expect(useMutation).toHaveBeenCalledTimes(1);
  });
}
