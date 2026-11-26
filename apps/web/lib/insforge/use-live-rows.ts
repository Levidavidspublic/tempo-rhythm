"use client";

import type { InsForgeClient } from "@insforge/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Filter,
  getOwnerRowTransport,
  maxRetries,
  type Order,
  type OwnerRowClient,
  retryDelay,
} from "./owner-row-transport";

type LiveRowsOptions = {
  client?: InsForgeClient | OwnerRowClient | null;
  table: string;
  uid: string | null | undefined;
  select?: string;
  filters?: readonly Filter[];
  order?: Order;
  debounceMs?: number;
  /** Called when a read fails. The last successful rows stay; a failed first read is retried. */
  onError?: (error: unknown) => void;
};

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
  if (!uid) return { stop() {} };
  const transport = getOwnerRowTransport(client);
  if (!transport) return { stop() {} };

  const { select: selectRows, subscribe } = transport;
  const scope = { table, uid };
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
      const data = await selectRows(scope, { select, filters, order });
      if (stopped || currentRequest !== request) return;
      if (!Array.isArray(data)) throw new Error("Unexpected read result");
      loaded = true;
      clearTimeout(retryTimer);
      onRows(data as Row[]);
    } catch (error) {
      failed(currentRequest, error);
    }
  }

  function onChange() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void fetchRows(), debounceMs);
  }

  let first = true;
  // Refetch after every later join (a retried join or a confirmed rejoin) to catch missed writes.
  const subscription = subscribe(scope, onChange, () => {
    if (!first) void fetchRows();
  });
  // Take the first snapshot after joining so a write cannot fall between the snapshot and subscription.
  const startFirstRead = () => {
    // Clear `first` when the first read starts, so a join that lands during it starts a newer read.
    first = false;
    return fetchRows();
  };
  void subscription.ready.then(startFirstRead, startFirstRead);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      subscription.release();
    },
  };
}

export function useLiveRows<Row>({
  client,
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
