"use client";

// A namespace import: test files swap convex/react module mocks, and a named import of a hook that
// another file's mock lacks would stop this module from linking (as in record/recordApi.ts).
import * as convexReact from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  OfflineNotice,
  ScreenBoundary,
  StateEmpty,
  StateError,
  StateLoading,
  useOnline,
  useSignedIn,
} from "@/components/goals/shared";
import { StateSignedOut } from "@/components/you/ScreenStates";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import { fullReading, pageLang } from "../../../../../packages/core/recap";
import { BackToStudy } from "../StudySetView";
import { AudioRecapPlayer } from "./AudioRecapPlayer";
import type { ListenMode } from "./player";
import type { TempoAvailability, TempoPiece, TempoVoiceSource } from "./tempoVoice";

/**
 * /study/listen?from=<noteId>&mode=recap|full (kitchen T4, S16): reads the page with the notes
 * query (notes.getSafe: null for a page that isn't this person's) and hands it to the player.
 * The recap is built on the device. When the deployment has Tempo's voice (`studyVoice`), the
 * player may read with it, asking for each piece by the page id and an index; the page's words
 * are never sent. Otherwise the device's own voice reads and nothing is sent anywhere.
 */

export type ListenNote = { title: string; body: string } | null | undefined;

export function ListenScreen({ from, mode }: { from?: string; mode: ListenMode }) {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <Frame>
          <StateError title={t("st.ls.error")} onRetry={retry} action={<BackToStudy t={t} />} />
        </Frame>
      )}
    >
      <ListenData from={from} mode={mode} />
    </ScreenBoundary>
  );
}

function ListenData({ from, mode }: { from?: string; mode: ListenMode }) {
  const signedIn = useSignedIn();
  const online = useOnline();
  const note = convexReact.useQuery(api.notes.getSafe, signedIn === "ready" && from ? { noteId: from } : "skip");
  const [availability, setAvailability] = useState<TempoAvailability | undefined>(undefined);
  const speak = convexReact.useAction(api.studyVoice.speak);
  const fetchPiece = useCallback(
    (index: number) => speak({ noteId: from ?? "", mode, index }) as Promise<TempoPiece>,
    [speak, from, mode]
  );
  const tempo = useMemo<TempoVoiceSource>(() => ({ availability, online, fetchPiece }), [availability, online, fetchPiece]);
  const ask = signedIn === "ready" && Boolean(from);
  return (
    <>
      {ask ? (
        // Tempo's voice is extra: if its query fails, the device's voice reads and the screen stays.
        <ScreenBoundary fallback={() => <Report value={VOICE_OFF} onValue={setAvailability} />}>
          <TempoAvailabilityProbe onValue={setAvailability} />
        </ScreenBoundary>
      ) : null}
      <ListenStates
        from={from}
        mode={mode}
        online={online}
        signedOut={signedIn === "signedOut"}
        note={note as ListenNote}
        tempo={tempo}
      />
    </>
  );
}

const VOICE_OFF: TempoAvailability = { status: "off", charsLeft: 0 };

function TempoAvailabilityProbe({ onValue }: { onValue: (value: TempoAvailability | undefined) => void }) {
  const value = convexReact.useQuery(api.studyVoice.availability, {}) as TempoAvailability | undefined;
  return <Report value={value} onValue={onValue} />;
}

/** Hands a value up after render; draws nothing. */
function Report({ value, onValue }: { value: TempoAvailability | undefined; onValue: (value: TempoAvailability | undefined) => void }) {
  const status = value?.status;
  const charsLeft = value?.charsLeft;
  // Reported by its fields, so a new object with the same answer doesn't redraw the player.
  useEffect(() => {
    onValue(status === undefined ? undefined : { status, charsLeft: charsLeft ?? 0 });
  }, [status, charsLeft, onValue]);
  return null;
}

/** Every state but the player keeps the screen's h1, "Listen" (the player's h1 is the page title). */
function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="tp-page tp-page--narrow tp-study-stack" data-component="PageLayout" data-screen="StudyListen">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("st.ls.title")}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}

/** Every state of the screen around the player; data comes in as props (tests draw this). */
export function ListenStates({
  from,
  mode,
  online,
  signedOut,
  note,
  tempo,
}: {
  from?: string;
  mode: ListenMode;
  online: boolean;
  signedOut?: boolean;
  note: ListenNote;
  /** Tempo's voice for this page; without it the device's voice reads. */
  tempo?: TempoVoiceSource;
}) {
  const { t } = useLocale();
  const offline = online ? null : <OfflineNotice text={t("gx.offline")} />;
  if (!from) {
    return (
      <Frame>
        <StateEmpty
          icon="volume"
          title={t("st.ls.pick.title")}
          body={t("st.ls.pick.body")}
          action={<BackToStudy t={t} />}
        />
      </Frame>
    );
  }
  if (signedOut) {
    return (
      <Frame>
        <StateSignedOut />
      </Frame>
    );
  }
  if (note === undefined) {
    return (
      <Frame>
        {offline}
        <StateLoading label={t("st.ls.loading")} lead="block" rows={3} />
      </Frame>
    );
  }
  if (note === null) {
    return (
      <Frame>
        <StateEmpty
          icon="page"
          title={t("st.ls.gone.title")}
          body={t("st.ls.gone.body")}
          action={<BackToStudy t={t} />}
        />
      </Frame>
    );
  }
  if (fullReading(note.body, { lang: pageLang(note.body) }).length === 0) {
    return (
      <Frame>
        <StateEmpty icon="page" title={t("st.ls.empty.title")} body={t("st.ls.empty.body")} action={<BackToStudy t={t} />} />
      </Frame>
    );
  }
  // Once the page is here, everything works offline, so no offline notice over the player.
  return (
    <AudioRecapPlayer key={`${from}:${mode}`} noteId={from} title={note.title} body={note.body} mode={mode} tempo={tempo} />
  );
}
