"use client";

import type { StudyBlockType } from "@tempo/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ScreenBoundary,
  StateError,
  StateLoading,
  useOnline,
  useSignedIn,
} from "@/components/goals/shared";
import { StateSignedOut } from "@/components/you/ScreenStates";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { setHref } from "./hub";
import { isStudyKind } from "./preview";
import {
  BackLink,
  type GenerateResult,
  type NotePreviewSource,
  TurnIntoView,
} from "./TurnIntoView";

/**
 * S25 preview (/study/new?from=<noteId>&kind=<flashcards|quiz|test>). The outline reader drafts a
 * preview from the page right away (no model, nothing saved); "Ask the coach" asks `study.generate`
 * for one instead. The preview is a ProposalCard: what it will add in words, every card or
 * question listed, and Accept / Edit (change, add, remove items) / Reject. Accept is the only path
 * that saves (`study.createFromPreview`), followed by a glass Undo toast with a 5:00 countdown
 * (`study.undoCreate`), which always takes the set back (HARD_RULES §1). When that also took the
 * page's changes or the studying since, a second toast says so and offers Bring it back for 5:00
 * (`study.redoCreate`). When the coach isn't available (no key, page too short, busy) it says so
 * kindly and the outline reader's preview stays.
 *
 * With `block=<blockId>` instead of `kind`, it opens a study block that's already in the page:
 * `study.registerBlock`, then on to /study/<setId>.
 */

export function TurnIntoPreview({
  from,
  kind,
  block,
}: {
  from?: string;
  kind?: string;
  block?: string;
}) {
  const { t } = useLocale();
  const studyKind: StudyBlockType = isStudyKind(kind) ? kind : "flashcards";
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--narrow tp-study-stack" data-component="PageLayout">
          <StateError
            title={block ? t("st.open.error") : t("st.pv.error")}
            onRetry={retry}
            action={<BackLink from={from} t={t} />}
          />
        </div>
      )}
    >
      {from && block ? (
        <OpenStudyBlock noteId={from} blockId={block} />
      ) : (
        <TurnIntoData from={from} kind={studyKind} />
      )}
    </ScreenBoundary>
  );
}

function TurnIntoData({ from, kind }: { from?: string; kind: StudyBlockType }) {
  const signedIn = useSignedIn();
  const online = useOnline();
  const note = useQuery(
    api.notes.getSafe,
    signedIn === "ready" && from ? { noteId: from } : "skip"
  );
  const generate = useAction(api.study.generate);
  const create = useMutation(api.study.createFromPreview);
  const undoCreate = useMutation(api.study.undoCreate);
  const redoCreate = useMutation(api.study.redoCreate);
  const source: NotePreviewSource | null | undefined =
    !from || signedIn === "signedOut"
      ? null
      : note === undefined
        ? undefined
        : note
          ? { id: note._id, title: note.title, body: note.body }
          : null;
  return (
    <TurnIntoView
      note={source}
      hasFrom={Boolean(from)}
      signedOut={signedIn === "signedOut"}
      kind={kind}
      online={online}
      onGenerate={async () => {
        if (!source) return { status: "unavailable", reason: "failed" };
        return (await generate({ noteId: source.id as Id<"notes">, kind })) as GenerateResult;
      }}
      onCreate={async (preview, title) => {
        const created = await create({
          kind: preview.kind,
          title,
          data: preview.data,
          ...(source ? { sourceNoteId: source.id as Id<"notes"> } : {}),
        });
        return { noteId: created.noteId, setId: created.setId, undoUntil: created.undoUntil };
      }}
      onUndo={async (setId) => {
        const result = await undoCreate({ setId: setId as Id<"studySets"> });
        return {
          removedEdits: result.removedEdits === true,
          ...(result.redoUntil !== undefined ? { redoUntil: result.redoUntil } : {}),
        };
      }}
      onRedo={(setId) => redoCreate({ setId: setId as Id<"studySets"> })}
    />
  );
}

/** Opens a study block that's already in a page: register it as a set, then go to the set. */
function OpenStudyBlock({ noteId, blockId }: { noteId: string; blockId: string }) {
  const { t } = useLocale();
  const signedIn = useSignedIn();
  const register = useMutation(api.study.registerBlock);
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (signedIn !== "ready" || started.current) return;
    started.current = true;
    register({ noteId: noteId as Id<"notes">, blockId })
      .then((setId) => router.replace(setHref(setId)))
      .catch(() => setFailed(true));
  }, [signedIn, register, noteId, blockId, router]);
  return (
    <div
      className="tp-page tp-page--narrow tp-study-stack"
      data-component="PageLayout"
      data-screen="OpenStudyBlock"
    >
      {signedIn === "signedOut" ? (
        <StateSignedOut />
      ) : failed ? (
        <StateError title={t("st.open.error")} action={<BackLink from={noteId} t={t} />} />
      ) : (
        <StateLoading label={t("st.open.loading")} lead="block" rows={1} />
      )}
    </div>
  );
}
