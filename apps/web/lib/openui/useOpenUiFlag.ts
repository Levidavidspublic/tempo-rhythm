"use client";

import { useSyncExternalStore } from "react";
import { choiceToStore, OPENUI_FLAG_PARAM, OPENUI_STORAGE_KEY, openUiDefault, resolveOpenUi } from "./coach-flag";

function readStored(): string | null {
  try {
    return localStorage.getItem(OPENUI_STORAGE_KEY);
  } catch {
    return null;
  }
}

function read(): boolean {
  const param = new URLSearchParams(window.location.search).get(OPENUI_FLAG_PARAM);
  return resolveOpenUi(param, readStored(), openUiDefault(process.env.NEXT_PUBLIC_VERCEL_ENV, window.location.hostname));
}

function subscribe(onChange: () => void): () => void {
  // Keep a `?openui=on|off` choice for the next visit on this device.
  const choice = choiceToStore(new URLSearchParams(window.location.search).get(OPENUI_FLAG_PARAM));
  if (choice) {
    try {
      localStorage.setItem(OPENUI_STORAGE_KEY, choice);
    } catch {
      /* storage unavailable: the URL still decides this visit */
    }
  }
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Whether coach cards render through OpenUI (lib/openui/coach-flag.ts). The server render and
 * hydration use the direct cards; coach cards only appear once Convex data arrives in the browser.
 */
export function useOpenUiFlag(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
