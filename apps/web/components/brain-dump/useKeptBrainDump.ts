"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type BrainDumpSession, clearBrainDumpSession, loadBrainDumpSession, saveBrainDumpSession, tabSessionStore } from "@/lib/brain-dump-session";

/** Typing is kept after this pause; a new plan, a choice or a saved page is kept at once. */
const KEEP_TYPING_MS = 400;
const FLUSH_EVENT = "tempo:brain-dump-flush";
const HANDOFF_EVENT = "tempo:brain-dump-handoff";

/** Capture the visible draft before asking whether a different draft may replace it. */
export function flushBrainDumpWrites() { window.dispatchEvent(new Event(FLUSH_EVENT)); }
/** The new saved draft owns this tab; older producers must not flush during navigation. */
export function handoffBrainDumpWrites() { window.dispatchEvent(new Event(HANDOFF_EVENT)); }

/**
 * Keeps this tab's dump, sorted plan and choices (lib/brain-dump-session.ts). The kept copy is read
 * in a layout effect: after hydration, so the server's HTML still matches, and before the first
 * paint, so the form doesn't flash empty. Leaving the screen or the page during the typing pause
 * still keeps the last change.
 */
export function useKeptBrainDump(session: BrainDumpSession, restore: (kept: BrainDumpSession) => void, enabled = true, version = 0) {
  const { draft, plan, accepted, rejected, savedPageId } = session;
  const [ready, setReady] = useState(false);
  const last = useRef<BrainDumpSession | null>(null);
  const pending = useRef<BrainDumpSession | null>(null);
  const relinquished = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version explicitly reloads a handoff on the same route.
  useLayoutEffect(() => {
    if (!enabled) return;
    relinquished.current = false;
    const flush = () => { if (!relinquished.current) keepPending(pending); };
    const handoff = () => { pending.current = null; relinquished.current = true; };
    window.addEventListener(FLUSH_EVENT, flush);
    window.addEventListener(HANDOFF_EVENT, handoff);
    pending.current = null;
    const kept = loadBrainDumpSession(tabSessionStore(), Date.now());
    if (kept) restore(kept);
    last.current = kept;
    setReady(true);
    return () => {
      window.removeEventListener(FLUSH_EVENT, flush);
      window.removeEventListener(HANDOFF_EVENT, handoff);
    };
  }, [restore, enabled, version]);

  useEffect(() => {
    if (!ready || !enabled || relinquished.current) return;
    const prev = last.current;
    const next = { draft, plan, accepted, rejected, savedPageId };
    last.current = next;
    const sameChoices =
      prev !== null &&
      prev.plan === plan &&
      prev.accepted === accepted &&
      prev.rejected === rejected &&
      prev.savedPageId === savedPageId;
    // Just read back: nothing new to keep, and the 2-hour expiry doesn't restart.
    if (sameChoices && prev.draft === draft) return;
    pending.current = next;
    if (!sameChoices) {
      keepPending(pending);
      return;
    }
    const timer = window.setTimeout(() => keepPending(pending), KEEP_TYPING_MS);
    return () => window.clearTimeout(timer);
  }, [ready, enabled, draft, plan, accepted, rejected, savedPageId]);

  useEffect(() => {
    const flush = () => keepPending(pending);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const clear = useCallback(() => { pending.current = null; clearBrainDumpSession(tabSessionStore()); }, []);
  return { clear };
}

function keepPending(pending: { current: BrainDumpSession | null }) {
  if (pending.current) saveBrainDumpSession(tabSessionStore(), pending.current, Date.now());
  pending.current = null;
}
