"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { buildMiniAppSrcdoc, isTooLarge, MINI_APP_MIN_HEIGHT, MINI_APP_SANDBOX, readMiniAppMessage } from "./mini-app";

export type MiniAppFrameProps = {
  /** The widget's own HTML, exactly as its block carries it. Nothing else is passed in. */
  html: string;
  /** The widget's name, shown on the card and as the frame's accessible name. */
  title: string;
  /** True once the person chose to run this widget. */
  approved: boolean;
  onApprove: () => void;
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
 */
export function MiniAppFrame({ html, title, approved, onApprove, onDone }: MiniAppFrameProps) {
  const { t } = useLocale();
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(START_HEIGHT);
  const [done, setDone] = useState(false);
  const tooLarge = isTooLarge(html);
  const run = approved && !tooLarge;
  const srcDoc = useMemo(() => (run ? buildMiniAppSrcdoc(html) : ""), [run, html]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

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
              <button className="tp-btn tp-btn--secondary" type="button" onClick={onApprove}>
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
