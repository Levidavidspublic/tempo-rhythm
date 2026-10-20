"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { UndoToast } from "@/components/you/UndoToast";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useTodayQuickAdd } from "@/components/today/TodayQuickAdd";
import { flushBrainDumpWrites, handoffBrainDumpWrites } from "@/components/brain-dump/useKeptBrainDump";
import { loadBrainDumpSession, saveBrainDumpSession, tabSessionStore } from "@/lib/brain-dump-session";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { TpIcon } from "./TpIcon";

/** A single line adds a task; multiline or longer thoughts become an unsubmitted planning draft. */
export function isPlanningDraft(text: string): boolean {
  return text.includes("\n") || text.trim().length > 140;
}

export function MobileAskBar() {
  const { t } = useLocale();
  const flow = useMobilePlanUndo();
  const router = useRouter();
  const bounds = useLocalDayBounds();
  const inputId = useId();
  const { title, setTitle, isSubmitting, hint, setHint, submit } = useTodayQuickAdd(bounds.endMs - 1);
  const [replaceRequested, setReplaceRequested] = useState(false);

  const plan = (replace = false) => {
    if (!title.trim()) { setHint(t("mobile.needTitle")); return; }
    flushBrainDumpWrites();
    const store = tabSessionStore();
    const previous = loadBrainDumpSession(store, Date.now());
    if (!replace && previous && (previous.draft !== title || previous.plan !== null)) {
      setReplaceRequested(true);
      return;
    }
    if (!saveBrainDumpSession(store, { draft: title, plan: null, accepted: [], rejected: [], savedPageId: null }, Date.now())) {
      setHint(t("mobile.keepError"));
      return;
    }
    handoffBrainDumpWrites();
    flow?.draftChanged();
    setTitle("");
    setReplaceRequested(false);
    router.push("/coach#mobile-plan");
  };

  const add = async () => {
    if (isPlanningDraft(title)) { plan(); return; }
    await submit();
  };

  return (
    <form className="tp-mobile-ask tp-glass" data-component="MobileAskBar" aria-label={t("mobile.askLabel")}
      onSubmit={(event) => { event.preventDefault(); void add(); }}>
      <div className="tp-mobile-ask__line">
        <button className="tp-btn tp-btn--icon tp-btn--ghost" type="submit" disabled={isSubmitting} aria-label={t("mobile.addToday")}>
          <TpIcon name="plus" />
        </button>
        <label className="tp-sr-only" htmlFor={inputId}>{t("mobile.askLabel")}</label>
        <textarea rows={1} id={inputId} dir="auto" value={title} placeholder={t("mobile.askPlaceholder")} disabled={isSubmitting}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void add(); } }}
          onChange={(event) => { setTitle(event.target.value); setHint(""); setReplaceRequested(false); }} />
        <button className="tp-btn tp-btn--icon tp-btn--ghost" type="button" aria-label={t("mobile.voice")}
          onClick={() => { window.dispatchEvent(new Event("tempo:mobile-voice")); router.push("/coach#coach-voice"); }}><TpIcon name="mic" /></button>
        <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" disabled={isSubmitting} onClick={() => plan()}>{t("mobile.plan")}</button>
      </div>
      {replaceRequested ? <output className="tp-mobile-ask__notice">
        <span>{t("mobile.draftExists")}</span>
        <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" onClick={() => plan(true)}>{t("mobile.replaceDraft")}</button>
        <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" onClick={() => setReplaceRequested(false)}>{t("mobile.cancel")}</button>
      </output> : null}
      {hint ? <output className="tp-mobile-ask__notice">{hint}</output> : null}
    </form>
  );
}


type Receipt = { id: number; accountId: string | undefined; taskIds: Id<"tasks">[]; pendingTodayIds: Id<"tasks">[]; dueAt: number; untilMs: number; placing: boolean; undoing: boolean; placementFailed: boolean };
type MobileUndo = {
  remember: (taskIds: Id<"tasks">[], dueAt: number) => Receipt | null;
  receipts: Receipt[];
  close: (id: number) => void;
  undo: (receipt: Receipt) => Promise<void>;
  place: (receipt: Receipt) => Promise<boolean>;
  accountId: string | undefined;
  getDraftIdentity: () => string;
  draftVersion: number;
  draftChanged: () => void;
};
const MobileUndoContext = createContext<MobileUndo | null>(null);

/** Shell ownership keeps placement retries and five-minute Undo available across mobile tabs. */
export function MobilePlanUndoProvider({ children }: { children: ReactNode }) {
  const [receipts, setReceiptState] = useState<Receipt[]>([]);
  const receiptsRef = useRef(receipts);
  const sequence = useRef(0);
  const [draftVersion, setDraftVersion] = useState(0);
  const draftVersionRef = useRef(0);
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const accountId = profile?._id;
  const accountRef = useRef(accountId);
  accountRef.current = accountId;
  const remove = useMutation(api.tasks.remove);
  const updateTask = useMutation(api.tasks.update);
  const changeReceipts = useCallback((update: (current: Receipt[]) => Receipt[]) => {
    const next = update(receiptsRef.current);
    receiptsRef.current = next;
    setReceiptState(next);
  }, []);
  useEffect(() => { changeReceipts((current) => current.filter((receipt) => receipt.accountId === accountId)); }, [accountId, changeReceipts]);
  const getDraftIdentity = useCallback(() => `${accountRef.current}:${draftVersionRef.current}`, []);
  const draftChanged = useCallback(() => { draftVersionRef.current += 1; setDraftVersion(draftVersionRef.current); }, []);
  const remember = useCallback((taskIds: Id<"tasks">[], dueAt: number) => {
    if (!accountId || taskIds.length === 0 || accountRef.current !== accountId) return null;
    const receipt = { id: ++sequence.current, accountId, taskIds, pendingTodayIds: taskIds, dueAt, untilMs: Date.now() + 5 * 60 * 1000, placing: false, undoing: false, placementFailed: false };
    changeReceipts((previous) => [...previous, receipt]);
    return receipt;
  }, [accountId, changeReceipts]);
  const close = useCallback((id: number) => changeReceipts((previous) => previous.filter((receipt) => receipt.id !== id)), [changeReceipts]);
  const place = async (requested: Receipt) => {
    const receipt = receiptsRef.current.find((current) => current.id === requested.id);
    if (!receipt || receipt.placing || receipt.undoing || accountRef.current !== receipt.accountId) return false;
    changeReceipts((previous) => previous.map((current) => current.id === receipt.id ? { ...current, placing: true } : current));
    const results = await Promise.allSettled(receipt.pendingTodayIds.map((taskId) => updateTask({ taskId, dueAt: receipt.dueAt })));
    const remaining = receipt.pendingTodayIds.filter((_, index) => results[index]?.status === "rejected");
    changeReceipts((previous) => previous.map((current) => current.id === receipt.id ? { ...current, pendingTodayIds: remaining.filter((id) => current.taskIds.includes(id)), placing: false, placementFailed: remaining.length > 0 } : current));
    return remaining.length === 0;
  };
  const undo = async (requested: Receipt) => {
    const receipt = receiptsRef.current.find((current) => current.id === requested.id);
    if (!receipt || receipt.placing || receipt.undoing) throw new Error("Receipt is busy");
    if (accountRef.current !== receipt.accountId) return;
    if (Date.now() >= receipt.untilMs) { close(receipt.id); return; }
    changeReceipts((previous) => previous.map((current) => current.id === receipt.id ? { ...current, undoing: true } : current));
    const result = await Promise.allSettled(receipt.taskIds.map((taskId) => remove({ taskId })));
    const remaining = receipt.taskIds.filter((_, index) => result[index]?.status === "rejected");
    if (remaining.length > 0) {
      changeReceipts((previous) => previous.map((current) => current.id === receipt.id ? { ...current, undoing: false, taskIds: remaining, pendingTodayIds: current.pendingTodayIds.filter((id) => remaining.includes(id)) } : current));
      throw new Error("Undo incomplete");
    }
    close(receipt.id);
  };
  return <MobileUndoContext.Provider value={{ remember, receipts, close, undo, place, accountId, getDraftIdentity, draftVersion, draftChanged }}>{children}</MobileUndoContext.Provider>;
}

export function useMobilePlanUndo() { return useContext(MobileUndoContext); }

export function MobilePlanUndoToasts({ inert = false }: { inert?: boolean }) {
  const undo = useMobilePlanUndo();
  const { t } = useLocale();
  if (!undo?.receipts.length) return null;
  return <div className="tp-mobile-undo" inert={inert}>{undo.receipts.map((receipt) => <fieldset key={receipt.id} className="tp-mobile-undo__receipt" disabled={receipt.placing || receipt.undoing}>
    <UndoToast title={t(receipt.placementFailed ? "mobile.partialToday" : receipt.pendingTodayIds.length > 0 ? "mobile.planSaved" : "mobile.planAdded")}
      untilMs={receipt.untilMs} onUndo={() => undo.undo(receipt)} onClose={() => undo.close(receipt.id)} />
    {receipt.placementFailed ? <button className="tp-btn tp-btn--secondary" type="button" disabled={receipt.placing} onClick={() => void undo.place(receipt)}>{t("mobile.retryToday")}</button> : null}
  </fieldset>)}</div>;
}
