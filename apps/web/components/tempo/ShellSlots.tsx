"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";
import { createPortal } from "react-dom";

/** What a page can ask of the v3 shell: the coach panel, and a side column next to main. */
export type ShellSlots = {
  coachOpen: boolean;
  /** False on /coach itself, where the coach is the page. */
  coachAvailable: boolean;
  openCoach: () => void;
  closeCoach: () => void;
  asideHost: HTMLElement | null;
  /** Counts pages that render into the side column; the shell shows it while any do. */
  claimAside: () => () => void;
};

export const ShellSlotsContext = createContext<ShellSlots | null>(null);

export function useShellSlots(): ShellSlots | null {
  return useContext(ShellSlotsContext);
}

/**
 * Renders children in the shell's side column (beside main at 1280 px and up, below it under
 * that). Outside the shell it renders nothing.
 */
export function ShellAside({ children }: { children: ReactNode }) {
  const slots = useShellSlots();
  const claim = slots?.claimAside;
  useEffect(() => (claim ? claim() : undefined), [claim]);
  if (!slots?.asideHost) return null;
  return createPortal(children, slots.asideHost);
}
