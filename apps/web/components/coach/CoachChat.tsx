"use client";

import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { Component, Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrisisResourcesCard } from "@/components/coach-crisis/CrisisResourcesCard";
import { useCrisisGuard } from "@/components/coach-crisis/useCrisisGuard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { pickCoachConversation, replyInFlightUntil } from "@/lib/coach-conversation";
import { searchesLeft, utcDayOf } from "@/lib/coach-sources";
import {
  COACH_FOLLOW_UPS,
  COACH_STARTERS,
  coachThreads,
  dayDividerLabel,
  followUpTarget,
  msUntilNextLocalMidnight,
  newChatAction,
  selectionOnDelete,
  threadTitle,
  withDayDividers,
} from "@/lib/coach-threads";
import { localIsoDate } from "@/lib/period-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { useOnline } from "@/lib/useOnline";
import { intlLocale } from "@/lib/you/screenState";
import { ChatProposal, proposalOf } from "./ChatProposal";
import { CoachThreads } from "./CoachThreads";
import { useFlushCoachPage } from "./CoachPage";
import { CoachSources } from "./CoachSources";
import { VoiceCall } from "./voice/VoiceCall";
import { useVoiceCall, type VoiceSendResult } from "./voice/useVoiceCall";
import { ExecutorLookup, ExecutorLookupCard } from "./ExecutorLookup";

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

/** Two squares, drawn in the v3 icon family (24 grid, 1.5 px line); the sprite has no copy icon. */
function CopyIcon() {
  return (
    <svg className="tp-icon tp-icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

/** Copy under a coach reply (/coach). The page's live region says "Copied" (or why it could not). */
function CopyReply({ text, onResult }: { text: string; onResult: (copied: boolean) => void }) {
  const { t } = useLocale();
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), state === "copied" ? 2000 : 5000);
    return () => window.clearTimeout(timer);
  }, [state]);
  return (
    <>
      <button
        className="tp-btn tp-btn--ghost tp-btn--sm tp-coach-copy"
        type="button"
        data-component="CopyReply"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
            onResult(true);
          } catch {
            setState("error");
            onResult(false);
          }
        }}
      >
        {state === "copied" ? <TpIcon name="check" size="sm" /> : <CopyIcon />}
        <span>{state === "copied" ? t("cc.copied") : t("cc.copy")}</span>
      </button>
      {state === "error" ? <span className="tp-xs tp-muted">{t("cc.copyError")}</span> : null}
    </>
  );
}

/** A part of the page that is extra: if it throws (say its backend isn't deployed yet), it is left out. */
class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * A polite live region with its own state: `handle.current(text)` says `text` (again, when it is the
 * same words as last time) and clears it a few seconds later.
 */
function LiveNote({ handle }: { handle: { current: ((text: string) => void) | null } }) {
  const [note, setNote] = useState("");
  useEffect(() => {
    let frame = 0;
    let timer = 0;
    handle.current = (text: string) => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      setNote("");
      frame = window.requestAnimationFrame(() => setNote(text));
      timer = window.setTimeout(() => setNote(""), 4000);
    };
    return () => {
      handle.current = null;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [handle]);
  return (
    <p className="tp-sr-only" aria-live="polite" data-component="CoachLiveNote">
      {note}
    </p>
  );
}

/**
 * Tells the page whether the coach may search the web for this person right now
 * (`coach.webSearchStatus`: set up, turned on, searches left today). Only the waiting line reads it.
 */
function WebSearchProbe({ onChange }: { onChange: (on: boolean) => void }) {
  const status = useQuery(api.coach.webSearchStatus, { utcDay: utcDayOf(Date.now()) });
  const on = Boolean(status?.available && status.enabled && searchesLeft(status.usedToday, status.dailyLimit) > 0);
  useEffect(() => {
    onChange(on);
  }, [on, onChange]);
  return null;
}

/**
 * The coach conversation (coach.html / coach-thread.html): the thread and the composer, on v3
 * classes. Used by the /coach page, by the coach panel beside any page, and inline on Today; the
 * panel and Today pass the open page's id so the coach reads it. Every reply also sends the local
 * day, so the coach sees today's open tasks ("what order should I do these in?"). The message is
 * saved first; the reply comes from the model through `coach.reply`, with a typing state while it
 * runs (the model seam does not stream).
 *
 * On /coach ("page") the page owns which chat is open (`selection`, from the chats column beside
 * it); with nothing selected it still opens the newest chat, or makes one. Only there does the
 * thread get day dividers, starter cards in an empty chat, Copy under each reply, follow-ups under
 * the newest reply and a worded waiting line. The panel and Today are unchanged.
 */
export function CoachConversation({
  variant,
  pageId = null,
  selection,
}: {
  variant: "page" | "panel" | "today";
  pageId?: string | null;
  /**
   * /coach only: the open chat, how to open another, chats being deleted (never auto-opened), and
   * whether making a fresh chat waits (the last chat is being deleted).
   */
  selection?: {
    id: Id<"conversations"> | null;
    onChange: (id: Id<"conversations">) => void;
    removed: ReadonlySet<string>;
    holdCreate?: boolean;
    /** The automatic first chat could not be made, so the page lets New chat make one. */
    onCreateFailed?: () => void;
  };
}) {
  const { lang, t } = useLocale();
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

  const [ownConversationId, setOwnConversationId] = useState<Id<"conversations"> | null>(null);
  const conversationId = selection ? selection.id : ownConversationId;
  const setConversationId = selection ? selection.onChange : setOwnConversationId;
  const removed = selection?.removed;
  const holdCreate = selection?.holdCreate === true;
  const onCreateFailed = selection?.onCreateFailed;
  // Chats being deleted on /coach are never opened again by the pick below.
  const candidates = useMemo(
    () => (conversations && removed && removed.size > 0 ? conversations.filter((c) => !removed.has(c._id)) : conversations),
    [conversations, removed],
  );
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [crisisHold, setCrisisHold] = useState(false);
  const [replying, setReplying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [pageUnsaved, setPageUnsaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Once the list shows a conversation the shared create is done with: a later create (every chat
  // deleted on /coach) makes a new one instead of reopening the first.
  useEffect(() => {
    if (profile && conversations?.some((c) => c.chatMode !== "agent")) creating.delete(profile._id);
  }, [profile, conversations]);

  useEffect(() => {
    if (!isAuthenticated || candidates === undefined || conversationId) return;
    const latest = pickCoachConversation(candidates);
    if (latest) {
      setConversationId(latest._id);
      return;
    }
    if (!profile || holdCreate) return;
    let pending = creating.get(profile._id);
    if (!pending) {
      pending = createConversation({});
      creating.set(profile._id, pending);
      // A failed create can be tried again; a made one stays shared until the list shows it.
      pending.catch(() => creating.delete(profile._id));
    }
    let live = true;
    void pending.then(
      (id) => {
        if (live) setConversationId(id);
      },
      () => {
        if (live) onCreateFailed?.();
      },
    );
    return () => {
      live = false;
    };
  }, [isAuthenticated, profile, candidates, conversationId, createConversation, setConversationId, holdCreate, onCreateFailed]);

  // The panel puts the cursor in the composer as soon as the conversation can take a message.
  useEffect(() => {
    if (variant === "panel" && conversationId) inputRef.current?.focus();
  }, [variant, conversationId]);

  const messages = useQuery(api.messages.list, conversationId ? { conversationId } : "skip");

  useEffect(() => {
    // Inline on Today the thread scrolls inside its own box: the page itself never jumps.
    if (variant === "today") {
      const thread = threadRef.current;
      if (thread) thread.scrollTop = thread.scrollHeight;
      return;
    }
    // An empty chat on /coach starts at its starter cards' heading, not scrolled past it.
    if (variant === "page" && messages?.length === 0) {
      if (threadRef.current) threadRef.current.scrollTop = 0;
      return;
    }
    bottomRef.current?.scrollIntoView({ block: "end" });
  });

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
  // Voice never reads out a lookup answer: it names apps from Executor (TEMPO-B07-08).
  const lastAssistant = [...(messages ?? [])].reverse().find((m) => m.role === "assistant" && m.modelUsed !== "crisis-card" && m.modelUsed !== "executor-lookup");
  // A reply asked for by another surface (the panel beside Today's chat, another tab) holds this
  // conversation's turn too: wait for it here, so a newer message can't make its answer be dropped.
  const inFlightUntil = replyInFlightUntil(messages?.at(-1), Date.now());
  const voice = useVoiceCall({
    conversationId,
    send: sendSpoken,
    latestReply: lastAssistant ? { id: lastAssistant._id, content: lastAssistant.content } : null,
    replyInFlight: inFlightUntil !== null,
  });

  // The one send path: the composer, and on /coach a starter card or a follow-up (`fromComposer`
  // false). A picked text that didn't send lands in an empty composer, so it is still there to retry.
  const deliver = async (text: string, fromComposer: boolean) => {
    if (!text || !conversationId || isSending || replying || waitingForPage) return;
    if (fromComposer) setInput("");
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
      setIsSending(false);
      await reply(conversationId);
    } catch {
      if (fromComposer) setInput(text);
      else setInput((current) => (current.trim() ? current : text));
      setSendError(t("coachChat.sendError"));
    } finally {
      setIsSending(false);
    }
  };
  const handleSend = () => deliver(input.trim(), true);

  const isLoading =
    isAuthenticated && (conversations === undefined || !conversationId || messages === undefined);
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

  // /coach only, below: Copy, follow-ups, day dividers, starters and the worded waiting line.
  const onPage = variant === "page";
  const followUpId = onPage ? followUpTarget(messages, { busy, crisisHold }) : null;
  const [webSearchOn, setWebSearchOn] = useState(false);
  // The day dividers' clock: one timer, re-armed for each next local midnight, so a page left open
  // overnight relabels "Today" as "Yesterday".
  const [dayNow, setDayNow] = useState(() => Date.now());
  useEffect(() => {
    if (!onPage) return;
    const timer = window.setTimeout(() => setDayNow(Date.now()), msUntilNextLocalMidnight(dayNow));
    return () => window.clearTimeout(timer);
  }, [onPage, dayNow]);
  // Copy's "Copied" goes to a live region that owns its own state, so a copy never re-renders (and
  // so never scrolls) the thread.
  const noteRef = useRef<((text: string) => void) | null>(null);
  const announceCopy = useCallback((copied: boolean) => noteRef.current?.(t(copied ? "cc.copied" : "cc.copyError")), [t]);
  const pickDisabled = !conversationId || busy || waitingForPage;

  const renderMessage = (message: NonNullable<typeof messages>[number]) => {
    const proposal = message.role === "assistant" ? proposalOf(message.toolCalls) : null;
    return (
      <Fragment key={message._id}>
        <div
          data-role={message.role}
          className={message.role === "user" ? "tp-msg tp-msg--user" : "tp-msg"}
          data-component="CoachMessage"
        >
          <span className="tp-msg__who">{message.role === "user" ? t("coachChat.you") : t("coach.name")}</span>
          <p className="tp-msg__text" dir="auto">
            {message.content}
          </p>
        </div>
        {onPage && message.role === "assistant" ? (
          <div className="tp-coach-msg-actions" aria-live="off">
            <CopyReply text={message.content} onResult={announceCopy} />
          </div>
        ) : null}
        {message.role === "assistant" ? <CoachSources content={message.content} sources={message.sources} /> : null}
        {proposal ? <ChatProposal messageId={message._id} proposal={proposal} /> : null}
        {message.role === "assistant" ? <ExecutorLookupCard toolCalls={message.toolCalls} /> : null}
        {message._id === followUpId ? (
          <ul className="tp-coach-followups" aria-label={t("cc.followLabel")} aria-live="off" data-component="CoachFollowUps">
            {COACH_FOLLOW_UPS.map((key) => (
              <li key={key}>
                <button
                  className="tp-btn tp-btn--secondary tp-btn--sm tp-coach-followup"
                  type="button"
                  disabled={pickDisabled}
                  onClick={() => void deliver(t(key), false)}
                >
                  <TpIcon name="arrow" size="sm" flip />
                  <span>{t(key)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Fragment>
    );
  };

  return (
    <>
      <div ref={threadRef} className="tp-coach-thread" data-component="CoachThread" data-variant={variant} aria-live="polite">
        {isLoading ? (
          <p className="tp-muted tp-small">{t("coachChat.loading")}</p>
        ) : shown && shown.length === 0 ? (
          variant === "today" ? null : onPage && !crisisHold ? (
            <div className="tp-coach-start" data-component="CoachStarters">
              <h2 className="tp-coach-start__title">{t("cc.startTitle")}</h2>
              <p className="tp-muted tp-small">{t("coachChat.empty")}</p>
              <ul className="tp-coach-starters">
                {COACH_STARTERS.map((starter) => (
                  <li key={starter.label}>
                    <button
                      className="tp-coach-starter"
                      type="button"
                      disabled={pickDisabled}
                      onClick={() => void deliver(t(starter.label), false)}
                    >
                      <span className="tp-coach-starter__label">{t(starter.label)}</span>
                      <span className="tp-coach-starter__hint">{t(starter.hint)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="tp-muted">{t("coachChat.empty")}</p>
          )
        ) : onPage && shown ? (
          withDayDividers(shown, dayNow).map((item) =>
            item.type === "day" ? (
              <p key={`day-${item.key}`} className="tp-coach-day" data-component="CoachDayDivider">
                <span>{dayDividerLabel(item, intlLocale(lang), { today: t("cc.today"), yesterday: t("cc.yesterday") }, dayNow)}</span>
              </p>
            ) : (
              renderMessage(item.message)
            ),
          )
        ) : (
          shown?.map(renderMessage)
        )}
        {crisisHold ? <CoachCrisisReply /> : null}
        {busy ? (
          <output aria-label={t("coachChat.typing")} className="tp-msg tp-muted" data-component="CoachTyping">
            {onPage ? (
              <span className="tp-coach-working">
                <span className="tp-typing">
                  <span className="tp-typing__dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>{t("cc.working")}</span>
                </span>
                {webSearchOn ? <span className="tp-xs">{t("cc.workingWeb")}</span> : null}
              </span>
            ) : (
              "…"
            )}
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
        {variant === "today" ? null : <div ref={bottomRef} />}
      </div>
      {onPage ? <LiveNote handle={noteRef} /> : null}
      {onPage && isAuthenticated && profile ? (
        <QuietBoundary>
          <WebSearchProbe onChange={setWebSearchOn} />
        </QuietBoundary>
      ) : null}
      {conversationId && variant !== "today" ? <ExecutorLookup conversationId={conversationId} disabled={busy || waitingForPage} /> : null}

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
            placeholder={variant === "today" ? t("today.chat.placeholder") : t("coachChat.placeholder")}
            maxLength={MAX_MESSAGE_CHARS}
            disabled={!conversationId || busy || waitingForPage}
          />
          <div className="tp-composer__bar">
            {/* A keyboard hint: on phones and touch screens it only squeezes the buttons. */}
            <span className="tp-muted tp-small max-sm:hidden pointer-coarse:hidden">{t("coachChat.hint")}</span>
            {voiceAvailability?.available ? (
              <button
                className="tp-btn tp-btn--ghost tp-btn--sm"
                type="button"
                style={{ marginInlineStart: "auto" }}
                disabled={!conversationId || busy || waitingForPage || voice.open}
                onClick={() => void voice.start()}
                data-component="VoiceStart"
              >
                <TpIcon name="mic" size="sm" />
                <span>{t("coachChat.talk")}</span>
              </button>
            ) : null}
            <button
              className="tp-btn tp-btn--primary tp-btn--sm"
              type="submit"
              style={voiceAvailability?.available ? undefined : { marginInlineStart: "auto" }}
              disabled={!conversationId || busy || waitingForPage || !input.trim()}
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

function useMaxWidth(px: number): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${px}px)`);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [px]);
  return matches;
}

/**
 * If the open chat stops loading because it is gone (deleted in another tab), the page opens
 * another one instead of breaking; any other failure keeps a quiet line and stays put.
 */
class ThreadBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The /coach page: the chats column (CoachThreads) and the conversation on paper, with the page
 * title the shell's main holds. The page owns which chat is open; with none chosen the
 * conversation opens the newest (or makes one) and reports it back. New chat makes a chat and
 * opens it, unless the open one is still empty; it waits while no chat is open yet. Deleting the
 * open chat opens the newest of the rest, or, once the delete is done, a fresh empty one when none
 * is left.
 */
export function CoachChat() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const conversations = useQuery(api.conversations.list, isAuthenticated && profile ? {} : "skip");
  const createConversation = useMutation(api.conversations.create);
  const removeConversation = useMutation(api.conversations.remove);
  const narrow = useMaxWidth(1023);
  const [selectedId, setSelectedId] = useState<Id<"conversations"> | null>(null);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  // Deletes that leave no chat open; while any runs, the conversation makes no fresh chat.
  const [holdingDeletes, setHoldingDeletes] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  // The automatic first chat failed to be made: New chat makes one instead of waiting for it.
  const [autoCreateFailed, setAutoCreateFailed] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [focusComposer, setFocusComposer] = useState(0);
  const chatsButton = useRef<HTMLButtonElement | null>(null);
  const seen = useRef(new Set<string>());
  // Bumped by every chat the person opens here (pick, New chat, delete), so a delete that fails
  // late only reopens its chat when nothing newer was opened meanwhile.
  const selectionVersion = useRef(0);
  const choose = (id: Id<"conversations"> | null) => {
    selectionVersion.current += 1;
    setSelectedId(id);
  };

  const threads = useMemo(
    () => (conversations === undefined ? undefined : coachThreads(conversations).filter((c) => !removed.has(c._id))),
    [conversations, removed],
  );
  const current = threads?.find((thread) => thread._id === selectedId);

  // A chat deleted somewhere else (another tab) closes here too, and the newest one opens.
  useEffect(() => {
    if (!conversations) return;
    const live = new Set<string>(conversations.map((c) => c._id));
    if (selectedId && seen.current.has(selectedId) && !live.has(selectedId)) {
      setRemoved((prev) => new Set(prev).add(selectedId));
      setSelectedId(null);
    }
    for (const id of live) seen.current.add(id);
  }, [conversations, selectedId]);

  useEffect(() => {
    if (focusComposer > 0) document.getElementById("coach-message")?.focus();
  }, [focusComposer]);

  // Once a chat is open the failed automatic create no longer matters.
  useEffect(() => {
    if (selectedId) setAutoCreateFailed(false);
  }, [selectedId]);

  const onCreateFailed = useCallback(() => {
    setAutoCreateFailed(true);
    setNewError(t("cc.newError"));
  }, [t]);

  // The drawer is only a drawer under 1024 px; widening the window puts the column back.
  useEffect(() => {
    if (!narrow) setDrawerOpen(false);
  }, [narrow]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => chatsButton.current?.focus());
  }, []);

  const select = (id: Id<"conversations">) => {
    choose(id);
    if (narrow && drawerOpen) closeDrawer();
  };

  const handleNew = async () => {
    setNewError(null);
    const action = newChatAction(current, selectedId, autoCreateFailed);
    // The first chat is still being opened or made: making another here would leave two.
    if (action === "wait") return;
    // An empty chat is already a new chat: go to its composer instead of making another.
    if (action === "focus") {
      setDrawerOpen(false);
      setFocusComposer((n) => n + 1);
      return;
    }
    setCreatingNew(true);
    try {
      const id = await createConversation({});
      choose(id);
      setDrawerOpen(false);
      setFocusComposer((n) => n + 1);
    } catch {
      setNewError(t("cc.newError"));
    } finally {
      setCreatingNew(false);
    }
  };

  const handleDelete = async (id: Id<"conversations">) => {
    const wasOpen = selectedId === id;
    const { next, holdCreate } = selectionOnDelete(threads ?? [], id, selectedId);
    // Leave the chat before it is deleted, so nothing on screen reads a deleted chat. With no chat
    // left open, the fresh one waits until the delete is done.
    setRemoved((prev) => new Set(prev).add(id));
    if (holdCreate) setHoldingDeletes((n) => n + 1);
    if (wasOpen) choose(next);
    const version = selectionVersion.current;
    try {
      await removeConversation({ conversationId: id });
    } catch (error) {
      setRemoved((prev) => {
        const rest = new Set(prev);
        rest.delete(id);
        return rest;
      });
      if (wasOpen && selectionVersion.current === version) choose(id);
      throw error;
    } finally {
      if (holdCreate) setHoldingDeletes((n) => n - 1);
    }
  };

  const onThreadError = () => {
    if (selectedId && conversations && !conversations.some((c) => c._id === selectedId)) {
      setRemoved((prev) => new Set(prev).add(selectedId));
      setSelectedId(null);
    }
  };

  const title = threadTitle(current?.title, t("cc.untitled"));
  const newChatWaits = newChatAction(current, selectedId, autoCreateFailed) === "wait";

  return (
    <div className="tp-page" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <span className="tp-eyebrow">{t("coachChat.eyebrow")}</span>
          <h1 className="tp-pagehead__title">{t("coach.name")}</h1>
          <p className="tp-pagehead__sub">{t("coachChat.sub")}</p>
        </div>
      </header>
      <div className="tp-coach-layout" data-component="CoachLayout">
        <CoachThreads
          threads={authLoading ? undefined : isAuthenticated ? threads : []}
          selectedId={selectedId}
          searchReady={Boolean(isAuthenticated && profile)}
          creating={creatingNew || newChatWaits}
          newError={newError}
          drawer={narrow}
          open={drawerOpen}
          onSelect={select}
          onNew={() => void handleNew()}
          onDelete={handleDelete}
          onClose={closeDrawer}
        />
        <section className="tp-surface tp-coach-page" style={{ padding: 0, gap: 0 }} aria-label={t("coach.name")}>
          <div className="tp-coach-chathead" data-component="CoachChatHeader">
            <button
              ref={chatsButton}
              className="tp-btn tp-btn--ghost tp-btn--sm tp-coach-chathead__chats"
              type="button"
              aria-expanded={drawerOpen}
              aria-controls="coach-threads"
              onClick={() => setDrawerOpen(true)}
            >
              <TpIcon name="sidebar" size="sm" />
              <span>{t("cc.chats")}</span>
            </button>
            <p className="tp-coach-chathead__title" dir="auto">
              {title}
            </p>
            <button
              className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon tp-coach-chathead__new"
              type="button"
              aria-label={t("cc.newChat")}
              title={t("cc.newChat")}
              disabled={creatingNew || newChatWaits}
              onClick={() => void handleNew()}
            >
              <TpIcon name="plus" size="sm" />
            </button>
          </div>
          <ThreadBoundary
            key={selectedId ?? "newest"}
            onError={onThreadError}
            fallback={<p className="tp-muted tp-small tp-coach-thread">{t("cc.threadError")}</p>}
          >
            <CoachConversation
              variant="page"
              selection={{ id: selectedId, onChange: setSelectedId, removed, holdCreate: holdingDeletes > 0, onCreateFailed }}
            />
          </ThreadBoundary>
        </section>
      </div>
    </div>
  );
}
