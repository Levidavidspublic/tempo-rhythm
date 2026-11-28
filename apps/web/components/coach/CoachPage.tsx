"use client";

import { createContext, type MutableRefObject, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

type Flush = () => Promise<void>;

type CoachPage = {
  pageId: string | null;
  setPageId: (update: (current: string | null) => string | null) => void;
  /** Saves the open page's pending edits now, so the coach reads what is on screen. */
  flushRef: MutableRefObject<Flush | null>;
};

const CoachPageContext = createContext<CoachPage | null>(null);

/** Holds the page on screen (a note, Today's page, a weekly page) so the coach beside it can read it. */
export function CoachPageProvider({ children }: { children: ReactNode }) {
  const [pageId, setPageId] = useState<string | null>(null);
  const flushRef = useRef<Flush | null>(null);
  const value = useMemo(() => ({ pageId, setPageId, flushRef }), [pageId]);
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

/** The page's editor hands the coach a way to save its pending (debounced) edits right away. */
export function useRegisterCoachPageFlush(flush: Flush) {
  const flushRef = useContext(CoachPageContext)?.flushRef;
  const latest = useRef(flush);
  latest.current = flush;
  useEffect(() => {
    if (!flushRef) return;
    const mine: Flush = () => latest.current();
    flushRef.current = mine;
    return () => {
      if (flushRef.current === mine) flushRef.current = null;
    };
  }, [flushRef]);
}

/** Saves the open page's pending edits before the coach reads it; a no-op when nothing waits. */
export function useFlushCoachPage(): Flush {
  const flushRef = useContext(CoachPageContext)?.flushRef;
  return async () => {
    await flushRef?.current?.();
  };
}
