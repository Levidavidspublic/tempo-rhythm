"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import getInsforgeClient from "./client";

/**
 * InsForge sign-in session (TEMPO-IF-006, #1867).
 *
 * Today the app's session is Convex Auth (`useConvexAuth()` under `ConvexAuthNextjsProvider` in
 * `components/providers/providers.tsx`). This module is the InsForge counterpart: a provider and a
 * hook that report loading / signed out / signed in (uid + email) from the InsForge client's auth
 * state. Nothing mounts it yet; IF-007 does, only when the backend switch is `insforge`.
 * The SDK owns tokens; this module never reads or stores them.
 */
export type InsforgeSession =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; uid: string; email: string };

type CurrentUserResult = {
  data: { user: { id?: string | null; email?: string | null } | null } | null;
  error: unknown;
};

/** The two `@insforge/sdk` auth methods the session needs (`client.auth`). */
export type InsforgeSessionAuth = {
  getCurrentUser(): Promise<CurrentUserResult>;
  onAuthStateChange(callback: (event: string) => void): () => void;
};

export type InsforgeSessionStore = {
  getSnapshot(): InsforgeSession;
  subscribe(listener: () => void): () => void;
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
 * it on every auth event. `null` auth (client not configured) is signed out. `stop()`
 * unsubscribes and ignores answers that arrive later.
 */
export function createInsforgeSessionStore(auth: InsforgeSessionAuth | null): InsforgeSessionStore {
  let snapshot: InsforgeSession = auth ? LOADING : SIGNED_OUT;
  const listeners = new Set<() => void>();
  let unsubscribe: (() => void) | null = null;
  let generation = 0;

  const set = (next: InsforgeSession) => {
    if (sameSession(snapshot, next)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };

  const read = async (readGeneration: number) => {
    if (!auth) return;
    let next: InsforgeSession;
    try {
      next = sessionFromCurrentUser(await auth.getCurrentUser());
    } catch {
      next = SIGNED_OUT;
    }
    if (readGeneration === generation) set(next);
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      if (!auth || unsubscribe) return;
      generation += 1;
      const startGeneration = generation;
      unsubscribe = auth.onAuthStateChange(() => {
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
};

/** Provides the InsForge session to its children. Signed out when the InsForge env names are unset. */
export function InsforgeSessionProvider({ children }: InsforgeSessionProviderProps) {
  const [store] = useState(() => createInsforgeSessionStore(getInsforgeClient()?.auth ?? null));
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
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
