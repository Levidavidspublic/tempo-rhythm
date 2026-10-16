"use client";

import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CrisisResourcesCard } from "@/components/coach-crisis/CrisisResourcesCard";
import { useCrisisGuard } from "@/components/coach-crisis/useCrisisGuard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { pickCoachConversation, replyInFlightUntil } from "@/lib/coach-conversation";
import { charsLeft, composerHeight, isNearBottom } from "@/lib/coach-thread";
import { localIsoDate } from "@/lib/period-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { useOnline } from "@/lib/useOnline";
import { ChatProposal, proposalOf } from "./ChatProposal";
import { CoachMessage } from "./CoachMessage";
import { useFlushCoachPage } from "./CoachPage";
import { VoiceCall } from "./voice/VoiceCall";
import { useVoiceCall, type VoiceSendResult } from "./voice/useVoiceCall";

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

/** Longest message the coach takes (convex/coach.ts MAX_MESSAGE_CHARS). */
const MAX_MESSAGE_CHARS = 4000;

/** Today shows only the newest turns; the whole thread is on /coach. */
const TODAY_MESSAGES = 6;

/**
 * A first conversation being created, per person. Today's chat and the coach panel can be on
 * screen together; both wait on one create instead of each making its own thread.
 */
const creating = new Map<string, Promise<Id<"conversations">>>();

/**
 * The coach conversation (coach.html / coach-thread.html): the thread and the composer, on v3
 * classes. Used by the /coach page, by the coach panel beside any page, and inline on Today; the
 * panel and Today pass the open page's id so the coach reads it. Every reply also sends the local
 * day, so the coach sees today's open tasks ("what order should I do these in?"). The message is
 * saved first; the reply comes from the model through `coach.reply`, with a typing state while it
 * runs (the model seam does not stream).
 *
 * Chat conventions (ideas shared with Open WebUI and most chat apps; no code taken from them):
 * the thread follows new messages only while you are at the bottom, otherwise a "Jump to the
 * latest" button appears; the composer grows with the text; an empty chat offers starters that
 * fill the composer (they never send by themselves); each message can be copied.
 */
export function CoachConversation({
  variant,
  pageId = null,
}: {
  variant: "page" | "panel" | "today";
  pageId?: string | null;
}) {
  const { t } = useLocale();
  const { isAuthenticated } = useConvexAuth();
  // conversations.list calls requireUser: wait for the users row (getProfile is null until then).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const conversations = useQuery(api.conversations.list, isAuthenticated && profile ? {} : "skip");
  const createConversation = useMutation(api.conversations.create);
  const sendMessage = useMutation(api.coach.sendMessage);
  const requestReply = useAction(api.coach.reply);
  const flushPage = useFlushCoachPage();
  const { guard } = useCrisisGuard();
  const bounds = useLocalDayBounds();
  // Today's chat answers with today's page as context: it waits until that page is on screen.
  const waitingForPage = variant === "today" && !pageId;
  const online = useOnline();
  // Voice mode shows only when the server says it can start (both keys set, an English lane,
  // minutes left today); otherwise the composer is unchanged.
  const voiceAvailability = useQuery(api.voice.availability, isAuthenticated && profile ? {} : "skip");

  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  // A first conversation that couldn't be made: say so and offer Try again (bumps `createTry`).
  const [createError, setCreateError] = useState(false);
  const [createTry, setCreateTry] = useState(0);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [crisisHold, setCrisisHold] = useState(false);
  const [replying, setReplying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [pageUnsaved, setPageUnsaved] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // True while the reader is at the bottom of the thread: only then does it follow new messages.
  const stuck = useRef(true);
  const [newBelow, setNewBelow] = useState(false);
  // The composer is disabled while a reply runs, which drops focus: give it back afterwards.
  const refocus = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: createTry re-runs the create after Try again
  useEffect(() => {
    if (!isAuthenticated || conversations === undefined || conversationId) return;
    const latest = pickCoachConversation(conversations);
    if (latest) {
      setConversationId(latest._id);
      return;
    }
    if (!profile) return;
    let pending = creating.get(profile._id);
    if (!pending) {
      pending = createConversation({});
      creating.set(profile._id, pending);
      // A failed create can be tried again; a made one stays shared until the list shows it.
      pending.catch(() => creating.delete(profile._id));
    }
    let live = true;
    setCreateError(false);
    void pending.then(
      (id) => {
        if (live) setConversationId(id);
      },
      () => {
        if (live) setCreateError(true);
      },
    );
    return () => {
      live = false;
    };
  }, [isAuthenticated, profile, conversations, conversationId, createConversation, createTry]);

  // The panel puts the cursor in the composer as soon as the conversation can take a message.
  useEffect(() => {
    if (variant === "panel" && conversationId) inputRef.current?.focus();
  }, [variant, conversationId]);

  const messages = useQuery(api.messages.list, conversationId ? { conversationId } : "skip");

  // The thread scrolls inside its own box on every surface, so the page itself never jumps.
  const toBottom = useCallback(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
    stuck.current = true;
    setNewBelow(false);
  }, []);
  const onThreadScroll = () => {
    const thread = threadRef.current;
    if (!thread) return;
    stuck.current = isNearBottom(thread);
    if (stuck.current) setNewBelow(false);
  };

  // A failed or missing reply never throws past here: the message is saved, and the thread says so.
  // True only when the coach wrote a reply to this turn.
  const reply = async (id: Id<"conversations">): Promise<boolean> => {
    setReplying(true);
    setUnavailable(false);
    setPageUnsaved(false);
    try {
      // The page saves 500 ms after typing stops; save it now so the coach reads what is on screen.
      // If that save fails, the coach waits instead of answering from the older page.
      if (pageId) {
        try {
          await flushPage();
        } catch {
          setPageUnsaved(true);
          return false;
        }
      }
      const result = await requestReply({
        conversationId: id,
        ...(pageId ? { noteId: pageId as Id<"notes"> } : {}),
        dayStartMs: bounds.startMs,
        dayEndMs: bounds.endMs,
        todayDate: localIsoDate(new Date(bounds.startMs)),
      });
      setUnavailable(result.status === "unavailable");
      return result.status === "replied";
    } catch {
      setUnavailable(true);
      return false;
    } finally {
      setReplying(false);
    }
  };

  // A spoken turn takes the typed path: the crisis guard first, then the coach (VOICE.md L-16).
  const sendSpoken = async (text: string): Promise<VoiceSendResult> => {
    if (!conversationId) return { kind: "none" };
    let serverCrisis = false;
    const outcome = await deliverCoachMessage(text, guard, async (content) => {
      const result = await sendMessage({ conversationId, content });
      serverCrisis = result.crisis === true;
    });
    if (outcome === "resources") {
      setCrisisHold(true);
      return { kind: "crisis" };
    }
    setCrisisHold(false);
    if (serverCrisis) return { kind: "crisis" };
    // No reply written (page unsaved, coach unavailable, another reply in flight): the call goes
    // back to listening instead of waiting for a message that won't come.
    return (await reply(conversationId)) ? { kind: "reply" } : { kind: "none" };
  };
  const lastAssistant = [...(messages ?? [])].reverse().find((m) => m.role === "assistant" && m.modelUsed !== "crisis-card");
  // A reply asked for by another surface (the panel beside Today's chat, another tab) holds this
  // conversation's turn too: wait for it here, so a newer message can't make its answer be dropped.
  const inFlightUntil = replyInFlightUntil(messages?.at(-1), Date.now());
  const voice = useVoiceCall({
    conversationId,
    send: sendSpoken,
    latestReply: lastAssistant ? { id: lastAssistant._id, content: lastAssistant.content } : null,
    replyInFlight: inFlightUntil !== null,
  });

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversationId || isSending || replying || waitingForPage) return;
    setInput("");
    setIsSending(true);
    toBottom();
    refocus.current = document.activeElement === inputRef.current;
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
      setIsSending(false);
      await reply(conversationId);
    } catch {
      setInput(text);
      setSendError(t("coachChat.sendError"));
    } finally {
      setIsSending(false);
    }
  };

  const isLoading =
    isAuthenticated && !createError && (conversations === undefined || !conversationId || messages === undefined);
  const inputId = variant === "page" ? "coach-message" : variant === "panel" ? "coach-panel-message" : "today-coach-message";
  const shown = variant === "today" ? messages?.slice(-TODAY_MESSAGES) : messages;
  const busy = isSending || replying || inFlightUntil !== null;
  // A reply that runs past the wait (its action died) gets Try again without a new message.
  const [, setWaitedOut] = useState(0);
  useEffect(() => {
    if (inFlightUntil === null) return;
    const timer = window.setTimeout(() => setWaitedOut((n) => n + 1), Math.max(0, inFlightUntil - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [inFlightUntil]);
  // The newest message is the user's and no reply is on its way: a reply failed, or the page
  // reloaded while one was running. Either way the message is saved and can be answered again.
  const waiting = !busy && !crisisHold && messages !== undefined && messages.at(-1)?.role === "user";
  const shownCount = shown?.length ?? 0;
  const lastShownId = shown?.at(-1)?._id;

  // Something new at the end (a message, the typing line, a crisis card or Try again): follow it
  // when the reader is at the bottom, otherwise offer the jump instead of pulling them down.
  // biome-ignore lint/correctness/useExhaustiveDependencies: these values are the "something new" signals
  useLayoutEffect(() => {
    if (stuck.current) toBottom();
    else setNewBelow(true);
  }, [shownCount, lastShownId, busy, crisisHold, waiting, toBottom]);

  // The composer grows with its text up to its largest height, then scrolls.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useLayoutEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${composerHeight(box.scrollHeight)}px`;
  }, [input]);
  const left = charsLeft(input.length, MAX_MESSAGE_CHARS);

  useEffect(() => {
    if (busy || !refocus.current) return;
    refocus.current = false;
    inputRef.current?.focus();
  }, [busy]);

  return (
    <>
      <div
        ref={threadRef}
        className="tp-coach-thread"
        data-component="CoachThread"
        data-variant={variant}
        role="log"
        aria-label={t("coach.name")}
        onScroll={onThreadScroll}
      >
        {createError && !conversationId ? (
          <div className="tp-notice" data-tone="caution" role="alert" data-component="CoachCreateError">
            <span className="tp-notice__icon">
              <TpIcon name="alert" size="sm" />
            </span>
            <span className="tp-notice__text">{t("coachChat.createError")}</span>
            <span className="tp-notice__action">
              <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" onClick={() => setCreateTry((n) => n + 1)}>
                <TpIcon name="refresh" size="sm" />
                <span>{t("coachChat.retry")}</span>
              </button>
            </span>
          </div>
        ) : isLoading ? (
          <div className="tp-coach-thread__loading" data-component="CoachLoading">
            <span className="tp-sr-only">{t("coachChat.loading")}</span>
            <span className="tp-skeleton" aria-hidden="true" />
            <span className="tp-skeleton" aria-hidden="true" />
            <span className="tp-skeleton" aria-hidden="true" />
          </div>
        ) : shown && shown.length === 0 ? (
          variant === "today" ? null : (
            <div className="tp-coach-start" data-component="CoachEmpty">
              <p className="tp-muted">{t("coachChat.empty")}</p>
              {conversationId ? (
                <div className="tp-coach-start__list">
                  <span className="tp-small tp-muted">{t("coachChat.suggestLead")}</span>
                  {(["coachChat.suggest1", "coachChat.suggest2", "coachChat.suggest3"] as const).map((key) => (
                    <button
                      key={key}
                      className="tp-btn tp-btn--secondary tp-btn--sm tp-coach-start__item"
                      type="button"
                      disabled={busy || waitingForPage}
                      onClick={() => {
                        setInput(t(key));
                        inputRef.current?.focus();
                      }}
                    >
                      <TpIcon name="sparkle" size="sm" />
                      <span>{t(key)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        ) : (
          shown?.map((message) => {
            const proposal = message.role === "assistant" ? proposalOf(message.toolCalls) : null;
            return (
              <Fragment key={message._id}>
                <CoachMessage
                  role={message.role === "user" ? "user" : "assistant"}
                  content={message.content}
                  createdAt={message._creationTime}
                />
                {proposal ? <ChatProposal messageId={message._id} proposal={proposal} /> : null}
              </Fragment>
            );
          })
        )}
        {crisisHold ? <CoachCrisisReply /> : null}
        {busy ? (
          <output aria-label={t("coachChat.typing")} className="tp-msg tp-typing" data-component="CoachTyping">
            <span className="tp-typing__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>{t("coachChat.typing")}</span>
          </output>
        ) : null}
        {waiting && conversationId ? (
          <div className="tp-msg tp-muted" data-component="CoachUnavailable">
            <p className="tp-msg__text">
              {pageUnsaved ? t("coachChat.pageUnsaved") : unavailable ? t("coachChat.unavailable") : t("coachChat.noReply")}
            </p>
            <div className="tp-msg__actions">
              <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" onClick={() => void reply(conversationId)}>
                <TpIcon name="refresh" size="sm" />
                <span>{t("coachChat.retry")}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {newBelow ? (
        <div className="tp-coach-jump">
          <button className="tp-btn tp-btn--secondary tp-btn--sm" type="button" onClick={toBottom} data-component="JumpToLatest">
            <TpIcon name="down" size="sm" />
            <span>{t("coachChat.jumpLatest")}</span>
          </button>
        </div>
      ) : null}

      <form
        className="tp-composer"
        data-component="Composer"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        {online ? null : (
          <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
            <span className="tp-notice__icon">
              <TpIcon name="wifi-off" size="sm" />
            </span>
            <span className="tp-notice__text">{t("coachChat.offline")}</span>
          </output>
        )}
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
            placeholder={variant === "today" ? t("today.chat.placeholder") : t("coachChat.placeholder")}
            maxLength={MAX_MESSAGE_CHARS}
            disabled={!conversationId || busy || waitingForPage}
          />
          <div className="tp-composer__bar">
            {/* A keyboard hint: on phones and touch screens it only squeezes the buttons. */}
            <span className="tp-muted tp-small max-sm:hidden pointer-coarse:hidden">{t("coachChat.hint")}</span>
            {left !== null ? (
              <span className="tp-composer__count tp-small tp-muted" aria-live="polite">
                {t("coachChat.charsLeft").replace("{n}", String(left))}
              </span>
            ) : null}
            <span className="tp-composer__actions">
              {voiceAvailability?.available ? (
                <button
                  className="tp-btn tp-btn--ghost tp-btn--sm"
                  type="button"
                  disabled={!conversationId || busy || waitingForPage || voice.open}
                  onClick={() => void voice.start()}
                  data-component="VoiceStart"
                >
                  <TpIcon name="mic" size="sm" />
                  <span>{t("coachChat.talk")}</span>
                </button>
              ) : null}
              {/* Send is ink, not accent (DESIGN.md §9 Composer): the accent stays for the page's one primary action. */}
              <button
                className="tp-btn tp-btn--sm tp-composer__send"
                type="submit"
                disabled={!conversationId || busy || waitingForPage || !input.trim()}
              >
                <TpIcon name="send" size="sm" />
                <span>{t("coachChat.send")}</span>
              </button>
            </span>
          </div>
        </div>
        {sendError ? (
          <p role="alert" className="tp-error-text">
            <TpIcon name="alert" size="sm" />
            <span>{sendError}</span>
          </p>
        ) : null}
      </form>
      {voice.open ? (
        <VoiceCall
          open={voice.open}
          session={voice.session}
          connecting={voice.connecting}
          ended={voice.ended}
          online={online}
          micOn={voice.micOn}
          lines={voice.lines}
          callLang="en"
          minutesLeft={voice.minutesLeft}
          onMicToggle={voice.toggleMic}
          onInterrupt={voice.interrupt}
          onEnd={voice.end}
          onClose={voice.close}
          onRetry={() => void voice.start()}
        />
      ) : null}
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
      <section className="tp-surface tp-coach-page" aria-label={t("coach.name")}>
        <CoachConversation variant="page" />
      </section>
    </div>
  );
}
