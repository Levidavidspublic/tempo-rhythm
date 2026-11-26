import { spawn } from "bun";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import type { InsforgeSession } from "../../apps/web/lib/insforge/session";

if (process.env.P37_FIXTURE_RENDER !== "1") {
  test("InsForge ProjectsScreen fixture renders are isolated from Bun's other module mocks", async () => {
    const env = {
      ...process.env,
      P37_FIXTURE_RENDER: "1",
      NODE_ENV: "test",
      NEXT_PUBLIC_DATA_BACKEND: "insforge",
      NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS: "1",
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
    if (status !== 0) throw new Error(`P37 fixture process failed:\n${stdout}${stderr}`);
    expect(stderr).toContain("5 pass");
    expect(stderr).toContain("0 fail");
  });
} else {
  const uid = "a187aeb4-2a0d-471f-8f01-04e8805d683d";
  const otherUid = "8278b666-98bb-4631-aea5-489f17c4154d";
  const approved: InsforgeSession = { status: "signedIn", uid, email: "owner@example.test" };
  const ownTask = {
    id: "00000000-0000-4000-8000-000000000001",
    user_id: uid,
    title: "Reset the kitchen",
    project_id: "kitchen",
    project_name: "Kitchen reset",
    status: "todo",
    priority: "high",
    created_at: 1,
    updated_at: 1,
    deleted_at: null,
  };
  const foreignTask = {
    ...ownTask,
    id: "00000000-0000-4000-8000-000000000002",
    user_id: otherUid,
    project_id: "private",
    project_name: "Other owner's project",
  };

  type Row = Record<string, unknown>;
  type ReadOptions = Omit<Parameters<typeof createLiveRows<Row>>[0], "onRows">;
  let session: InsforgeSession;
  let rows: Row[] | undefined;
  let read: ReadOptions | undefined;
  let pending: PromiseWithResolvers<Row[]>;
  let live: ReturnType<typeof createLiveRows> | undefined;
  const fetch = mock(() => Promise.reject(new Error("Unexpected provider request")));
  globalThis.fetch = Object.assign(fetch, { preconnect: () => {} });

  const navigation = { ...(await import("../../apps/web/node_modules/next/navigation")) };
  const liveRows = { ...(await import("../../apps/web/lib/insforge/use-live-rows")) };
  const { createLiveRows } = liveRows;
  mock.module("../../apps/web/node_modules/next/navigation", () => ({
    ...navigation,
    useRouter: () => ({ push() {} }),
  }));
  mock.module("../../apps/web/lib/insforge/session", () => ({ useInsforgeSession: () => session }));
  mock.module("../../apps/web/lib/insforge/use-live-rows", () => ({
    ...liveRows,
    useLiveRows(options: ReadOptions) {
      read = options;
      return rows;
    },
  }));

  const { ProjectsScreen } = await import("../../apps/web/components/projects/ProjectsScreen");
  const { LocaleProvider } = await import("../../apps/web/components/providers/LocaleProvider");
  const { getOwnerRowTransport } = await import("../../apps/web/lib/insforge/owner-row-transport");
  const { getE2eRowStore } = await import("../../apps/web/lib/insforge/e2e-row-store");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  const store = getE2eRowStore();
  if (!store) throw new Error("Expected a keyless owner row fixture store");

  beforeEach(() => {
    session = approved;
    rows = undefined;
    read = undefined;
    fetch.mockClear();
    store.reset([{ table: "tasks", row: ownTask }, { table: "tasks", row: foreignTask }]);
  });

  afterEach(() => {
    live?.stop();
    live = undefined;
    expect(fetch).not.toHaveBeenCalled();
  });

  function render() {
    return renderToStaticMarkup(createElement(LocaleProvider, null, createElement(ProjectsScreen)));
  }

  function startRead() {
    if (!read) throw new Error("ProjectsScreen did not request tasks");
    pending = Promise.withResolvers();
    live = createLiveRows<Row>({
      ...read,
      debounceMs: 0,
      onRows(snapshot) {
        rows = snapshot;
        pending.resolve(snapshot);
      },
      onError(error) {
        pending.reject(error);
      },
    });
    return pending.promise;
  }

  test("approved owner sees only their project without a Convex provider", async () => {
    render();
    expect(read?.uid).toBe(uid);
    await startRead();
    const markup = render();
    expect(markup).toContain("Kitchen reset");
    expect(markup).toContain('href="/projects/kitchen"');
    expect(markup).not.toContain("/projects/private");
  });

  test("anonymous session sees sign-in and its task read is skipped", () => {
    session = { status: "signedOut" };
    const markup = render();
    expect(read?.table).toBe("tasks");
    expect(read?.uid).toBeUndefined();
    expect(markup).toContain('data-component="StateSignedOut"');
    expect(markup).toContain("Sign in to see this page.");
    expect(markup).not.toContain("Kitchen reset");
  });

  test("loading session renders the skeleton without requesting any owner's tasks", () => {
    session = { status: "loading" };
    const markup = render();
    expect(read?.uid).toBeUndefined();
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain('data-component="StateSignedOut"');
  });

  test("approved owner sees the empty state after an empty read", async () => {
    store.reset([{ table: "tasks", row: foreignTask }]);
    expect(render()).toContain('aria-busy="true"');
    await expect(startRead()).resolves.toEqual([]);
    expect(render()).toContain("No projects yet.");
  });

  test("an owner row change refreshes the rendered project without provider requests", async () => {
    render();
    await startRead();
    expect(render()).toContain("Kitchen reset");
    const transport = getOwnerRowTransport();
    if (!transport) throw new Error("Expected the keyless fixture transport");
    pending = Promise.withResolvers();
    await transport.mutate(
      { table: "tasks", uid },
      {
        type: "update",
        id: ownTask.id,
        patch: { project_name: "Kitchen finished", status: "done", updated_at: 2 },
      }
    );
    await pending.promise;
    const markup = render();
    expect(markup).toContain("Kitchen finished");
    expect(markup).not.toContain("Kitchen reset");
  });
}
