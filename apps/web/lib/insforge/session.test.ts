import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "../../app/api/auth/insforge/refresh/route";
import {
  invalidateInsforgeSession,
  makeInsforgeDataFetch,
  makeInsforgeSessionSource,
  SESSION_REQUEST_HEADER,
} from "./client";
import {
  createInsforgeSessionStore,
  type InsforgeSessionAuth,
  sessionFromCurrentUser,
} from "./session";

type CurrentUser = Awaited<ReturnType<InsforgeSessionAuth["getCurrentUser"]>>;

function fakeAuth(answers: Array<CurrentUser | Error>) {
  const callbacks = new Set<() => void>();
  let calls = 0;
  const pending: Array<() => void> = [];
  const auth: InsforgeSessionAuth = {
    getCurrentUser() {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      return new Promise((resolve, reject) => {
        pending.push(() =>
          answer instanceof Error ? reject(answer) : resolve(answer as CurrentUser)
        );
      });
    },
    subscribe(callback) {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  };
  return {
    auth,
    emit: () => {
      for (const callback of callbacks) callback();
    },
    listenerCount: () => callbacks.size,
    calls: () => calls,
    flush: async () => {
      while (pending.length) pending.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

const signedIn = (id: string, email: string): CurrentUser => ({
  data: { user: { id, email } },
  error: null,
});
const noUser: CurrentUser = { data: { user: null }, error: null };

describe("sessionFromCurrentUser", () => {
  test("a user with an id is signed in with uid and email", () => {
    expect(sessionFromCurrentUser(signedIn("u1", "a@example.com"))).toEqual({
      status: "signedIn",
      uid: "u1",
      email: "a@example.com",
    });
  });

  test("no user, a blank id or an error is signed out", () => {
    expect(sessionFromCurrentUser(noUser)).toEqual({ status: "signedOut" });
    expect(sessionFromCurrentUser(signedIn(" ", "a@example.com"))).toEqual({ status: "signedOut" });
    expect(sessionFromCurrentUser({ data: null, error: new Error("x") })).toEqual({
      status: "signedOut",
    });
  });
});

describe("createInsforgeSessionStore", () => {
  test("starts loading, then signed in from getCurrentUser", async () => {
    const fake = fakeAuth([signedIn("u1", "a@example.com")]);
    const store = createInsforgeSessionStore(fake.auth);
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });

    expect(store.getSnapshot()).toEqual({ status: "loading" });
    store.start();
    await fake.flush();

    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u1", email: "a@example.com" });
    expect(notified).toBe(1);
  });

  test("no user is signed out", async () => {
    const fake = fakeAuth([noUser]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });

  test("null auth (client not configured) is signed out and start does nothing", () => {
    const store = createInsforgeSessionStore(null);
    store.start();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });

  test("an auth event re-reads the current user", async () => {
    const fake = fakeAuth([noUser, signedIn("u2", "b@example.com"), noUser]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });

    fake.emit();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u2", email: "b@example.com" });

    fake.emit();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
    expect(fake.calls()).toBe(3);
  });

  test("a thrown error is signed out", async () => {
    const fake = fakeAuth([new Error("network")]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });

  test("stop unsubscribes and ignores a late answer", async () => {
    const fake = fakeAuth([signedIn("u1", "a@example.com")]);
    const store = createInsforgeSessionStore(fake.auth);
    store.start();
    expect(fake.listenerCount()).toBe(1);

    store.stop();
    expect(fake.listenerCount()).toBe(0);
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "loading" });
  });

  test("a failed lookup is reported to onError, thrown or returned", async () => {
    const onError = mock((_error: unknown) => {});
    const fake = fakeAuth([new Error("network"), { data: null, error: new Error("expired") }]);
    const store = createInsforgeSessionStore(fake.auth, onError);
    store.start();
    await fake.flush();
    fake.emit();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
    expect(onError).toHaveBeenCalledTimes(2);
  });

  test("an older read that settles last does not overwrite a newer one", async () => {
    const settle: Array<(answer: CurrentUser | Error) => void> = [];
    const onError = mock((_error: unknown) => {});
    const auth: InsforgeSessionAuth = {
      getCurrentUser: () =>
        new Promise((resolve, reject) => {
          settle.push((answer) => (answer instanceof Error ? reject(answer) : resolve(answer)));
        }),
      subscribe: () => () => {},
    };
    const store = createInsforgeSessionStore(auth, onError);
    store.start();
    store.refetch();
    expect(settle).toHaveLength(2);

    settle[1]?.(signedIn("u1", "a@example.com"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u1", email: "a@example.com" });
    expect(onError).not.toHaveBeenCalled();

    settle[0]?.(new Error("refresh failed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u1", email: "a@example.com" });
  });

  test("a throwing onError does not block the signed-out update", async () => {
    const fake = fakeAuth([new Error("network")]);
    const store = createInsforgeSessionStore(fake.auth, () => {
      throw new Error("diagnostic failed");
    });
    store.start();
    await fake.flush();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
  });
});

const fixtureConfig = { url: "https://insforge.example.invalid", anonKey: "fixture" };
const fixtureUser = { id: "u1", email: "a@example.com" };
const fixtureSession = {
  user: { ...fixtureUser, profile: { name: "Unused" } },
  accessToken: "fixture-access",
  refreshToken: "fixture-refresh",
  csrfToken: "fixture-csrf",
};

describe("browser SSR session source", () => {
  test("uses the fixed same-origin route and refetches after SSR invalidation", async () => {
    const events = new EventTarget();
    let result = Response.json({ user: null }, { status: 401 });
    const fetchSession = Object.assign(
      mock(async () => result),
      { preconnect: mock() }
    );
    const store = createInsforgeSessionStore(
      makeInsforgeSessionSource(fixtureConfig, fetchSession, events)
    );
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    store.start();
    await tick();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
    expect(fetchSession).toHaveBeenCalledWith("/api/auth/insforge/refresh", {
      method: "POST",
      headers: { [SESSION_REQUEST_HEADER]: "1" },
      mode: "same-origin",
      redirect: "error",
      signal: expect.any(AbortSignal),
    });

    result = Response.json({ user: fixtureUser });
    invalidateInsforgeSession(events);
    await tick();
    expect(store.getSnapshot()).toEqual({ status: "signedIn", uid: "u1", email: "a@example.com" });

    result = Response.json({ user: null }, { status: 401 });
    store.refetch();
    await tick();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });

    store.stop();
    invalidateInsforgeSession(events);
    expect(fetchSession).toHaveBeenCalledTimes(3);
  });

  test("does not make requests for missing config", () => {
    const fetchSession = Object.assign(
      mock(async () => Response.json({})),
      { preconnect: mock() }
    );
    const source = makeInsforgeSessionSource(
      { url: fixtureConfig.url, anonKey: " " },
      fetchSession
    );
    const store = createInsforgeSessionStore(source);
    store.start();
    expect(store.getSnapshot()).toEqual({ status: "signedOut" });
    expect(fetchSession).not.toHaveBeenCalled();
  });

  test("does not overlap refreshes and retries after an in-flight failure", async () => {
    const events = new EventTarget();
    const first = Promise.withResolvers<Response>();
    const fetchSession = Object.assign(
      mock(async () => Response.json({ user: fixtureUser })).mockReturnValueOnce(first.promise),
      { preconnect: mock() }
    );
    const source = makeInsforgeSessionSource(fixtureConfig, fetchSession, events);
    const before = source?.getCurrentUser();
    const after = source?.getCurrentUser();
    await Promise.resolve();
    expect(fetchSession).toHaveBeenCalledTimes(1);

    first.resolve(Response.json({ user: null }, { status: 503 }));
    await expect(before).rejects.toThrow("InsForge session unavailable");
    expect(await after).toEqual({ data: { user: fixtureUser }, error: null });
    expect(fetchSession).toHaveBeenCalledTimes(2);
  });

  test("aborts a stalled read and releases the next queued read", async () => {
    const controller = new AbortController();
    const deadline = spyOn(AbortSignal, "timeout").mockReturnValueOnce(controller.signal);
    const fetchSession = Object.assign(
      mock(async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (init?.signal !== controller.signal) return Response.json({ user: fixtureUser });
        return new Promise<Response>((_resolve, reject) => {
          controller.signal.addEventListener("abort", () => reject(controller.signal.reason));
        });
      }),
      { preconnect: mock() }
    );
    try {
      const source = makeInsforgeSessionSource(fixtureConfig, fetchSession);
      const first = source?.getCurrentUser();
      const second = source?.getCurrentUser();
      await Promise.resolve();
      expect(deadline).toHaveBeenCalledWith(10_000);
      expect(fetchSession).toHaveBeenCalledTimes(1);

      controller.abort(new DOMException("Expired", "TimeoutError"));
      await expect(first).rejects.toHaveProperty("name", "TimeoutError");
      expect(await second).toEqual({ data: { user: fixtureUser }, error: null });
      expect(fetchSession).toHaveBeenCalledTimes(2);
    } finally {
      deadline.mockRestore();
    }
  });
});

const expiredAccess = `fixture.${btoa(JSON.stringify({ exp: 1 }))}.fixture`;
const currentAccess = `fixture.${btoa(JSON.stringify({ exp: 4_102_444_800 }))}.fixture`;

describe("browser InsForge data requests", () => {
  test.each([null, expiredAccess])("refreshes a missing or expired cookie", async (initial) => {
    let accessCookie = initial;
    const refreshFinished = Promise.withResolvers<void>();
    const refreshSession = mock(async () => {
      await refreshFinished.promise;
      accessCookie = currentAccess;
      return { data: { user: fixtureUser }, error: null };
    });
    const fetchData = Object.assign(
      mock(async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const auth = new Headers(init?.headers).get("authorization");
        expect(auth === `Bearer ${currentAccess}`).toBe(true);
        return Response.json([{ id: "row" }]);
      }),
      { preconnect: mock() }
    );
    const client = createServerClient({
      baseUrl: fixtureConfig.url,
      anonKey: fixtureConfig.anonKey,
      accessToken: initial ?? undefined,
      fetch: makeInsforgeDataFetch(refreshSession, () => accessCookie, fetchData),
    });
    const read = () =>
      client.database
        .from("test_rows")
        .select()
        .then((result) => result);
    const results = Promise.all([read(), read()]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchData).not.toHaveBeenCalled();

    refreshFinished.resolve();
    for (const result of await results) {
      expect(result.error).toBeNull();
      expect(result.data).toEqual([{ id: "row" }]);
    }
    expect((await read()).error).toBeNull();
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchData).toHaveBeenCalledTimes(3);
  });

  test("does not send a data request when refresh leaves the browser signed out", async () => {
    const refreshSession = mock(async () => ({ data: { user: null }, error: null }));
    const fetchData = Object.assign(
      mock(async () => Response.json([])),
      { preconnect: mock() }
    );
    const send = makeInsforgeDataFetch(refreshSession, () => expiredAccess, fetchData);
    const response = await send(fixtureConfig.url);
    expect(response.status).toBe(401);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchData).not.toHaveBeenCalled();
  });

  test("updates the session store when data-triggered refresh returns 401", async () => {
    const events = new EventTarget();
    let accessCookie = currentAccess;
    let signedIn = true;
    const fetchSession = Object.assign(
      mock(async () =>
        signedIn
          ? Response.json({ user: fixtureUser })
          : Response.json({ user: null }, { status: 401 })
      ),
      { preconnect: mock() }
    );
    const fetchData = Object.assign(
      mock(async () => Response.json([])),
      { preconnect: mock() }
    );
    const source = makeInsforgeSessionSource(fixtureConfig, fetchSession, events);
    if (!source) throw new Error("Missing fixture config");
    const store = createInsforgeSessionStore(source);
    const send = makeInsforgeDataFetch(
      source.getCurrentUser,
      () => accessCookie,
      fetchData,
      events
    );
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    store.start();
    try {
      await tick();
      expect(store.getSnapshot()).toEqual({
        status: "signedIn",
        uid: "u1",
        email: "a@example.com",
      });

      signedIn = false;
      accessCookie = expiredAccess;
      const responses = await Promise.all([send(fixtureConfig.url), send(fixtureConfig.url)]);
      expect(responses.map(({ status }) => status)).toEqual([401, 401]);
      await tick();

      expect(store.getSnapshot()).toEqual({ status: "signedOut" });
      expect(fetchSession).toHaveBeenCalledTimes(3);
      expect(fetchData).not.toHaveBeenCalled();
    } finally {
      store.stop();
    }
  });
});

describe("SSR refresh route", () => {
  let previousEnv: typeof process.env;
  const provider = Object.assign(mock<(...args: Parameters<typeof fetch>) => Promise<Response>>(), {
    preconnect: mock(),
  });

  beforeEach(() => {
    previousEnv = process.env;
    const nodeEnv = "NODE_ENV";
    process.env = { [nodeEnv]: "test" };
    process.env.NEXT_PUBLIC_DATA_BACKEND = "insforge";
    process.env.NEXT_PUBLIC_INSFORGE_URL = fixtureConfig.url;
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = fixtureConfig.anonKey;
    provider.mockClear();
  });

  afterEach(() => {
    process.env = previousEnv;
  });

  function request(cookie = "", allowed = true) {
    return new NextRequest("https://tempo.example.invalid/api/auth/insforge/refresh", {
      method: "POST",
      headers: { cookie, [SESSION_REQUEST_HEADER]: allowed ? "1" : "" },
    });
  }

  async function withProvider(respond: (path: string) => Response, run: () => Promise<void>) {
    provider.mockImplementation(async (input) => {
      const url = new URL(String(input));
      expect(url.origin).toBe(fixtureConfig.url);
      return respond(url.pathname);
    });
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation(provider);
    try {
      await run();
    } finally {
      fetchMock.mockRestore();
    }
  }

  test("verifies the session from the OTP cookies, then observes SSR sign-out", async () => {
    await withProvider(
      () => Response.json(fixtureSession),
      async () => {
        const jar = new NextResponse().cookies;
        const auth = createAuthActions({
          baseUrl: fixtureConfig.url,
          anonKey: fixtureConfig.anonKey,
          cookies: jar,
        });
        const cookies = () =>
          jar
            .getAll()
            .filter(({ value }) => value)
            .map(({ name, value }) => `${name}=${value}`)
            .join("; ");

        expect(
          (await auth.verifyOtp({ email: fixtureUser.email, otp: "012345" })).error
        ).toBeNull();
        const response = await POST(request(cookies()));
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(await response.json()).toEqual({ user: fixtureUser });
        expect(provider.mock.lastCall?.[0]).toBe(
          "https://insforge.example.invalid/api/auth/sessions/current"
        );

        expect((await auth.signOut()).error).toBeNull();
        const signedOut = await POST(request(cookies()));
        expect(signedOut.status).toBe(401);
        expect(await signedOut.json()).toEqual({ user: null });
        expect(provider).toHaveBeenCalledTimes(3);
      }
    );
  });

  test("refreshes with the SDK, rotating secured cookies without tokens in the body", async () => {
    await withProvider(
      (path) => {
        expect(path).toBe("/api/auth/refresh");
        return Response.json(fixtureSession);
      },
      async () => {
        const refreshed = await POST(request("insforge_refresh_token=old-fixture"));
        expect(refreshed.status).toBe(200);
        expect(await refreshed.json()).toEqual({ user: fixtureUser });
        const cookies = refreshed.headers.getSetCookie();
        expect(cookies).toHaveLength(2);
        expect(cookies[0]).toMatch(/^insforge_access_token=.*; Secure; SameSite=Lax$/);
        expect(cookies[1]).toMatch(/^insforge_refresh_token=.*; HttpOnly; Secure; SameSite=Lax$/);
        expect(provider).toHaveBeenCalledTimes(1);
        expect(provider.mock.lastCall?.[1]?.redirect).toBe("error");
      }
    );
  });

  test("refreshes after the provider rejects an expired access cookie", async () => {
    await withProvider(
      (path) => {
        if (path === "/api/auth/sessions/current") {
          return Response.json({ error: "AUTH_TOKEN_EXPIRED", statusCode: 401 }, { status: 401 });
        }
        expect(path).toBe("/api/auth/refresh");
        return Response.json(fixtureSession);
      },
      async () => {
        const response = await POST(
          request("insforge_access_token=expired-fixture; insforge_refresh_token=old-fixture")
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ user: fixtureUser });
        expect(provider).toHaveBeenCalledTimes(2);
      }
    );
  });

  test.each([401, 503])("hides provider refresh errors (%i)", async (status) => {
    await withProvider(
      () => Response.json({ message: "Provider-only detail", statusCode: status }, { status }),
      async () => {
        const response = await POST(request("insforge_refresh_token=old-fixture"));
        expect(response.status).toBe(status);
        expect(await response.json()).toEqual({ user: null });
        expect(response.headers.getSetCookie()).toHaveLength(0);
        expect(provider).toHaveBeenCalledTimes(1);
      }
    );
  });

  test("rejects non-app requests and disables the route when config is missing or backend is off", async () => {
    await withProvider(
      () => {
        throw new Error("Unexpected provider request");
      },
      async () => {
        expect((await POST(request("", false))).status).toBe(403);
        process.env.NEXT_PUBLIC_DATA_BACKEND = "convex";
        expect((await POST(request())).status).toBe(503);
        process.env.NEXT_PUBLIC_DATA_BACKEND = "insforge";
        process.env.NEXT_PUBLIC_INSFORGE_URL = "";
        expect((await POST(request())).status).toBe(503);
        expect(provider).not.toHaveBeenCalled();
      }
    );
  });

  test.each([
    "http://insforge.example.invalid",
    "http://localhost:7130",
    "ftp://insforge.example.invalid",
    "not a URL",
  ])("rejects invalid or non-HTTPS upstreams without sending cookies", async (url) => {
    process.env.NEXT_PUBLIC_INSFORGE_URL = url;
    await withProvider(
      () => {
        throw new Error("Unexpected provider request");
      },
      async () => {
        const response = await POST(request("insforge_refresh_token=old-fixture"));
        expect(response.status).toBe(503);
        expect(response.headers.getSetCookie()).toHaveLength(0);
        expect(provider).not.toHaveBeenCalled();
      }
    );
  });

  const stalledRequestCookies = [
    "insforge_refresh_token=old-fixture",
    "insforge_access_token=access-fixture",
  ];
  test.each(stalledRequestCookies)("aborts stalled upstream calls", async (cookie) => {
    const controller = new AbortController();
    const deadline = spyOn(AbortSignal, "timeout").mockReturnValueOnce(controller.signal);
    const started = Promise.withResolvers<void>();
    const upstream = Object.assign(
      (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          started.resolve();
        }),
      { preconnect: mock() }
    );
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation(upstream);
    try {
      const pending = POST(request(cookie));
      await started.promise;
      expect(deadline).toHaveBeenCalledWith(8_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      controller.abort(new DOMException("Provider stalled", "TimeoutError"));
      const response = await pending;
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ user: null });
      expect(response.headers.getSetCookie()).toHaveLength(0);
    } finally {
      fetchMock.mockRestore();
      deadline.mockRestore();
    }
  });
});
