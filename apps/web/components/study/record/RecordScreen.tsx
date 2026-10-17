"use client";

import Link from "next/link";
import {
  OfflineNotice,
  ScreenBoundary,
  StateError,
  StateLoading,
  useOnline,
  useSignedIn,
} from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { StateSignedOut } from "@/components/you/ScreenStates";
import { recordCopy } from "./recordFlow";
import { RecordHead, RecordKeeper } from "./RecordSession";

/**
 * /study/record: RecordSession behind the same gates as the other study screens. Signed out, the
 * recordings functions refuse, so the screen shows the sign-in state instead of reaching them; while
 * the session is still being checked it shows skeletons; a read that throws shows the screen's own
 * error with Retry and a way back to Study. The browser's online flag goes down to RecordSession.
 */
export function RecordScreen() {
  const { lang } = useLocale();
  const copy = recordCopy(lang);
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-rec" data-component="RecordSession" data-state="error">
          <RecordHead copy={copy} />
          <StateError title={copy("rec.error")} onRetry={retry} action={<BackToStudy />} />
        </div>
      )}
    >
      <RecordGate />
    </ScreenBoundary>
  );
}

function RecordGate() {
  const signedIn = useSignedIn();
  const online = useOnline();
  return <RecordGateView signedIn={signedIn} online={online} />;
}

/** What the record route shows for each sign-in state (no data access of its own). */
export function RecordGateView({
  signedIn,
  online,
}: {
  signedIn: "loading" | "ready" | "signedOut";
  online: boolean;
}) {
  const { lang, t } = useLocale();
  const copy = recordCopy(lang);
  // Once ready, RecordKeeper keeps the session mounted through a later "loading" or sign-out.
  return (
    <RecordKeeper
      signedIn={signedIn}
      online={online}
      before={(state) => (
        <div className="tp-page tp-rec" data-component="RecordSession" data-state={state}>
          <RecordHead copy={copy} />
          {online ? null : <OfflineNotice text={t("gx.offline")} />}
          {state === "signedOut" ? (
            <StateSignedOut />
          ) : (
            <StateLoading label={copy("rec.loading")} lead="block" rows={1} />
          )}
        </div>
      )}
    />
  );
}

function BackToStudy() {
  const { t } = useLocale();
  return (
    <Link className="tp-btn tp-btn--ghost" href="/study">
      <TpIcon name="chevron" size="sm" className="tp-icon--back" />
      <span>{t("st.review.back")}</span>
    </Link>
  );
}
