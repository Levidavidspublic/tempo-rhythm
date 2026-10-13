"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

type CoachPage = { pageId: string | null; setPageId: (update: (current: string | null) => string | null) => void };

const CoachPageContext = createContext<CoachPage | null>(null);

/** Holds the page on screen (a note, Today's page, a weekly page) so the coach beside it can read it. */
export function CoachPageProvider({ children }: { children: ReactNode }) {
  const [pageId, setPageId] = useState<string | null>(null);
  const value = useMemo(() => ({ pageId, setPageId }), [pageId]);
  return <CoachPageContext.Provider value={value}>{children}</CoachPageContext.Provider>;
}

/** The open page's id, or null when no page is on screen (or outside the shell). */
export function useCoachPageId(): string | null {
  return useContext(CoachPageContext)?.pageId ?? null;
}

/** A page editor names its page while it is mounted; the coach panel sends that page as context. */
export function useRegisterCoachPage(pageId: string) {
  const setPageId = useContext(CoachPageContext)?.setPageId;
  useEffect(() => {
    if (!setPageId) return;
    setPageId(() => pageId);
    // Clear only our own id: the next page may have registered already.
    return () => setPageId((current) => (current === pageId ? null : current));
  }, [pageId, setPageId]);
}
