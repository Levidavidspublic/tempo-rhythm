"use client";

import { useMutation, useQuery } from "convex/react";
import { Component, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ConfirmSheet } from "@/components/you/Controls";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";

type Status = "pending" | "approved" | "revoked";
type Decision = {
  userId: Id<"users">;
  status: Status;
  beta: boolean;
  label: string;
  stillCurrent: () => boolean;
};
type QueueRow = { id: Id<"users">; email: string | null; name: string | null; requestedAt: number };
type QueuePage = { page: QueueRow[]; continueCursor: string; isDone: boolean };
const STATUS_KEYS: Record<Status, MessageKey> = {
  pending: "adminApproval.pending",
  approved: "adminApproval.approved",
  revoked: "adminApproval.revoked",
};
const PAGE_SIZE = 20;
const EMPTY_PAGE_HOPS = 10;

/** Only the gate query runs before administrator authorization. No browser-owned grants. */
export function AdminApprovals() {
  const { t } = useLocale();
  const me = useQuery(api.approval.myStatus);
  if (me === undefined) return <output className="tp-help">{t("adminApproval.loading")}</output>;
  if (!me?.isAdmin)
    return (
      <div className="tp-page tp-page--narrow">
        <h1 className="tp-pagehead__title">{t("adminApproval.adminOnly")}</h1>
        <p className="tp-help">{t("adminApproval.adminOnlyBody")}</p>
      </div>
    );
  // Remount all page/decision state when the authenticated administrator changes.
  return <AdminApprovalPanel key={me.email} />;
}

function AdminApprovalPanel() {
  const { t, lang } = useLocale();
  const rows = useQuery(api.approval.listForAdmin, {});
  const setStatus = useMutation(api.approval.setStatus);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function ask(next: Decision) {
    if (busyRef.current) return;
    setError(null);
    setNotice(null);
    setDecision(next);
  }
  async function confirm() {
    if (!decision || busyRef.current || !alive.current) return;
    if (!decision.stillCurrent()) {
      setDecision(null);
      setError("adminApproval.changed");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await setStatus({ userId: decision.userId, status: decision.status });
      if (!alive.current) return;
      setDecision(null);
      setNotice("adminApproval.saved");
    } catch {
      if (!alive.current) return;
      setError("adminApproval.saveError");
    } finally {
      if (alive.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  const label = (row: { email: string }) => row.email || t("adminApproval.account");
  const bodyKey: MessageKey =
    decision?.status === "approved"
      ? decision.beta
        ? "adminApproval.betaConfirmBody"
        : "adminApproval.approveBody"
      : decision?.status === "revoked"
        ? "adminApproval.revokeBody"
        : "adminApproval.pendingBody";

  return (
    <div className="tp-page tp-page--narrow ig-body" data-testid="admin-approvals">
      <header className="tp-pagehead">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("adminApproval.title")}</h1>
          <p className="tp-pagehead__sub">{t("adminApproval.description")}</p>
        </div>
      </header>
      <output className="tp-help">{notice ? t(notice) : ""}</output>
      {error && !decision ? (
        <p className="tp-error-text" role="alert">
          {t(error)}
        </p>
      ) : null}
      <QueueBoundary
        fallback={(retry) => (
          <section className="tp-settings-section">
            <h2 className="tp-settings-section__title">{t("adminApproval.queueTitle")}</h2>
            <p className="tp-error-text" role="alert">
              {t("adminApproval.queueError")}
            </p>
            <button
              type="button"
              className="tp-btn tp-btn--secondary"
              disabled={busy || decision !== null}
              onClick={retry}
            >
              {t("set.retry")}
            </button>
          </section>
        )}
      >
        <BetaQueue locked={busy || decision !== null} onDecision={ask} />
      </QueueBoundary>
      <section className="tp-settings-section" aria-labelledby="all-accounts-title">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="all-accounts-title">
            {t("adminApproval.accountsTitle")}
          </h2>
          <p className="tp-settings-section__desc">{t("adminApproval.accountsBody")}</p>
        </div>
        {rows === undefined ? (
          <output className="tp-help">{t("adminApproval.loadingAccounts")}</output>
        ) : (
          <ul className="tp-list">
            {rows.map((row) => (
              <li
                key={row._id}
                className="tp-setting-row tp-setting-row--stack"
                data-status={row.status}
              >
                <div className="tp-setting-row__text">
                  <span className="tp-setting-row__label break-all" dir="auto">
                    {label(row)}
                  </span>
                  <span className="tp-help">
                    {t(STATUS_KEYS[row.status])}
                    {row.isAdmin ? ` · ${t("adminApproval.admin")}` : ""} ·{" "}
                    {t("adminApproval.joined")}{" "}
                    <bdi>
                      {new Date(row.createdAt).toLocaleDateString(
                        lang === "he" ? "he-IL" : "en-US"
                      )}
                    </bdi>
                  </span>
                </div>
                {!row.isAdmin ? (
                  <div className="tp-setting-row__control flex-wrap">
                    {(
                      [
                        "approved",
                        "revoked",
                        ...(row.status === "revoked" ? ["pending"] : []),
                      ] as Status[]
                    )
                      .filter((status) => status !== row.status)
                      .map((status) => (
                        <button
                          key={status}
                          type="button"
                          className="tp-btn tp-btn--secondary"
                          disabled={busy || decision !== null}
                          aria-label={`${t(status === "approved" ? "adminApproval.approve" : status === "revoked" ? "adminApproval.revoke" : "adminApproval.toPending")} — ${label(row)}`}
                          onClick={() =>
                            ask({
                              userId: row._id,
                              status,
                              beta: false,
                              label: label(row),
                              stillCurrent: () =>
                                Boolean(
                                  rowsRef.current?.some(
                                    (current) =>
                                      current._id === row._id &&
                                      current.status === row.status &&
                                      !current.isAdmin
                                  )
                                ),
                            })
                          }
                        >
                          {t(
                            status === "approved"
                              ? "adminApproval.approve"
                              : status === "revoked"
                                ? "adminApproval.revoke"
                                : "adminApproval.toPending"
                          )}
                        </button>
                      ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {decision ? (
        <ConfirmSheet
          title={t(
            decision.status === "approved"
              ? "adminApproval.approveTitle"
              : decision.status === "revoked"
                ? "adminApproval.revokeTitle"
                : "adminApproval.pendingTitle"
          )}
          body={
            <>
              <span dir="auto" className="break-all">
                {decision.label}
              </span>
              <br />
              {t(bodyKey)}
              {error ? (
                <span className="tp-error-text" role="alert">
                  {" "}
                  {t(error)}
                </span>
              ) : null}
            </>
          }
          confirmLabel={
            busy ? t("adminApproval.saving") : t(error ? "set.retry" : "adminApproval.confirm")
          }
          cancelLabel={t("adminApproval.cancel")}
          busy={busy}
          onConfirm={() => void confirm()}
          onClose={() => {
            if (!busyRef.current) {
              setDecision(null);
              setError(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

/** One bounded live page; a new cursor replaces the page rather than caching applicant identities. */
function BetaQueue({
  locked,
  onDecision,
}: {
  locked: boolean;
  onDecision: (decision: Decision) => void;
}) {
  const { t, lang } = useLocale();
  const id = useId();
  const [cursor, setCursor] = useState<string | null>(null);
  const page: QueuePage | undefined = useQuery(api.approval.listBetaRequests, {
    cursor,
    numItems: PAGE_SIZE,
  });
  const pageRef = useRef(page);
  pageRef.current = page;
  const alive = useRef(true);
  const seen = useRef(new Set<string>());
  const hops = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const cannotAdvance = Boolean(
    page &&
      !page.isDone &&
      (page.continueCursor === cursor || seen.current.has(page.continueCursor))
  );
  useEffect(() => {
    if (
      !page ||
      page.page.length ||
      page.isDone ||
      locked ||
      cannotAdvance ||
      hops.current >= EMPTY_PAGE_HOPS
    )
      return;
    hops.current += 1;
    seen.current.add(page.continueCursor);
    setCursor(page.continueCursor);
  }, [page, locked, cannotAdvance]);
  function start() {
    seen.current.clear();
    hops.current = 0;
    setCursor(null);
  }
  function next() {
    if (!page || page.isDone || locked || cannotAdvance) return;
    seen.current.clear();
    hops.current = 0;
    setCursor(page.continueCursor);
  }
  return (
    <section className="tp-settings-section" aria-labelledby={id} data-testid="beta-queue">
      <div className="tp-settings-section__head">
        <h2 className="tp-settings-section__title" id={id}>
          {t("adminApproval.queueTitle")}
        </h2>
        <p className="tp-settings-section__desc">{t("adminApproval.queueBody")}</p>
      </div>
      {page === undefined ? (
        <output className="tp-help">{t("adminApproval.loadingQueue")}</output>
      ) : (
        <>
          {!page.page.length ? (
            <output className="tp-help">
              {t(
                page.isDone
                  ? cursor === null
                    ? "adminApproval.empty"
                    : "adminApproval.endPage"
                  : hops.current >= EMPTY_PAGE_HOPS
                    ? "adminApproval.morePages"
                    : "adminApproval.checkingMore"
              )}
            </output>
          ) : null}
          <ul className="tp-list">
            {page.page.map((row) => {
              const label = row.name || row.email || t("adminApproval.account");
              return (
                <li key={row.id} className="tp-setting-row tp-setting-row--stack">
                  <div className="tp-setting-row__text">
                    <span className="tp-setting-row__label break-all" dir="auto">
                      {label}
                    </span>
                    {row.name && row.email ? (
                      <span className="tp-help break-all" dir="auto">
                        {row.email}
                      </span>
                    ) : null}
                    <span className="tp-help">
                      {t("adminApproval.requested")}{" "}
                      <bdi>
                        {new Date(row.requestedAt).toLocaleDateString(
                          lang === "he" ? "he-IL" : "en-US"
                        )}
                      </bdi>
                    </span>
                  </div>
                  <div className="tp-setting-row__control flex-wrap">
                    {(["approved", "revoked"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="tp-btn tp-btn--secondary"
                        disabled={locked}
                        aria-label={`${t(status === "approved" ? "adminApproval.approveBeta" : "adminApproval.revoke")} — ${label}`}
                        onClick={() =>
                          onDecision({
                            userId: row.id,
                            status,
                            beta: true,
                            label,
                            stillCurrent: () =>
                              alive.current &&
                              Boolean(
                                pageRef.current?.page.some(
                                  (current) =>
                                    current.id === row.id && current.requestedAt === row.requestedAt
                                )
                              ),
                          })
                        }
                      >
                        {t(
                          status === "approved"
                            ? "adminApproval.approveBeta"
                            : "adminApproval.revoke"
                        )}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          {cannotAdvance ? (
            <p className="tp-error-text" role="alert">
              {t("adminApproval.cursorError")}
            </p>
          ) : null}
          <div className="tp-setting-row__control flex-wrap">
            {!page.isDone && !cannotAdvance ? (
              <button
                type="button"
                className="tp-btn tp-btn--secondary"
                disabled={locked}
                onClick={next}
              >
                {t("adminApproval.next")}
              </button>
            ) : null}
            {cursor !== null || cannotAdvance ? (
              <button
                type="button"
                className="tp-btn tp-btn--ghost"
                disabled={locked}
                onClick={start}
              >
                {t("adminApproval.start")}
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

class QueueBoundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children;
  }
}
