"use client";

import type { InsForgeClient, SocketMessage } from "@insforge/sdk";
import { useEffect, useMemo, useState } from "react";
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
};

const changeEvents = ["INSERT", "UPDATE"] as const;
const channelsByRealtime = new WeakMap<
  Realtime,
  Map<string, { users: number; ready: Promise<void> }>
>();

function acquireChannel(realtime: Realtime, channel: string) {
  let channels = channelsByRealtime.get(realtime);
  if (!channels) {
    channels = new Map();
    channelsByRealtime.set(realtime, channels);
  }

  let subscription = channels.get(channel);
  if (!subscription) {
    subscription = {
      users: 0,
      ready: realtime.connect().then(async () => {
        if (channels.get(channel) === subscription) await realtime.subscribe(channel);
      }),
    };
    channels.set(channel, subscription);
  }
  subscription.users += 1;
  return {
    ready: subscription.ready,
    release() {
      subscription.users -= 1;
      if (subscription.users > 0) return;
      channels.delete(channel);
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
}: LiveRowsOptions & { onRows: (rows: Row[]) => void }) {
  if (!client || !uid) return { stop() {} };

  // Narrow the SDK's recursive PostgREST builder to the methods this reader uses.
  const { database, realtime } = client as unknown as LiveRowsClient;
  const channel = `${table}:${uid}`;
  let stopped = false;
  let request = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function fetchRows() {
    if (stopped) return;
    const currentRequest = ++request;
    try {
      let query = database.from(table).select(select);
      for (const [column, value] of filters) query = query.eq(column, value);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      const { data, error } = await query;
      if (!stopped && currentRequest === request && !error && Array.isArray(data)) {
        onRows(data as Row[]);
      }
    } catch {
      // Preserve the last successful snapshot on a failed read.
    }
  }

  function onChange(message: SocketMessage) {
    if (stopped || message.meta?.channel !== channel) return;
    clearTimeout(timer);
    timer = setTimeout(() => void fetchRows(), debounceMs);
  }

  for (const event of changeEvents) realtime.on(event, onChange);
  const subscription = acquireChannel(realtime, channel);
  // Take the first snapshot after joining so a write cannot fall between the snapshot and subscription.
  void subscription.ready.then(fetchRows, fetchRows);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
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

  useEffect(() => {
    const liveRows = createLiveRows<Row>({
      ...options,
      onRows: (rows) => setSnapshot({ options, rows }),
    });
    return liveRows.stop;
  }, [options]);

  return snapshot?.options === options ? snapshot.rows : undefined;
}
