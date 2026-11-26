import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";
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
  const client = {
    database: { from: mock((_table: string) => ({ select })) },
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
});
