"use client";

import { usePathname } from "next/navigation";
import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { makeInsforgeSessionSource } from "./client";

/**
 * InsForge sign-in session verified against the server's SSR cookies.
 * The provider holds only the session status and user identity.
 */
export type InsforgeSession =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; uid: string; email: string };

type CurrentUserResult = {
  data: { user: { id?: string | null; email?: string | null } | null } | null;
  error: unknown;
};

export type InsforgeSessionAuth = {
  getCurrentUser(): Promise<CurrentUserResult>;
  subscribe(listener: () => void): () => void;
};

export type InsforgeSessionStore = {
  getSnapshot(): InsforgeSession;
  subscribe(listener: () => void): () => void;
  refetch(): void;
  start(): void;
  stop(): void;
};

const LOADING: InsforgeSession = { status: "loading" };
const SIGNED_OUT: InsforgeSession = { status: "signedOut" };

/** Maps one `getCurrentUser()` answer to a session. An error or a user without an id is signed out. */
export function sessionFromCurrentUser(result: CurrentUserResult): InsforgeSession {
  if (result.error) return SIGNED_OUT;
  const user = result.data?.user;
  const uid = user?.id?.trim();
  if (!uid) return SIGNED_OUT;
  return { status: "signedIn", uid, email: user?.email?.trim() ?? "" };
}

function sameSession(a: InsforgeSession, b: InsforgeSession): boolean {
  if (a.status !== b.status) return false;
  if (a.status === "signedIn" && b.status === "signedIn") {
    return a.uid === b.uid && a.email === b.email;
  }
  return true;
}

/**
 * React-free session store. Starts `loading`. `start()` reads the current user once and re-reads
 * it on invalidation. Only the newest read publishes. `null` auth (client not configured) is
 * signed out. A failed lookup is signed out too, but is also passed to `onError` so an auth outage
 * can be told apart from a signed-out user. `stop()` unsubscribes and ignores answers that arrive
 * later.
 */
export function createInsforgeSessionStore(
  auth: InsforgeSessionAuth | null,
  onError?: (error: unknown) => void
): InsforgeSessionStore {
  let snapshot: InsforgeSession = auth ? LOADING : SIGNED_OUT;
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | null = null;
  let generation = 0;
  let readSequence = 0;

  const set = (next: InsforgeSession) => {
    if (sameSession(snapshot, next)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const read = async (readGeneration: number) => {
    if (!auth) return;
    const sequence = ++readSequence;
    let next: InsforgeSession;
    let failure: unknown;
    try {
      const result = await auth.getCurrentUser();
      if (result.error) failure = result.error;
      next = sessionFromCurrentUser(result);
    } catch (error) {
      failure = error;
      next = SIGNED_OUT;
    }
    if (readGeneration !== generation || sequence !== readSequence) return;
    set(next);
    if (failure === undefined) return;
    try {
      onError?.(failure);
    } catch {
      // A failing diagnostic must never change or block the session.
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refetch() {
      if (unsubscribe) void read(generation);
    },
    start() {
      if (!auth || unsubscribe) return;
      generation += 1;
      const startGeneration = generation;
      unsubscribe = auth.subscribe(() => {
        void read(startGeneration);
      });
      void read(startGeneration);
    },
    stop() {
      generation += 1;
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

const SessionStoreContext = createContext<InsforgeSessionStore | null>(null);

type InsforgeSessionProviderProps = {
  children: React.ReactNode;
  /** Called when a session lookup fails. Defaults to a short console warning. */
  onError?: (error: unknown) => void;
};

function warnLookupFailed(error: unknown) {
  // Name only: never the message, which could carry an email or a token.
  const name = error instanceof Error ? error.name : typeof error;
  // biome-ignore lint/suspicious/noConsole: the only place a failed session lookup is reported
  console.warn(`[insforge-session] session lookup failed (${name})`);
}

/** Provides the InsForge session to its children. Signed out when the InsForge env names are unset. */
export function InsforgeSessionProvider({
  children,
  onError = warnLookupFailed,
}: InsforgeSessionProviderProps) {
  // The store lives for the provider's lifetime, so it calls the latest onError through a ref.
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  const [store] = useState(() =>
    createInsforgeSessionStore(makeInsforgeSessionSource(), (error) => onErrorRef.current(error))
  );
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    store.refetch();
  }, [pathname, store]);
  return <SessionStoreContext.Provider value={store}>{children}</SessionStoreContext.Provider>;
}

const getSignedOut = () => SIGNED_OUT;
const subscribeNever = () => () => {};

/** The InsForge session. Outside `InsforgeSessionProvider` it is signed out. */
export function useInsforgeSession(): InsforgeSession {
  const store = useContext(SessionStoreContext);
  return useSyncExternalStore(
    store ? store.subscribe : subscribeNever,
    store ? store.getSnapshot : getSignedOut,
    store ? store.getSnapshot : getSignedOut
  );
}
