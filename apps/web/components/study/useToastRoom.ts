"use client";

import { useEffect } from "react";

/**
 * An open Undo toast floats over the bottom of the screen (tempo.css .tp-toast-region), so Tab can
 * land on a control behind it (WCAG 2.4.11, focus not obscured). While a screen's toast is open,
 * useToastRoom marks <html> with data-tp-toast-room and puts the room the toast takes at the
 * bottom of the screen in --tp-toast-room. study.css turns that into scroll padding and, where the
 * page's own bottom padding is less, more of it, so the focused control, even the page's last one,
 * can always scroll up above the toast.
 */

export const TOAST_ROOM_VAR = "--tp-toast-room";
export const TOAST_ROOM_ATTR = "data-tp-toast-room";

/** One toast region as measured: its computed `bottom` and its height in px. */
export type ToastRegionBox = { bottom: string; height: number };

/**
 * The room the toasts take at the bottom of the screen, in whole px: the tallest region's height
 * plus its distance from the bottom edge. A region whose `bottom` can't be read counts its height
 * only. 0 when no toast is shown.
 */
export function toastRoom(regions: readonly ToastRegionBox[]): number {
  let room = 0;
  for (const region of regions) {
    if (!(region.height > 0)) continue;
    const bottom = Number.parseFloat(region.bottom);
    room = Math.max(room, region.height + (Number.isFinite(bottom) && bottom > 0 ? bottom : 0));
  }
  return Math.ceil(room);
}

// Screens can overlap (a set view inside the hub), so the mark goes only when the last one closes.
let openCount = 0;

function measure(): void {
  const regions = Array.from(document.querySelectorAll<HTMLElement>(".tp-toast-region"))
    .filter((region) => region.querySelector(".tp-toast"))
    // offsetHeight leaves out the toast's rise animation, which only moves it.
    .map((region) => ({ bottom: getComputedStyle(region).bottom, height: region.offsetHeight }));
  document.documentElement.style.setProperty(TOAST_ROOM_VAR, `${toastRoom(regions)}px`);
}

/**
 * Pass the open toast's state (or null when none is open). A new value, such as Undo's toast
 * giving way to Bring it back, measures the new toast.
 */
export function useToastRoom(open: unknown): void {
  useEffect(() => {
    if (!open) return;
    openCount += 1;
    document.documentElement.setAttribute(TOAST_ROOM_ATTR, "");
    measure();
    const regions = Array.from(document.querySelectorAll(".tp-toast-region"));
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    for (const region of regions) observer?.observe(region);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      openCount -= 1;
      if (openCount > 0) {
        measure();
        return;
      }
      document.documentElement.removeAttribute(TOAST_ROOM_ATTR);
      document.documentElement.style.removeProperty(TOAST_ROOM_VAR);
    };
  }, [open]);
}
