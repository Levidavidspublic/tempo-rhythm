import { useSyncExternalStore } from "react";

/**
 * After users.deleteMyAccount succeeds, users.getProfile turns null and SettingsScreen's
 * ProfileReady gate unmounts the screen body, DeleteAccountCard included. The sign-out that
 * follows lives here instead, so its failure (and the retry) survive that unmount.
 */
export type DeletedAccountState = "none" | "signingOut" | "signOutFailed";

let state: DeletedAccountState = "none";
const listeners = new Set<() => void>();

function setState(next: DeletedAccountState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDeletedAccountState(): DeletedAccountState {
  return state;
}

export function useDeletedAccountState(): DeletedAccountState {
  return useSyncExternalStore(subscribe, readDeletedAccountState, () => "none");
}

/** Call once the deletion went through: signs out, then `leave()` (go to /sign-in). */
export async function signOutDeletedAccount(signOut: () => Promise<void>, leave: () => void): Promise<void> {
  setState("signingOut");
  try {
    await signOut();
  } catch {
    setState("signOutFailed");
    return;
  }
  leave();
  setState("none");
}
