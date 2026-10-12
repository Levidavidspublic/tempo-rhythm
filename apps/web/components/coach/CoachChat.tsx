"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { CrisisResourcesCard } from "@/components/coach-crisis/CrisisResourcesCard";
import { useCrisisGuard } from "@/components/coach-crisis/useCrisisGuard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type CoachDelivery = "resources" | "sent";

/** Crisis matches show the resources card and never call the coaching send. */
export async function deliverCoachMessage(
  text: string,
  guard: (text: string) => Promise<{ isCrisis: boolean }>,
  send: (text: string) => Promise<void>,
): Promise<CoachDelivery> {
  const result = await guard(text);
  if (result.isCrisis) return "resources";
  await send(text);
  return "sent";
}

export function CoachCrisisReply() {
  return (
    <div data-testid="coach-crisis-resources">
      <CrisisResourcesCard />
    </div>
  );
}

/**
 * The coach conversation (coach.html / coach-thread.html): the thread and the composer, on v3
 * classes. Used by the /coach page and by the coach panel beside any page.
 */
export function CoachConversation({ variant }: { variant: "page" | "panel" }) {
  const { t } = useLocale();
  const { isAuthenticated } = useConvexAuth();
  // conversations.list calls requireUser: wait for the users row (getProfile is null until then).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const conversations = useQuery(api.conversations.list, isAuthenticated && profile ? {} : "skip");
  const createConversation = useMutation(api.conversations.create);
  const sendMessage = useMutation(api.coach.sendMessage);
  const { guard } = useCrisisGuard();

  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [crisisHold, setCrisisHold] = useState(false);
  const creatingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated || conversations === undefined || conversationId) return;
    const latest = conversations[0];
    if (latest) {
      setConversationId(latest._id);
      return;
    }
    if (creatingRef.current) return;
    creatingRef.current = true;
    void createConversation({}).then((id) => {
      setConversationId(id);
      creatingRef.current = false;
    });
  }, [isAuthenticated, conversations, conversationId, createConversation]);

  // The panel puts the cursor in the composer as soon as the conversation can take a message.
  useEffect(() => {
    if (variant === "panel" && conversationId) inputRef.current?.focus();
  }, [variant, conversationId]);

  const messages = useQuery(api.messages.list, conversationId ? { conversationId } : "skip");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  });

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversationId || isSending) return;
    setInput("");
    setIsSending(true);
    try {
      const outcome = await deliverCoachMessage(text, guard, async (content) => {
        await sendMessage({ conversationId, content });
      });
      if (outcome === "resources") {
        setCrisisHold(true);
        setSendError(null);
        return;
      }
      setCrisisHold(false);
      setSendError(null);
    } catch {
      setInput(text);
      setSendError(t("coachChat.sendError"));
    } finally {
      setIsSending(false);
    }
  };

  const isLoading =
    isAuthenticated && (conversations === undefined || !conversationId || messages === undefined);
  const inputId = variant === "page" ? "coach-message" : "coach-panel-message";

  return (
    <>
      <div className="tp-coach-thread" data-component="CoachThread" aria-live="polite">
        {isLoading ? (
          <p className="tp-muted tp-small">{t("coachChat.loading")}</p>
        ) : messages && messages.length === 0 ? (
          <p className="tp-muted">{t("coachChat.empty")}</p>
        ) : (
          messages?.map((message) => (
            <div
              key={message._id}
              data-role={message.role}
              className={message.role === "user" ? "tp-msg tp-msg--user" : "tp-msg"}
              data-component="CoachMessage"
            >
              <span className="tp-msg__who">{message.role === "user" ? t("coachChat.you") : t("coach.name")}</span>
              <p className="tp-msg__text" dir="auto">
                {message.content}
              </p>
            </div>
          ))
        )}
        {crisisHold ? <CoachCrisisReply /> : null}
        {isSending ? (
          <output aria-label={t("coachChat.typing")} className="tp-msg tp-muted">
            …
          </output>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="tp-composer"
        data-component="Composer"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <div className="tp-composer__box">
          <label className="tp-sr-only" htmlFor={inputId}>
            {t("coachChat.message")}
          </label>
          <textarea
            ref={inputRef}
            id={inputId}
            aria-label={t("coachChat.message")}
            className="tp-composer__input"
            dir="auto"
            rows={2}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (sendError) setSendError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder={t("coachChat.placeholder")}
            disabled={!conversationId || isSending}
          />
          <div className="tp-composer__bar">
            <span className="tp-muted tp-small">{t("coachChat.hint")}</span>
            <button
              className="tp-btn tp-btn--primary tp-btn--sm"
              type="submit"
              style={{ marginInlineStart: "auto" }}
              disabled={!conversationId || isSending || !input.trim()}
            >
              <TpIcon name="send" size="sm" />
              <span>{t("coachChat.send")}</span>
            </button>
          </div>
        </div>
        {sendError ? (
          <p role="alert" className="tp-small" style={{ color: "var(--tp-danger)" }}>
            {sendError}
          </p>
        ) : null}
      </form>
    </>
  );
}

/** The /coach page: the conversation on paper, with the page title the shell's main holds. */
export function CoachChat() {
  const { t } = useLocale();
  return (
    <div className="tp-page" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <span className="tp-eyebrow">{t("coachChat.eyebrow")}</span>
          <h1 className="tp-pagehead__title">{t("coach.name")}</h1>
          <p className="tp-pagehead__sub">{t("coachChat.sub")}</p>
        </div>
      </header>
      <section className="tp-surface" style={{ padding: 0, gap: 0 }} aria-label={t("coach.name")}>
        <CoachConversation variant="page" />
      </section>
    </div>
  );
}
