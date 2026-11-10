import { useEffect, useRef } from "react";

/**
 * What this tab keeps of the signed-in person's work, in sessionStorage only: the /brain-dump
 * dump and sorted plan (`tempo:brain-dump:session`), the pages it saved
 * (`tempo:brain-dump:saved-pages:v1`) and the task draft (`tempo:tasks:draft`). None of it is
 * tied to an account, so when this tab's session goes from signed in to signed out it is all
 * cleared, and the next person to sign in here starts empty. localStorage is never touched.
 *
 * components/providers/providers.tsx runs the watcher below inside the Convex auth provider.
 */

/** Every sessionStorage key that starts with one of these is cleared on sign-out. */
export const TAB_STATE_PREFIXES: readonly string[] = ["tempo:brain-dump:", "tempo:tasks:"];

/** The part of `Storage` clearing needs, so tests can pass a fake. */
export type TabStateStore = Pick<Storage, "length" | "key" | "removeItem">;

/** `useConvexAuth()`'s answer. */
export type AuthSnapshot = { isLoading: boolean; isAuthenticated: boolean };

/** This tab's sessionStorage, or null where there is none or it is blocked. */
export function tabStateStore(): TabStateStore | null {
  try {
    return typeof window === "undefined" ? null : (window.sessionStorage ?? null);
  } catch {
    return null;
  }
}

export function isTabStateKey(key: string): boolean {
  return TAB_STATE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Remove every key that starts with a tab-state prefix; other keys stay. Storage that throws
 * is ignored: a key it won't remove stays and the rest still go. Returns how many went.
 */
export function clearTabState(store: TabStateStore | null): number {
  if (!store) return 0;
  let removed = 0;
  for (const key of tabStateKeys(store)) {
    try {
      store.removeItem(key);
      removed += 1;
    } catch {
      // This one stays; keep clearing the others.
    }
  }
  return removed;
}

/**
 * One step of the sign-out watcher. `wasSignedIn` is whether this page has seen a signed-in
 * session since it last cleared. Loading changes nothing: a session being checked or renewed
 * (signed in, loading, signed in) is not a sign-out, and a first load that ends signed out
 * never had anyone signed in. Signed out after signed in, with or without a loading step
 * between, clears once.
 */
export function tabAuthStep(
  wasSignedIn: boolean,
  auth: AuthSnapshot
): { wasSignedIn: boolean; clear: boolean } {
  if (auth.isLoading) return { wasSignedIn, clear: false };
  if (auth.isAuthenticated) return { wasSignedIn: true, clear: false };
  return { wasSignedIn: false, clear: wasSignedIn };
}

/**
 * The watcher: pass `useConvexAuth()`'s answer on every render. When the session goes from
 * signed in to signed out (any sign-out button, account deletion, an expired session), this
 * tab's kept work is cleared, once. Nothing on a first load, nor for a visitor who was never
 * signed in.
 */
export function useClearTabStateOnSignOut({ isLoading, isAuthenticated }: AuthSnapshot): void {
  const wasSignedIn = useRef(false);
  useEffect(() => {
    const step = tabAuthStep(wasSignedIn.current, { isLoading, isAuthenticated });
    wasSignedIn.current = step.wasSignedIn;
    if (step.clear) clearTabState(tabStateStore());
  }, [isLoading, isAuthenticated]);
}

/** List first, then remove: removing while walking `key(i)` would skip keys. */
function tabStateKeys(store: TabStateStore): string[] {
  const keys: string[] = [];
  try {
    const count = store.length;
    for (let index = 0; index < count; index += 1) {
      const key = store.key(index);
      if (key !== null && isTabStateKey(key)) keys.push(key);
    }
  } catch {
    // Storage stopped answering: clear what was listed before it did.
  }
  return keys;
}
