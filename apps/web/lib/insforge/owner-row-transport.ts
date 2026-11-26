import type { InsForgeClient, SocketMessage } from "@insforge/sdk";
import getInsforgeClient from "./client";
import { isInsforgeE2eMode } from "./e2e-mode";
import { getE2eRowStore } from "./e2e-row-store";

export type Filter = readonly [column: string, value: string | number | boolean];
export type Order = { column: string; ascending?: boolean };

type LiveQuery = PromiseLike<{ data: unknown; error: unknown }> & {
  eq(column: string, value: Filter[1]): LiveQuery;
  order(column: string, options: { ascending?: boolean }): LiveQuery;
};

type MutationQuery = {
  eq(column: string, value: string): MutationQuery;
  select(columns: string): {
    single(): PromiseLike<{ data: { id?: unknown } | null; error: unknown }>;
  };
};

type Realtime = Pick<
  InsForgeClient["realtime"],
  "connect" | "subscribe" | "unsubscribe" | "on" | "off"
>;

export type OwnerRowClient = {
  database: {
    from(table: string): {
      select(columns: string): LiveQuery;
      insert(row: Columns): MutationQuery;
      update(patch: Columns): MutationQuery;
    };
  };
  realtime: Realtime;
};

type Scope = { table: string; uid: string };
type Query = { select: string; filters: readonly Filter[]; order?: Order };
type Columns = Record<string, unknown>;
type Mutation =
  | { type: "insert"; row: Columns & { id?: string } }
  | { type: "update"; id: string; patch: Columns };
type Subscription = { ready: Promise<void>; release: () => void };

type OwnerRowTransport = {
  select: (scope: Scope, query: Query) => Promise<unknown>;
  subscribe: (scope: Scope, onChange: () => void, onJoin: () => void) => Subscription;
  mutate: (scope: Scope, mutation: Mutation) => Promise<string>;
};

const ownerColumn = "user_id";

function assertMutationIdentity(uid: string, mutation: Mutation) {
  const fields = mutation.type === "insert" ? mutation.row : mutation.patch;
  if (
    (ownerColumn in fields && fields[ownerColumn] !== uid) ||
    (mutation.type === "update" && "id" in fields && fields.id !== mutation.id)
  ) {
    throw new Error("Cannot change owner row identity");
  }
}

const changeEvents = ["INSERT", "UPDATE"] as const;
// Bounded retry for a failed join or a failed first read: 0.5 s, 1 s, 2 s, 4 s, 8 s, then give up.
export const maxRetries = 5;
export const retryDelay = (attempt: number) => Math.min(500 * 2 ** attempt, 8000);

type ChannelEntry = {
  users: number;
  ready: Promise<void>;
  joined: boolean;
  onJoin: Set<() => void>;
  retry?: ReturnType<typeof setTimeout>;
  onConnect?: () => void;
};

const channelsByRealtime = new WeakMap<Realtime, Map<string, ChannelEntry>>();

async function join(realtime: Realtime, channel: string, isActive: () => boolean) {
  await realtime.connect();
  // The last list may have stopped while connecting: never subscribe a channel nobody uses.
  if (!isActive()) throw new Error("Channel released");
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
      join(realtime, channel, current).then(
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

function createFixtureTransport(
  store: NonNullable<ReturnType<typeof getE2eRowStore>>
): OwnerRowTransport {
  return {
    async select(scope, { select, filters, order }) {
      const rows = store.select(scope, { filters, order });
      if (select === "*") return rows;
      const columns = select.split(",").map((column) => column.trim());
      if (columns.some((column) => !/^\w+$/.test(column))) {
        throw new Error("Fixture reads support only flat column selections");
      }
      return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column]])));
    },
    subscribe(scope, onChange) {
      return { ready: Promise.resolve(), release: store.subscribe(scope, onChange) };
    },
    async mutate(scope, mutation) {
      assertMutationIdentity(scope.uid, mutation);
      if (mutation.type === "update") {
        store.mutate(scope, mutation);
        return mutation.id;
      }
      const id = mutation.row.id ?? crypto.randomUUID();
      store.mutate(scope, {
        type: "insert",
        row: { ...mutation.row, id, [ownerColumn]: scope.uid },
      });
      return id;
    },
  };
}

function createSdkTransport({ database, realtime }: OwnerRowClient): OwnerRowTransport {
  return {
    async select({ table, uid }, { select, filters, order }) {
      let query = database.from(table).select(select).eq(ownerColumn, uid);
      for (const [column, value] of filters) query = query.eq(column, value);
      if (order) query = query.order(order.column, { ascending: order.ascending });
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    subscribe({ table, uid }, onChange, onJoin) {
      const channel = `${table}:${uid}`;
      const handleChange = (message: SocketMessage) => {
        if (message.meta?.channel === channel) onChange();
      };
      for (const event of changeEvents) realtime.on(event, handleChange);
      const subscription = acquireChannel(realtime, channel, onJoin);
      return {
        ready: subscription.ready,
        release() {
          for (const event of changeEvents) realtime.off(event, handleChange);
          subscription.release();
        },
      };
    },
    async mutate({ table, uid }, mutation) {
      assertMutationIdentity(uid, mutation);
      const builder = database.from(table);
      const query =
        mutation.type === "insert"
          ? builder.insert({ ...mutation.row, [ownerColumn]: uid })
          : builder.update(mutation.patch).eq("id", mutation.id).eq(ownerColumn, uid);
      const { data, error } = await query.select("id").single();
      if (error) throw error;
      if (typeof data?.id !== "string") throw new Error("Owner row write returned no ID");
      return data.id;
    },
  };
}

export function makeOwnerRowTransportGetter(
  getClient: () => InsForgeClient | OwnerRowClient | null = getInsforgeClient
) {
  return (client?: InsForgeClient | OwnerRowClient | null): OwnerRowTransport | null => {
    if (isInsforgeE2eMode()) {
      const store = getE2eRowStore();
      return store ? createFixtureTransport(store) : null;
    }
    const sdkClient = client === undefined ? getClient() : client;
    return sdkClient ? createSdkTransport(sdkClient as unknown as OwnerRowClient) : null;
  };
}

export const getOwnerRowTransport = makeOwnerRowTransportGetter();
