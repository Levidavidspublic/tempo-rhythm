"use client";

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { messageTime } from "@/lib/coach-thread";

/**
 * One coach-thread message (coach-thread.html, CoachMessage / UserMessage): who wrote it, when,
 * the text, and a Copy action. The coach's words render as Markdown with GFM (lists, bold, code),
 * like a page's read view: raw HTML stays escaped, remote images never load and links open in a
 * new tab. What the person typed stays plain text with its own line breaks.
 */
export function CoachMessage({
  role,
  content,
  createdAt,
}: {
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}) {
  const { t, lang } = useLocale();
  const [copy, setCopy] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (copy === "idle") return;
    const timer = window.setTimeout(() => setCopy("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copy]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopy("copied");
    } catch {
      setCopy("error");
    }
  };

  const isUser = role === "user";
  return (
    <div data-role={role} className={isUser ? "tp-msg tp-msg--user" : "tp-msg"} data-component="CoachMessage">
      <span className="tp-msg__who">
        {isUser ? t("coachChat.you") : t("coach.name")}
        <time className="tp-msg__time tp-num" dateTime={new Date(createdAt).toISOString()}>
          {messageTime(createdAt, lang)}
        </time>
      </span>
      {isUser ? (
        <p className="tp-msg__text" dir="auto">
          {content}
        </p>
      ) : (
        <div className="tp-msg__text tp-msg__md" dir="auto">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a({ href, children }) {
                return (
                  <a href={href} rel="noopener noreferrer nofollow" target="_blank">
                    {children}
                  </a>
                );
              },
              // No remote requests from the thread: show the alt text instead.
              img({ alt }) {
                return <span className="tp-muted">{alt ?? ""}</span>;
              },
              p({ children }) {
                return <p dir="auto">{children}</p>;
              },
              li({ children, className }) {
                return (
                  <li dir="auto" className={className}>
                    {children}
                  </li>
                );
              },
            }}
          >
            {content}
          </Markdown>
        </div>
      )}
      <div className="tp-msg__actions" data-component="MessageActions">
        <button
          className="tp-btn tp-btn--ghost tp-btn--sm"
          type="button"
          onClick={() => void onCopy()}
        >
          {copy === "copied" ? <TpIcon name="check" size="sm" /> : null}
          <span aria-live="polite">
            {copy === "copied" ? t("coachChat.copied") : copy === "error" ? t("coachChat.copyError") : t("coachChat.copy")}
          </span>
        </button>
      </div>
    </div>
  );
}
