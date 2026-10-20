"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { type Kb75Lang, type Kb75Status, kb75Copy } from "@/lib/i18n-groups/kb-75";
import "@/app/v3/kb-75.css";

type Status = Kb75Status;
type Feedback = { kind: "pending" | "success" | "error"; status: Status };
type FocusIntent = {
  userId: string;
  status: Status;
  control: HTMLElement;
  moved: boolean;
  saved: boolean;
};

/** Count only the rows returned by the capped admin query. */
export function AdminStatusSummary({
  lang,
  state,
  pendingCount = 0,
  shownCount = 0,
}: {
  lang: Kb75Lang;
  state: "loading" | "empty" | "loaded";
  pendingCount?: number;
  shownCount?: number;
}) {
  const copy = kb75Copy[lang];
  return (
    <output className="kb75-summary" data-testid="approval-summary">
      {state === "loading"
        ? copy.loadingAccounts
        : state === "empty"
          ? copy.empty
          : copy.shownCount(pendingCount, shownCount)}
    </output>
  );
}

/** A safe, row-attributed message. Backend error text never enters this view. */
export function ApprovalRowFeedback({
  lang,
  email,
  feedback,
  onRetry,
  retryRef,
}: {
  lang: Kb75Lang;
  email: string;
  feedback: Feedback;
  onRetry?: () => void;
  retryRef?: (node: HTMLButtonElement | null) => void;
}) {
  const copy = kb75Copy[lang];
  const message =
    feedback.kind === "pending"
      ? copy.saving(feedback.status)
      : feedback.kind === "success"
        ? copy.saved(feedback.status)
        : copy.saveError(feedback.status);
  return (
    <div
      className="kb75-feedback"
      data-kind={feedback.kind}
      data-testid="approval-row-feedback"
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      <span>
        {message}{" "}
        <bdi dir="ltr" className="kb75-email">
          {email}
        </bdi>
        .
      </span>
      {feedback.kind === "error" && onRetry ? (
        <Button
          ref={retryRef}
          type="button"
          size="sm"
          variant="outline"
          className="kb75-action"
          onClick={onRetry}
        >
          {copy.retry}
        </Button>
      ) : null}
    </div>
  );
}

/** /admin/approvals — server authorization remains authoritative. */
export function AdminApprovals() {
  const { lang } = useLocale();
  const copy = kb75Copy[lang];
  const me = useQuery(api.approval.myStatus);
  const rows = useQuery(api.approval.listForAdmin, me?.isAdmin ? {} : "skip");
  const setStatus = useMutation(api.approval.setStatus);
  const [pending, setPending] = useState<Record<string, Status>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const inFlight = useRef(new Set<string>());
  const invalidated = useRef(new Set<string>());
  const sequence = useRef(new Map<string, number>());
  const latestRows = useRef(rows);
  const mounted = useRef(false);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const retryRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusIntent = useRef<FocusIntent | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    latestRows.current = rows;
    if (rows) {
      const visible = new Set<string>(rows.map((row) => row._id));
      for (const userId of inFlight.current) {
        if (!visible.has(userId)) invalidated.current.add(userId);
      }
      setFeedback((current) => {
        const removed = Object.keys(current).filter((userId) => !visible.has(userId));
        if (removed.length === 0) return current;
        const next = { ...current };
        for (const userId of removed) delete next[userId];
        return next;
      });
    }
    const intent = focusIntent.current;
    const settledFeedback = intent ? feedback[intent.userId] : undefined;
    if (!intent || !intent.saved || settledFeedback?.kind !== "success" || !rows) return;
    const row = rows.find((candidate) => candidate._id === intent.userId);
    if (!row) {
      focusIntent.current = null;
      return;
    }
    if (row.status !== intent.status) return;
    if (
      !intent.moved &&
      (document.activeElement === intent.control ||
        document.activeElement === document.body ||
        document.activeElement === document.documentElement)
    ) {
      rowRefs.current.get(intent.userId)?.focus({ preventScroll: true });
    }
    focusIntent.current = null;
  }, [rows, feedback]);

  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const intent = focusIntent.current;
      if (intent && event.target !== intent.control && event.target !== document.body) {
        intent.moved = true;
      }
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);

  async function change(userId: Id<"users">, status: Status, control: HTMLElement) {
    if (inFlight.current.has(userId)) return;
    // A fresh action supersedes any earlier row's keyboard recovery intent.
    focusIntent.current = null;
    inFlight.current.add(userId);
    invalidated.current.delete(userId);
    const request = (sequence.current.get(userId) ?? 0) + 1;
    sequence.current.set(userId, request);
    const submittedFrom = latestRows.current?.find((row) => row._id === userId)?.status;
    if (document.activeElement === control) {
      focusIntent.current = { userId, status, control, moved: false, saved: false };
    }
    setPending((current) => ({ ...current, [userId]: status }));
    setFeedback((current) => {
      const next = { ...current };
      delete next[userId];
      return next;
    });
    try {
      await setStatus({ userId, status });
      if (
        !mounted.current ||
        sequence.current.get(userId) !== request ||
        invalidated.current.has(userId)
      )
        return;
      const row = latestRows.current?.find((candidate) => candidate._id === userId);
      if (!row || (row.status !== submittedFrom && row.status !== status)) return;
      if (focusIntent.current?.userId === userId && focusIntent.current.status === status) {
        focusIntent.current.saved = true;
      }
      setFeedback((current) => ({ ...current, [userId]: { kind: "success", status } }));
    } catch {
      if (
        !mounted.current ||
        sequence.current.get(userId) !== request ||
        invalidated.current.has(userId)
      )
        return;
      const row = latestRows.current?.find((candidate) => candidate._id === userId);
      if (!row || row.status !== submittedFrom) return;
      setFeedback((current) => ({ ...current, [userId]: { kind: "error", status } }));
      const intent = focusIntent.current;
      if (intent?.userId === userId && !intent.moved) {
        requestAnimationFrame(() => {
          if (document.activeElement === document.body)
            retryRefs.current.get(userId)?.focus({ preventScroll: true });
        });
      }
      if (intent?.userId === userId) focusIntent.current = null;
    } finally {
      if (sequence.current.get(userId) === request) {
        inFlight.current.delete(userId);
        if (mounted.current)
          setPending((current) => {
            const next = { ...current };
            delete next[userId];
            return next;
          });
      }
    }
  }

  if (me === undefined) {
    return (
      <section className="kb75-admin" data-testid="admin-approvals" aria-busy="true">
        <h1 className="kb75-title">{copy.title}</h1>
        <AdminStatusSummary lang={lang} state="loading" />
      </section>
    );
  }
  if (!me?.isAdmin) {
    return (
      <section className="kb75-admin" data-testid="admin-approvals">
        <h1 className="kb75-title">{copy.adminsOnly}</h1>
        <p className="kb75-summary">{copy.adminsOnlyDetail}</p>
      </section>
    );
  }

  const pendingCount = rows?.filter((row) => row.status === "pending").length ?? 0;
  const dateFormat = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (
    <section className="kb75-admin" data-testid="admin-approvals" aria-busy={rows === undefined}>
      <h1 className="kb75-title">{copy.title}</h1>
      <AdminStatusSummary
        lang={lang}
        state={rows === undefined ? "loading" : rows.length === 0 ? "empty" : "loaded"}
        pendingCount={pendingCount}
        shownCount={rows?.length ?? 0}
      />
      {rows && rows.length > 0 ? (
        <ul className="kb75-list">
          {rows.map((row) => {
            const rowPending = pending[row._id];
            const rowFeedback: Feedback | undefined = rowPending
              ? { kind: "pending", status: rowPending }
              : feedback[row._id];
            return (
              <li
                key={row._id}
                ref={(node) => {
                  if (node) rowRefs.current.set(row._id, node);
                  else rowRefs.current.delete(row._id);
                }}
                className="kb75-row"
                tabIndex={-1}
                data-status={row.status}
                data-user-id={row._id}
              >
                <div className="kb75-row-head">
                  <div className="kb75-person">
                    {row.fullName ? <bdi dir="auto">{row.fullName}</bdi> : null}
                    <div>
                      <bdi dir="ltr" className="kb75-email">
                        {row.email}
                      </bdi>
                    </div>
                  </div>
                  <p className="kb75-meta">
                    {copy.status[row.status]}
                    {row.isAdmin ? ` · ${copy.admin}` : ""} · {copy.joined}{" "}
                    <bdi dir="ltr">{dateFormat.format(new Date(row.createdAt))}</bdi>
                  </p>
                </div>
                {!row.isAdmin ? (
                  <div className="kb75-actions">
                    {row.status !== "approved" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="kb75-action"
                        disabled={Boolean(rowPending)}
                        aria-label={copy.actionName(copy.approve, row.email)}
                        onClick={(event) => change(row._id, "approved", event.currentTarget)}
                      >
                        {copy.approve}
                      </Button>
                    ) : null}
                    {row.status !== "revoked" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="kb75-action"
                        disabled={Boolean(rowPending)}
                        aria-label={copy.actionName(copy.revoke, row.email)}
                        onClick={(event) => change(row._id, "revoked", event.currentTarget)}
                      >
                        {copy.revoke}
                      </Button>
                    ) : null}
                    {row.status === "revoked" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="kb75-action"
                        disabled={Boolean(rowPending)}
                        aria-label={copy.actionName(copy.reset, row.email)}
                        onClick={(event) => change(row._id, "pending", event.currentTarget)}
                      >
                        {copy.reset}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {rowFeedback ? (
                  <ApprovalRowFeedback
                    lang={lang}
                    email={row.email}
                    feedback={rowFeedback}
                    onRetry={
                      rowFeedback.kind === "error"
                        ? () => {
                            const control = retryRefs.current.get(row._id);
                            if (control) void change(row._id, rowFeedback.status, control);
                          }
                        : undefined
                    }
                    retryRef={(node) => {
                      if (node) retryRefs.current.set(row._id, node);
                      else retryRefs.current.delete(row._id);
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** Fictional interactive samples of the two production views. */
export function Kb75Gallery() {
  const { lang, setLang } = useLocale();
  const [state, setState] = useState<"loading" | "empty" | "loaded">("loaded");
  const [kind, setKind] = useState<Feedback["kind"]>("pending");
  const [status, setStatus] = useState<Status>("approved");
  const copy = kb75Copy[lang];
  return (
    <main
      className="kb75-gallery"
      data-testid="kb75-gallery"
      lang={lang}
      dir={lang === "he" ? "rtl" : "ltr"}
    >
      <h1 className="kb75-title">{copy.title}</h1>
      <fieldset className="kb75-actions kb75-gallery-controls">
        <legend>{copy.galleryControls}</legend>
        <Button type="button" size="sm" onClick={() => setLang(lang === "he" ? "en" : "he")}>
          {lang === "he" ? "English" : "עברית"}
        </Button>
        {(["loading", "empty", "loaded"] as const).map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setState(next)}
          >
            {copy.galleryModes[next]}
          </Button>
        ))}
        {(["pending", "success", "error"] as const).map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setKind(next)}
          >
            {copy.galleryKinds[next]}
          </Button>
        ))}
        {(["pending", "approved", "revoked"] as const).map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStatus(next)}
          >
            {copy.status[next]}
          </Button>
        ))}
      </fieldset>
      <AdminStatusSummary lang={lang} state={state} pendingCount={1} shownCount={3} />
      <div className="kb75-row">
        <bdi dir="auto">Maya Ronen</bdi>
        <div>
          <bdi dir="ltr" className="kb75-email">
            maya@example.test
          </bdi>
        </div>
        <ApprovalRowFeedback
          lang={lang}
          email="maya@example.test"
          feedback={{ kind, status }}
          onRetry={() => setKind("pending")}
        />
      </div>
    </main>
  );
}
