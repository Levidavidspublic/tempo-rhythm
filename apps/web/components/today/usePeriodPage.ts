"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import { type PeriodKind, periodPageDraft } from "@/lib/period-pages";

/** Starter templates the dated pages are made from on first open (convex/lib/templateCatalog.ts). */
const TEMPLATE_FOR: Record<PeriodKind, string> = {
  daily: "starter:daily-page",
  weekly: "starter:weekly-page",
};

export type PeriodPageState =
  | { status: "signed-out" }
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; noteId: string };

/**
 * The daily page for a local date (or the weekly page for a Monday). Made from the template on
 * first open; `notes.ensurePeriodPage` is idempotent, so two tabs opening at once share one page.
 */
export function usePeriodPage(kind: PeriodKind, date: string | null): PeriodPageState {
  const { lang } = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth();
  // notes.* call requireUser: wait for the users row (getProfile is null until it exists).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const ready = isAuthenticated && profile != null && date !== null;
  const page = useQuery(api.notes.getPeriodPage, ready ? { pageType: kind, date } : "skip");
  const template = useQuery(api.templates.get, ready && page === null ? { templateId: TEMPLATE_FOR[kind] } : "skip");
  const ensure = useMutation(api.notes.ensurePeriodPage);
  const asked = useRef<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${kind}:${date}`;

  useEffect(() => {
    if (!ready || page !== null || template === undefined || asked.current === key) return;
    asked.current = key;
    const draft = periodPageDraft(kind, date, template?.body ?? "", lang);
    ensure({ pageType: kind, date, title: draft.title, body: draft.body }).catch(() => setFailed(key));
  }, [ready, page, template, key, kind, date, lang, ensure]);

  if (!isLoading && !isAuthenticated) return { status: "signed-out" };
  if (failed === key) {
    return {
      status: "error",
      retry: () => {
        asked.current = null;
        setFailed(null);
      },
    };
  }
  if (page) return { status: "ready", noteId: page._id };
  return { status: "loading" };
}
