"use client";

import { Renderer } from "@openuidev/react-lang";
import { useMutation } from "convex/react";
import { Component, type ReactNode, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { coachCardTask } from "@/lib/openui/coach-actions";
import { type ProgramProposal, proposalProgram } from "@/lib/openui/coach-program";
import { localIsoDate } from "@/lib/period-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { useFlushCoachPage } from "../CoachPage";
import { type CoachCardRuntime, CoachCardRuntimeContext, coachOpenUiLibrary } from "./CoachOpenUiLibrary";

/** Draws the direct card instead: on a render error, and for Edit (the direct card owns the form). */
export type DirectCard = (options: { editing: boolean; onCancelEdit: () => void }) => ReactNode;

/** Hands over to the direct card when OpenUI throws while drawing (also used by ../CoachSources.tsx). */
export class OpenUiBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * A coach proposal drawn through OpenUI (flag `openui`): the program is built from the stored
 * proposal (lib/openui/coach-program.ts), rendered by `@openuidev/react-lang` with Tempo's coach
 * library, and its actions run the same Convex mutations as the direct card. Nothing changes
 * until Accept or Save; Undo stays for 5 minutes (HARD_RULES §1, §6.2).
 */
export function OpenUiProposal({
  messageId,
  proposal,
  direct,
}: {
  messageId: Id<"messages">;
  proposal: ProgramProposal;
  direct: DirectCard;
}) {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const flushPage = useFlushCoachPage();
  const accept = useMutation(api.coach.acceptProposal);
  const reject = useMutation(api.coach.rejectProposal);
  const undo = useMutation(api.coach.undoProposal);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [broken, setBroken] = useState(false);
  const decision = proposal.kind === "decision";
  const program = useMemo(() => proposalProgram(proposal), [proposal]);
  const runtime = useMemo<CoachCardRuntime>(() => ({ busy, failed, decision, t }), [busy, failed, decision, t]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const onAction = (event: { type: string }) => {
    if (event.type === "Edit") {
      setEditing(true);
      return;
    }
    const task = coachCardTask(event.type, {
      decision,
      accept: () => accept({ messageId, dueTodayAt: bounds.endMs - 1 }),
      save: () => accept({ messageId, todayDate: localIsoDate(new Date(bounds.startMs)) }),
      reject: () => reject({ messageId }),
      undo: () => undo({ messageId }),
      flushPage,
    });
    if (task) void act(task);
  };

  if (broken || (editing && proposal.status === "pending")) {
    return direct({ editing: editing && !broken, onCancelEdit: () => setEditing(false) });
  }
  return (
    <CoachCardRuntimeContext.Provider value={runtime}>
      <OpenUiBoundary onError={() => setBroken(true)}>
        <Renderer
          response={program}
          library={coachOpenUiLibrary}
          onAction={onAction}
          onError={(errors) => {
            if (errors.length > 0) setBroken(true);
          }}
        />
      </OpenUiBoundary>
    </CoachCardRuntimeContext.Provider>
  );
}
