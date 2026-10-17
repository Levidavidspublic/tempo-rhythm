"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import {
  buildMiniAppSrcdoc,
  isNavigationLoad,
  isTooLarge,
  MINI_APP_MIN_HEIGHT,
  MINI_APP_SANDBOX,
  miniAppFingerprint,
  readMiniAppMessage,
} from "./mini-app";

export type MiniAppFrameProps = {
  /** The widget's own HTML, exactly as its block carries it. Nothing else is passed in. */
  html: string;
  /** The widget's name, shown on the card and as the frame's accessible name. */
  title: string;
  /**
   * The fingerprint (`miniAppFingerprint`) of the code the person chose to run, or null. An
   * approval holds only for that exact HTML: when `html` changes, the widget asks again.
   */
  approvedFingerprint: string | null;
  /** The person chose to run the widget; called with the fingerprint of the code they saw. */
  onApprove: (fingerprint: string) => void;
  /** The widget sent `tempo:done`. */
  onDone?: () => void;
};

const START_HEIGHT = 160;

/**
 * MiniAppFrame (S24, PRD F-46): a code widget from a page, run only after the person approves it
 * and only inside `<iframe sandbox="allow-scripts">` with a srcdoc that starts with a strict CSP.
 * No same-origin, so it can't reach Tempo's storage, cookies or session; no keys or user data are
 * passed in; the only way back is a size or "done" message from that frame. A building block:
 * not wired into pages yet.
 *
 * The approval is for a fingerprint of the code, so changed code asks again. If the widget
 * navigates its own frame (any load after the srcdoc's first), the frame is taken down and a
 * note says so, with "Run it again": only the person's press starts it again, and only while their
 * approval still holds for this exact code (otherwise the card asks first, as before).
 * A widget larger than 64 KB has no way out on this card: only editing the page's code can change
 * that, and the card says the page itself is fine.
 *
 * Residual risk (UNKNOWN, not verified in a browser): a CSP can't block `RTCPeerConnection`, so a
 * widget could try WebRTC to reach the network. The sandbox has no `allow-same-origin` (no
 * cookies, storage or session) and no user data is passed in, so it only has its own code to
 * send; a navigation's request (with whatever is in its URL) has left before the load guard runs.
 */
export function MiniAppFrame({ html, title, approvedFingerprint, onApprove, onDone }: MiniAppFrameProps) {
  const { t } = useLocale();
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(START_HEIGHT);
  const [done, setDone] = useState(false);
  const [stoppedFor, setStoppedFor] = useState<string | null>(null);
  // Loads counted per srcdoc: a new srcdoc's first load starts the count again.
  const loads = useRef<{ doc: string; count: number }>({ doc: "", count: 0 });
  const tooLarge = isTooLarge(html);
  const fingerprint = useMemo(() => miniAppFingerprint(html), [html]);
  const stopped = stoppedFor === fingerprint;
  const run = approvedFingerprint === fingerprint && !tooLarge && !stopped;
  const srcDoc = useMemo(() => (run ? buildMiniAppSrcdoc(html) : ""), [run, html]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const onLoad = () => {
    if (loads.current.doc !== srcDoc) loads.current = { doc: srcDoc, count: 0 };
    loads.current.count += 1;
    if (isNavigationLoad(loads.current.count)) setStoppedFor(fingerprint);
  };

  useEffect(() => {
    if (!run) return;
    const onMessage = (event: MessageEvent) => {
      const message = readMiniAppMessage(event, frame.current?.contentWindow ?? null);
      if (!message) return;
      if (message.type === "size") setHeight(message.height);
      else {
        setDone(true);
        onDoneRef.current?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [run]);

  // After "Run it again" the button is gone: the keyboard goes to the frame it started, or, when
  // the approval no longer holds for this code, to the ask card's Run button.
  const focusFrame = useRef(false);
  const runButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (stopped || !focusFrame.current) return;
    focusFrame.current = false;
    if (run) frame.current?.focus();
    else runButton.current?.focus();
  }, [run, stopped]);

  const runAgain = () => {
    // A fresh frame: its first load is the srcdoc's own again, and it starts at its first size.
    loads.current = { doc: "", count: 0 };
    setHeight(START_HEIGHT);
    setDone(false);
    setStoppedFor(null);
    focusFrame.current = true;
  };

  if (stopped && !tooLarge) {
    return (
      <section className="tp-card tp-miniapp" data-component="MiniAppFrame" data-state="stopped">
        <p className="tp-miniapp__kind">
          <TpIcon name="module" size="sm" />
          <span>{t("mini.kind")}</span>
        </p>
        <h3 className="tp-miniapp__title" dir="auto">
          {title}
        </h3>
        <p className="tp-miniapp__note" role="note">
          <TpIcon name="info" size="sm" />
          <span>{t("mini.stopped")}</span>
        </p>
        <div className="tp-miniapp__actions">
          <button className="tp-btn tp-btn--secondary" type="button" data-action="miniapp-run-again" onClick={runAgain}>
            <TpIcon name="play" size="sm" />
            <span>{t("mini.runAgain")}</span>
          </button>
        </div>
      </section>
    );
  }

  if (!run) {
    return (
      <section className="tp-card tp-miniapp" data-component="MiniAppFrame" data-state={tooLarge ? "too-large" : "ask"}>
        <p className="tp-miniapp__kind">
          <TpIcon name="module" size="sm" />
          <span>{t("mini.kind")}</span>
        </p>
        <h3 className="tp-miniapp__title" dir="auto">
          {title}
        </h3>
        {tooLarge ? (
          <p className="tp-miniapp__note" role="note">
            <TpIcon name="info" size="sm" />
            <span>{t("mini.tooBig")}</span>
          </p>
        ) : (
          <>
            <p className="tp-miniapp__body">{t("mini.what")}</p>
            <p className="tp-help">{t("mini.ask")}</p>
            <div className="tp-miniapp__actions">
              <button
                ref={runButton}
                className="tp-btn tp-btn--secondary"
                type="button"
                onClick={() => onApprove(fingerprint)}
              >
                <TpIcon name="play" size="sm" />
                <span>{t("mini.run")}</span>
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="tp-miniapp tp-miniapp--running" data-component="MiniAppFrame" data-state="running">
      <p className="tp-miniapp__kind">
        <TpIcon name="lock" size="sm" />
        <span>{t("mini.running")}</span>
      </p>
      <iframe
        ref={frame}
        className="tp-miniapp__frame"
        title={title}
        sandbox={MINI_APP_SANDBOX}
        referrerPolicy="no-referrer"
        srcDoc={srcDoc}
        onLoad={onLoad}
        style={{ blockSize: `${Math.max(height, MINI_APP_MIN_HEIGHT)}px` }}
      />
      {done ? (
        <output className="tp-miniapp__note">
          <TpIcon name="check" size="sm" />
          <span>{t("mini.done")}</span>
        </output>
      ) : null}
    </section>
  );
}
