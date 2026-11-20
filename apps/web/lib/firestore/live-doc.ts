export type LiveDoc<T> =
  | { state: "loading" }
  | { state: "missing"; doc: T | null }
  | { state: "ready"; id: string; doc: T; pendingWrite: boolean; fromCache: boolean };

export type LiveDocSnapshot = {
  id: string;
  exists: boolean;
  data: unknown;
  pendingWrite?: boolean;
  fromCache?: boolean;
};

export type LiveDocOptions<T extends object> = {
  defaults?: T;
  check?: (data: T) => unknown;
};

export function loadingLiveDoc<T>(): LiveDoc<T> {
  return { state: "loading" };
}

function copyDefaults<T extends object>(defaults: T | undefined): T | null {
  return defaults === undefined ? null : ({ ...defaults } as T);
}

function isPlainObject(value: unknown): value is object {
  if (value === null || typeof value !== "object") return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function applyLiveSnapshot<T extends object>(
  snapshot: LiveDocSnapshot,
  options: LiveDocOptions<T> = {}
): LiveDoc<T> {
  if (snapshot.id.trim().length === 0) {
    throw new TypeError("Live document id must not be blank");
  }

  const missing = (): LiveDoc<T> => ({ state: "missing", doc: copyDefaults(options.defaults) });

  if (!snapshot.exists) return missing();
  if (!isPlainObject(snapshot.data)) {
    throw new TypeError("An existing live document must contain a plain object");
  }

  const data = snapshot.data as T & { deletedAt?: unknown };
  if (typeof data.deletedAt === "number") return missing();

  try {
    options.check?.(data);
  } catch {
    return missing();
  }

  return {
    state: "ready",
    id: snapshot.id,
    doc: data,
    pendingWrite: snapshot.pendingWrite ?? false,
    fromCache: snapshot.fromCache ?? false,
  };
}
