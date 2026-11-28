import { afterEach, beforeEach, describe, expect, jest, mock, spyOn, test } from "bun:test";
import { getE2eRowStore } from "./e2e-row-store";
import { getOwnerRowTransport, makeOwnerRowTransportGetter } from "./owner-row-transport";
import { createLiveRows } from "./use-live-rows";

type Row = { id: string };
type Result = { data: Row[] | null; error: unknown };
type Client = NonNullable<Parameters<typeof createLiveRows>[0]["client"]>;

async function advanceTimers(ms: number) {
  jest.advanceTimersByTime(ms);
  // Drain the fake connect, subscribe and query promise chain without real time.
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

type Joined = { ok: true; channel: string; presence: { members: never[] } };
type Rejected = { ok: false; channel: string; error: { code: string; message: string } };

function makeClient(
  read: () => Promise<Result> = async () => ({ data: [{ id: "first" }], error: null }),
  subscribeResult: (channel: string) => Joined | Rejected = (channel) => ({
    ok: true,
    channel,
    presence: { members: [] },
  })
) {
  const listeners = new Map<string, Map<unknown, (message: unknown) => void>>();
  const eq = mock((_column: string, _value: string | number | boolean) => {});
  const order = mock((_column: string, _options: { ascending?: boolean }) => {});
  const select = mock((_columns: string) => {
    const query = Object.assign(read(), {
      eq(column: string, value: string | number | boolean) {
        eq(column, value);
        return query;
      },
      order(column: string, options: { ascending?: boolean }) {
        order(column, options);
        return query;
      },
    });
    return query;
  });
  const single = mock(
    async (): Promise<{ data: Row | null; error: unknown }> => ({
      data: { id: "written" },
      error: null,
    })
  );
  const returnColumns = mock(() => ({ single }));
  const writeFilter = mock(() => write);
  const write = { eq: writeFilter, select: returnColumns };
  const insert = mock(() => write);
  const update = mock(() => write);
  const client = {
    database: { from: mock((_table: string) => ({ select, insert, update })) },
    realtime: {
      connect: mock(async () => {}),
      subscribe: mock(async (channel: string) => subscribeResult(channel)),
      unsubscribe: mock((_channel: string) => {}),
      on<T>(event: string, callback: (message: T) => void) {
        const callbacks = listeners.get(event) ?? new Map();
        callbacks.set(callback, (message: unknown) => callback(message as T));
        listeners.set(event, callbacks);
      },
      off<T>(event: string, callback: (message: T) => void) {
        listeners.get(event)?.delete(callback);
      },
    },
  } satisfies Client;
  return {
    client,
    eq,
    order,
    select,
    insert,
    update,
    writeFilter,
    returnColumns,
    single,
    emit(event: string, channel: string) {
      for (const callback of listeners.get(event)?.values() ?? []) {
        callback({
          id: "event-id",
          meta: {
            channel,
            messageId: "message",
            senderType: "system",
            timestamp: "2026-11-25T00:00:00Z",
          },
        });
      }
    },
  };
}

describe("createLiveRows", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("joins the owner channel and loads rows with the query options", async () => {
    const { client, eq, order, select } = makeClient();
    const onRows = mock((_rows: Row[]) => {});
    const live = createLiveRows({
      client,
      table: "tasks",
      uid: "owner",
      select: "id",
      filters: [["archived", false]],
      order: { column: "id", ascending: false },
      onRows,
    });

    expect(onRows).not.toHaveBeenCalled();
    await advanceTimers(0);
    expect(client.realtime.connect).toHaveBeenCalledTimes(1);
    expect(client.realtime.subscribe).toHaveBeenCalledWith("tasks:owner");
    expect(client.database.from).toHaveBeenCalledWith("tasks");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("user_id", "owner");
    expect(eq).toHaveBeenCalledWith("archived", false);
    expect(order).toHaveBeenCalledWith("id", { ascending: false });
    expect(onRows).toHaveBeenCalledWith([{ id: "first" }]);
    live.stop();
  });

  test("debounces a burst and ignores other channels", async () => {
    let rows = [{ id: "first" }];
    const { client, emit } = makeClient(async () => ({ data: rows, error: null }));
    const onRows = mock((_rows: Row[]) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows });
    await advanceTimers(0);

    emit("UPDATE", "tasks:another-owner");
    await advanceTimers(150);
    expect(client.database.from).toHaveBeenCalledTimes(1);

    rows = [{ id: "fresh" }];
    emit("INSERT", "tasks:owner");
    await advanceTimers(100);
    emit("UPDATE", "tasks:owner");
    await advanceTimers(149);
    expect(client.database.from).toHaveBeenCalledTimes(1);
    await advanceTimers(1);
    expect(client.database.from).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenLastCalledWith(rows);
    live.stop();
  });

  test("stop cancels queued work and suppresses an in-flight result", async () => {
    const pending = Promise.withResolvers<Result>();
    const { client, emit } = makeClient(() => pending.promise);
    const onRows = mock((_rows: Row[]) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows });
    await advanceTimers(0);
    expect(client.database.from).toHaveBeenCalledTimes(1);

    emit("UPDATE", "tasks:owner");
    live.stop();
    live.stop();
    pending.resolve({ data: [{ id: "late" }], error: null });
    emit("UPDATE", "tasks:owner");
    await advanceTimers(150);

    expect(client.database.from).toHaveBeenCalledTimes(1);
    expect(client.realtime.unsubscribe).toHaveBeenCalledTimes(1);
    expect(client.realtime.unsubscribe).toHaveBeenCalledWith("tasks:owner");
    expect(onRows).not.toHaveBeenCalled();
  });

  test("keeps a shared channel subscribed until the last list stops", async () => {
    const { client, emit } = makeClient();
    const first = mock((_rows: Row[]) => {});
    const second = mock((_rows: Row[]) => {});
    const a = createLiveRows({ client, table: "tasks", uid: "owner", onRows: first });
    const b = createLiveRows({ client, table: "tasks", uid: "owner", onRows: second });
    await advanceTimers(0);
    expect(client.realtime.subscribe).toHaveBeenCalledTimes(1);

    a.stop();
    expect(client.realtime.unsubscribe).not.toHaveBeenCalled();
    emit("UPDATE", "tasks:owner");
    await advanceTimers(150);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    b.stop();
    expect(client.realtime.unsubscribe).toHaveBeenCalledWith("tasks:owner");
  });

  test("publishes nothing without a client or owner", async () => {
    const { client } = makeClient();
    const onRows = mock((_rows: Row[]) => {});
    const missingClient = createLiveRows({ client: null, table: "tasks", uid: "owner", onRows });
    const missingOwner = createLiveRows({ client, table: "tasks", uid: "", onRows });
    await advanceTimers(150);
    expect(onRows).not.toHaveBeenCalled();
    expect(client.database.from).not.toHaveBeenCalled();
    expect(client.realtime.connect).not.toHaveBeenCalled();
    missingClient.stop();
    missingOwner.stop();
  });

  test("retries a rejected join with backoff and loads again once joined", async () => {
    let accept = false;
    let rows = [{ id: "first" }];
    const { client } = makeClient(
      async () => ({ data: rows, error: null }),
      (channel) =>
        accept
          ? { ok: true, channel, presence: { members: [] } }
          : { ok: false, channel, error: { code: "FORBIDDEN", message: "rejected" } }
    );
    const onRows = mock((_rows: Row[]) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows });
    await advanceTimers(0);
    expect(client.realtime.subscribe).toHaveBeenCalledTimes(1);
    expect(onRows).toHaveBeenCalledTimes(1);

    accept = true;
    rows = [{ id: "after-join" }];
    await advanceTimers(500);
    expect(client.realtime.subscribe).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenLastCalledWith([{ id: "after-join" }]);
    live.stop();
  });

  test("retries a failed connect and stops retrying after the last list stops", async () => {
    const { client } = makeClient();
    client.realtime.connect.mockImplementation(async () => {
      throw new Error("offline");
    });
    const onRows = mock((_rows: Row[]) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows });
    await advanceTimers(0);
    expect(client.realtime.connect).toHaveBeenCalledTimes(1);
    await advanceTimers(500);
    expect(client.realtime.connect).toHaveBeenCalledTimes(2);

    live.stop();
    await advanceTimers(10_000);
    expect(client.realtime.connect).toHaveBeenCalledTimes(2);
  });

  test("reports a failed read separately and retries the first read", async () => {
    let fail = true;
    const { client } = makeClient(async () =>
      fail
        ? { data: null, error: new Error("read failed") }
        : { data: [{ id: "first" }], error: null }
    );
    const onRows = mock((_rows: Row[]) => {});
    const onError = mock((_error: unknown) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows, onError });
    await advanceTimers(0);
    expect(onRows).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);

    fail = false;
    await advanceTimers(500);
    expect(onRows).toHaveBeenCalledWith([{ id: "first" }]);
    live.stop();
  });

  test("keeps the last rows when a later read fails", async () => {
    let fail = false;
    const { client, emit } = makeClient(async () =>
      fail
        ? { data: null, error: new Error("read failed") }
        : { data: [{ id: "first" }], error: null }
    );
    const onRows = mock((_rows: Row[]) => {});
    const onError = mock((_error: unknown) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows, onError });
    await advanceTimers(0);
    fail = true;
    emit("UPDATE", "tasks:owner");
    await advanceTimers(150);
    expect(onRows).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    await advanceTimers(10_000);
    expect(client.database.from).toHaveBeenCalledTimes(2);
    live.stop();
  });

  test("refetches after a reconnect once the rejoin is acknowledged", async () => {
    let rows = [{ id: "first" }];
    const { client, emit } = makeClient(async () => ({ data: rows, error: null }));
    const onRows = mock((_rows: Row[]) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows });
    await advanceTimers(0);
    expect(onRows).toHaveBeenCalledTimes(1);

    rows = [{ id: "missed-while-offline" }];
    emit("connect", "");
    await advanceTimers(0);
    expect(client.realtime.subscribe).toHaveBeenCalledTimes(2);
    expect(onRows).toHaveBeenLastCalledWith([{ id: "missed-while-offline" }]);

    live.stop();
    emit("connect", "");
    await advanceTimers(0);
    expect(client.realtime.subscribe).toHaveBeenCalledTimes(2);
  });

  test("does not subscribe when the last list stops while connecting", async () => {
    const connecting = Promise.withResolvers<void>();
    const { client } = makeClient();
    client.realtime.connect.mockImplementation(() => connecting.promise);
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows: () => {} });
    await advanceTimers(0);
    live.stop();
    connecting.resolve();
    await advanceTimers(10_000);
    expect(client.realtime.subscribe).not.toHaveBeenCalled();
  });

  test("a rejoin during a pending first read starts a newer read that wins", async () => {
    const first = Promise.withResolvers<Result>();
    let reads = 0;
    const { client, emit } = makeClient(() => {
      reads += 1;
      return reads === 1
        ? first.promise
        : Promise.resolve({ data: [{ id: "newer" }], error: null });
    });
    const onRows = mock((_rows: Row[]) => {});
    const live = createLiveRows({ client, table: "tasks", uid: "owner", onRows });
    await advanceTimers(0);
    expect(reads).toBe(1);

    emit("connect", "");
    await advanceTimers(0);
    expect(reads).toBe(2);
    first.resolve({ data: [{ id: "older" }], error: null });
    await advanceTimers(0);
    expect(onRows).toHaveBeenCalledTimes(1);
    expect(onRows).toHaveBeenLastCalledWith([{ id: "newer" }]);
    live.stop();
  });
});

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

describe("owner row transport", () => {
  const scope = { table: "tasks", uid: "owner" };
  const ownerColumn = "user_id";
  const bypassName = "NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS";
  let originalMode: string | undefined;
  let originalBypass: string | undefined;
  let originalWindow: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    originalMode = process.env.NODE_ENV;
    originalBypass = process.env[bypassName];
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    setEnv("NODE_ENV", "test");
    process.env[bypassName] = "1";
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  });

  afterEach(() => {
    getE2eRowStore()?.reset();
    setEnv("NODE_ENV", originalMode);
    setEnv(bypassName, originalBypass);
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    jest.useRealTimers();
  });

  test("loads a fixture snapshot and reselects after scoped writes without using the SDK", async () => {
    const { client } = makeClient();
    const getClient = mock(() => client);
    const transport = makeOwnerRowTransportGetter(getClient)();
    if (!transport) throw new Error("Expected a browser fixture transport");
    const otherOwner = { ...scope, uid: "other" };
    const row = { id: "fixture", rank: 2, archived: false };
    await transport.mutate(scope, { type: "insert", row });
    await transport.mutate(otherOwner, { type: "insert", row: { ...row, id: "separate" } });
    const onRows = mock<(rows: Row[]) => void>();
    const live = createLiveRows({
      ...scope,
      client,
      select: "id",
      filters: [["archived", false]],
      order: { column: "rank" },
      onRows,
    });
    try {
      expect(onRows).not.toHaveBeenCalled();
      await advanceTimers(0);
      expect(onRows).toHaveBeenLastCalledWith([{ id: row.id }]);

      await transport.mutate(otherOwner, { type: "update", id: "separate", patch: { rank: 0 } });
      await advanceTimers(150);
      expect(onRows).toHaveBeenCalledTimes(1);

      const id = await transport.mutate(scope, {
        type: "insert",
        row: { rank: 1, archived: false },
      });
      await advanceTimers(149);
      expect(onRows).toHaveBeenCalledTimes(1);
      await advanceTimers(1);
      expect(onRows).toHaveBeenLastCalledWith([{ id }, { id: row.id }]);

      await transport.mutate(scope, { type: "update", id, patch: { archived: true } });
      await advanceTimers(150);
      expect(onRows).toHaveBeenLastCalledWith([{ id: row.id }]);
      expect(getClient).not.toHaveBeenCalled();
      expect(client.database.from).not.toHaveBeenCalled();
      expect(client.realtime.connect).not.toHaveBeenCalled();
    } finally {
      live.stop();
    }
  });

  test("releases the fixture subscription on cleanup and does not subscribe without an owner", async () => {
    const store = getE2eRowStore();
    if (!store) throw new Error("Expected a browser fixture store");
    const subscribeToStore = store.subscribe;
    const released = mock(() => {});
    const subscribe = spyOn(store, "subscribe").mockImplementation((rowScope, onChange) => {
      const release = subscribeToStore(rowScope, onChange);
      return () => {
        released();
        release();
      };
    });
    const onRows = mock<(rows: Row[]) => void>();
    const skip = createLiveRows({ ...scope, uid: undefined, onRows });
    const live = createLiveRows({ ...scope, onRows });
    try {
      await advanceTimers(0);
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(subscribe).toHaveBeenCalledWith(scope, expect.any(Function));
      expect(onRows).toHaveBeenLastCalledWith([]);
      store.mutate(scope, { type: "insert", row: { id: "queued", [ownerColumn]: scope.uid } });
      live.stop();
      live.stop();
      await advanceTimers(150);
      expect(onRows).toHaveBeenCalledTimes(1);
      expect(released).toHaveBeenCalledTimes(1);
    } finally {
      live.stop();
      skip.stop();
      subscribe.mockRestore();
    }
  });

  test("rejects invalid fixture writes without invalidating the owner query", async () => {
    const transport = getOwnerRowTransport();
    if (!transport) throw new Error("Expected a browser fixture transport");
    const onRows = mock<(rows: Row[]) => void>();
    const live = createLiveRows({ ...scope, onRows });
    try {
      await advanceTimers(0);
      await expect(
        transport.mutate(scope, { type: "insert", row: { id: "foreign", [ownerColumn]: "other" } })
      ).rejects.toThrow("Cannot change owner row identity");
      await expect(
        transport.mutate(scope, { type: "update", id: "missing", patch: { archived: true } })
      ).rejects.toThrow("Fixture row not found");
      await advanceTimers(150);
      expect(onRows).toHaveBeenCalledTimes(1);
      expect(onRows).toHaveBeenLastCalledWith([]);
    } finally {
      live.stop();
    }
  });

  test("does not fall back to an SDK client on the server in gated E2E mode", () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
    const { client } = makeClient();
    const getClient = mock(() => client);
    const getTransport = makeOwnerRowTransportGetter(getClient);
    expect(getTransport()).toBeNull();
    expect(getTransport(client)).toBeNull();
    expect(getClient).not.toHaveBeenCalled();
  });

  test("uses the SDK outside the gate and scopes writes to the owner", async () => {
    setEnv("NODE_ENV", "production");
    const { client, insert, update, writeFilter, returnColumns, single } = makeClient();
    const getClient = mock(() => client);
    const transport = makeOwnerRowTransportGetter(getClient)();
    if (!transport) throw new Error("Expected the SDK transport");
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(await transport.mutate(scope, { type: "insert", row: { archived: false } })).toBe(
      "written"
    );
    expect(insert).toHaveBeenCalledWith({ archived: false, [ownerColumn]: scope.uid });
    const error = new Error("SDK write failed");
    single.mockResolvedValueOnce({ data: null, error });
    await expect(
      transport.mutate(scope, { type: "update", id: "written", patch: { archived: true } })
    ).rejects.toBe(error);
    expect(update).toHaveBeenCalledWith({ archived: true });
    expect(writeFilter).toHaveBeenCalledWith("id", "written");
    expect(writeFilter).toHaveBeenCalledWith("user_id", scope.uid);
    expect(returnColumns).toHaveBeenCalledWith("id");
  });
});
