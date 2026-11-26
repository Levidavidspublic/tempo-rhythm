"use client";

import type { InsForgeClient, SocketMessage } from "@insforge/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import getInsforgeClient from "./client";

type Filter = readonly [column: string, value: string | number | boolean];
type Order = { column: string; ascending?: boolean };

type LiveQuery = PromiseLike<{ data: unknown; error: unknown }> & {
  eq(column: string, value: Filter[1]): LiveQuery;
  order(column: string, options: { ascending?: boolean }): LiveQuery;
};

type Realtime = Pick<
  InsForgeClient["realtime"],
  "connect" | "subscribe" | "unsubscribe" | "on" | "off"
>;

type LiveRowsClient = {
  database: { from(table: string): { select(columns: string): LiveQuery } };
  realtime: Realtime;
};

type LiveRowsOptions = {
  client?: InsForgeClient | LiveRowsClient | null;
  table: string;
  uid: string | null | undefined;
  select?: string;
  filters?: readonly Filter[];
  order?: Order;
  debounceMs?: number;
  /** Called when a read fails. The last successful rows stay; a failed first read is retried. */
  onError?: (error: unknown) => void;
};

const changeEvents = ["INSERT", "UPDATE"] as const;
// Bounded retry for a failed join or a failed first read: 0.5 s, 1 s, 2 s, 4 s, 8 s, then give up.
const maxRetries = 5;
const retryDelay = (attempt: number) => Math.min(500 * 2 ** attempt, 8000);

type ChannelEntry = {
  users: number;
  ready: Promise<void>;
  joined: boolean;
  onJoin: Set<() => void>;
  retry?: ReturnType<typeof setTimeout>;
  onConnect?: () => void;
};

const channelsByRealtime = new WeakMap<Realtime, Map<string, ChannelEntry>>();

async function join(realtime: Realtime, channel: string) {
  await realtime.connect();
  const response = await realtime.subscribe(channel);
  if (!response.ok) throw new Error(response.error?.message ?? "Subscription rejected");
}

function acquireChannel(realtime: Realtime, channel: string, onJoin: () => void) {
  let channels = channelsByRealtime.get(realtime);
  if (!channels) {
    channels = new Map();
    channelsByRealtime.set(realtime, channels);
  }
  const map = channels;

  let entry = map.get(channel);
  if (!entry) {
    const created: ChannelEntry = {
      users: 0,
      ready: Promise.resolve(),
      joined: false,
      onJoin: new Set(),
    };
    const current = () => map.get(channel) === created;
    const joined = () => {
      created.joined = true;
      for (const listener of created.onJoin) listener();
    };
    const attempt = (count: number): Promise<void> =>
      join(realtime, channel).then(
        () => {
          if (current()) joined();
        },
        (error: unknown) => {
          // Retry a failed connect or a rejected subscribe while lists still use the channel.
          if (current() && count < maxRetries) {
            created.retry = setTimeout(
              () => void attempt(count + 1).catch(() => {}),
              retryDelay(count)
            );
          }
          throw error;
        }
      );
    created.ready = attempt(0);
    created.ready.catch(() => {});
    // The SDK rejoins channels itself after a reconnect but emits no event for the acknowledgement.
    // subscribe() returns that pending rejoin, so refetch only once the server has confirmed it.
    created.onConnect = () => {
      if (!current() || !created.joined) return;
      void realtime.subscribe(channel).then(
        (response) => {
          if (response.ok && current()) joined();
        },
        () => {}
      );
    };
    realtime.on("connect", created.onConnect);
    map.set(channel, created);
    entry = created;
  }
  const subscription = entry;
  subscription.users += 1;
  subscription.onJoin.add(onJoin);
  return {
    ready: subscription.ready,
    release() {
      subscription.onJoin.delete(onJoin);
      subscription.users -= 1;
      if (subscription.users > 0) return;
      map.delete(channel);
      clearTimeout(subscription.retry);
      if (subscription.onConnect) realtime.off("connect", subscription.onConnect);
      realtime.unsubscribe(channel);
    },
  };
}

export function createLiveRows<Row>({
  client,
  table,
  uid,
  select = "*",
  filters = [],
  order,
  debounceMs = 150,
  onRows,
  onError,
}: LiveRowsOptions & { onRows: (rows: Row[]) => void }) {
  if (!client || !uid) return { stop() {} };

  // Narrow the SDK's recursive PostgREST builder to the methods this reader uses.
  const { database, realtime } = client as unknown as LiveRowsClient;
  const channel = `${table}:${uid}`;
  let stopped = false;
  let request = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let loaded = false;
  let failedReads = 0;

  function failed(currentRequest: number, error: unknown) {
    if (stopped || currentRequest !== request) return;
    // Keep the last successful rows, but never let a failure look like loading.
    onError?.(error);
    if (!loaded && failedReads < maxRetries) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void fetchRows(), retryDelay(failedReads));
      failedReads += 1;
    }
  }

  async function fetchRows() {
    if (stopped) return;
    const currentRequest = ++request;
    try {
      let query = database.from(table).select(select);
      for (const [column, value] of filters) query = query.eq(column, value);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      const { data, error } = await query;
      if (stopped || currentRequest !== request) return;
      if (error || !Array.isArray(data)) {
        failed(currentRequest, error ?? new Error("Unexpected read result"));
        return;
      }
      loaded = true;
      clearTimeout(retryTimer);
      onRows(data as Row[]);
    } catch (error) {
      failed(currentRequest, error);
    }
  }

  function onChange(message: SocketMessage) {
    if (stopped || message.meta?.channel !== channel) return;
    clearTimeout(timer);
    timer = setTimeout(() => void fetchRows(), debounceMs);
  }

  for (const event of changeEvents) realtime.on(event, onChange);
  let first = true;
  // Refetch after every later join (a retried join or a confirmed rejoin) to catch missed writes.
  const subscription = acquireChannel(realtime, channel, () => {
    if (!first) void fetchRows();
  });
  // Take the first snapshot after joining so a write cannot fall between the snapshot and subscription.
  void subscription.ready.then(fetchRows, fetchRows).finally(() => {
    first = false;
  });

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      for (const event of changeEvents) realtime.off(event, onChange);
      subscription.release();
    },
  };
}

export function useLiveRows<Row>({
  client = getInsforgeClient(),
  table,
  uid,
  select,
  filters = [],
  order,
  debounceMs,
  onError,
}: LiveRowsOptions): Row[] | undefined {
  const filterKey = JSON.stringify(filters);
  const orderColumn = order?.column;
  const ascending = order?.ascending;
  const options = useMemo<LiveRowsOptions>(
    () => ({
      client,
      table,
      uid,
      select,
      filters: JSON.parse(filterKey) as Filter[],
      order: orderColumn === undefined ? undefined : { column: orderColumn, ascending },
      debounceMs,
    }),
    [client, table, uid, select, filterKey, orderColumn, ascending, debounceMs]
  );
  const [snapshot, setSnapshot] = useState<{ options: LiveRowsOptions; rows: Row[] }>();
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const liveRows = createLiveRows<Row>({
      ...options,
      onRows: (rows) => setSnapshot({ options, rows }),
      onError: (error) => onErrorRef.current?.(error),
    });
    return liveRows.stop;
  }, [options]);

  return snapshot?.options === options ? snapshot.rows : undefined;
}
