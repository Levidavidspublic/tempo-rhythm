"use client";

import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { CrisisResourcesCard } from "@/components/coach-crisis/CrisisResourcesCard";
import { useCrisisGuard } from "@/components/coach-crisis/useCrisisGuard";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

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

/** `chat.send` refuses longer non-crisis text (`MAX_MESSAGE_LENGTH` in convex/chat.ts). */
export const COACH_MAX_MESSAGE_LENGTH = 4000;
/** `modelUsed` on the fixed crisis card reply that `chat.send` stores (convex/chat.ts). */
export const CRISIS_CARD_MODEL = "crisis-card";

type MessageId = Id<"messages">;
type ListedMessage = Pick<Doc<"messages">, "_id" | "role" | "content" | "modelUsed">;

/**
 * One `chat.send` call besides its conversation. A turn is identified by its user message id:
 * `retryOf` sends that id back, so a retry reuses the stored row instead of adding a second one.
 */
export type CoachTurn = { content: string; retryOf?: MessageId };
export type CoachSendResult = { reply: string; crisis?: true; messageId: MessageId };
export type CoachSend = (turn: CoachTurn) => Promise<CoachSendResult>;

export type CoachFailure = {
  /** Calm copy for the line under the input. Fixed text only: never server text, JSON or ids. */
  copy: string;
  /** Offer Retry, which resends the same text with `retryOf`. */
  canRetry: boolean;
  /** The turn identity Retry sends back to `chat.send`. */
  retryOf?: MessageId;
  /** Put the words back in the message box so they can be edited and sent again. */
  restoreInput: boolean;
};

export type CoachTurnOutcome =
  /** The crisis guard matched: the resources card shows and nothing was sent. */
  | { kind: "resources" }
  | { kind: "replied"; crisis: boolean }
  | { kind: "failed"; failure: CoachFailure };

export const COACH_COPY = {
  busy: "Tempo is busy right now. Take a breath, then try again.",
  hiccup: "Tempo had a hiccup. Try again in a moment?",
  emptyReply: "Tempo couldn't find the words that time. Try again in a moment?",
  offline: "The coach is offline right now. Your list still works. Try again in a little while.",
  stillReplying: "Tempo is still replying to your last message. Give it a moment, then try again.",
  tooLongChat:
    "This chat is too long for one reply. Your words are back in the box. Try a shorter message.",
  tooLongMessage: `Keep your message to ${COACH_MAX_MESSAGE_LENGTH.toLocaleString("en-US")} characters or fewer. Your words are still in the box.`,
  movedOn:
    "The chat moved on since that message. Your words are back in the box, so send them when you're ready.",
  newCoach: "This chat moved to the new coach. Refresh the page, then send your message again.",
  pendingApproval: "Your account is waiting for approval. Coach chat opens once it's approved.",
  notSent: "That didn't send. Your message is safe here. Try again?",
} as const;

class MessageTooLong extends Error {}

/** `code` and `messageId` from a `ConvexError` thrown by `chat.send`. Nothing else is read. */
function chatErrorData(error: unknown): { code: string | null; messageId: MessageId | null } {
  if (error && typeof error === "object" && "data" in error) {
    const data: unknown = (error as { data: unknown }).data;
    if (data && typeof data === "object") {
      const { code, messageId } = data as { code?: unknown; messageId?: unknown };
      return {
        code: typeof code === "string" ? code : null,
        messageId: typeof messageId === "string" && messageId ? (messageId as MessageId) : null,
      };
    }
  }
  return { code: null, messageId: null };
}

/**
 * Map a failed send to calm, fixed copy. Server text is never shown: on production deployments a plain
 * `Error` arrives as "Server Error" with a request id, and a `ConvexError`'s message embeds its data.
 * `retryOf` is the identity the failed attempt used; a model failure names its own turn instead.
 */
export function describeCoachError(error: unknown, retryOf?: MessageId): CoachFailure {
  if (error instanceof MessageTooLong) {
    return { copy: COACH_COPY.tooLongMessage, canRetry: false, restoreInput: true };
  }
  const { code, messageId } = chatErrorData(error);
  const retry = (copy: string): CoachFailure => {
    const identity = messageId ?? retryOf;
    return identity
      ? { copy, canRetry: true, retryOf: identity, restoreInput: false }
      : { copy, canRetry: true, restoreInput: false };
  };
  const edit = (copy: string): CoachFailure => ({ copy, canRetry: false, restoreInput: true });

  switch (code) {
    case "busy":
      return retry(COACH_COPY.busy);
    case "upstream":
      return retry(COACH_COPY.hiccup);
    case "empty_reply":
      return retry(COACH_COPY.emptyReply);
    case "not_configured":
      return retry(COACH_COPY.offline);
    case "still_replying":
      return retry(COACH_COPY.stillReplying);
    case "conversation_too_long":
      return edit(COACH_COPY.tooLongChat);
    case "retry_mismatch":
    case "turn_outdated":
      return edit(COACH_COPY.movedOn);
    case "legacy_chat_moved":
      return edit(COACH_COPY.newCoach);
    default:
      break;
  }
  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("ACCOUNT_PENDING_APPROVAL")) return edit(COACH_COPY.pendingApproval);
  return retry(COACH_COPY.notSent);
}

/**
 * The identity to send for `content`. An explicit `retryOf` wins. Otherwise, when the newest live message
 * is the user's own unanswered message with the same text (a turn whose reply never arrived), send its id,
 * so `chat.send` resumes that turn instead of storing the same words twice.
 */
export function turnIdentity(
  content: string,
  retryOf: MessageId | undefined,
  messages: ReadonlyArray<Pick<ListedMessage, "_id" | "role" | "content">> | undefined,
): MessageId | undefined {
  if (retryOf) return retryOf;
  const latest = messages?.at(-1);
  return latest && latest.role === "user" && latest.content.trim() === content
    ? latest._id
    : undefined;
}

/**
 * One coach turn: the crisis guard first (a match never reaches `chat.send`), then the length limit,
 * then `chat.send`. Never throws; a failure comes back as calm copy plus the identity Retry reuses.
 */
export async function runCoachTurn(
  turn: CoachTurn,
  guard: (text: string) => Promise<{ isCrisis: boolean }>,
  send: CoachSend,
): Promise<CoachTurnOutcome> {
  const sent: { result?: CoachSendResult } = {};
  try {
    const delivery = await deliverCoachMessage(turn.content, guard, async (content) => {
      if (content.length > COACH_MAX_MESSAGE_LENGTH) throw new MessageTooLong();
      sent.result = await send(turn.retryOf ? { content, retryOf: turn.retryOf } : { content });
    });
    if (delivery === "resources") return { kind: "resources" };
  } catch (error) {
    return { kind: "failed", failure: describeCoachError(error, turn.retryOf) };
  }
  return { kind: "replied", crisis: sent.result?.crisis === true };
}

export function isCrisisCardMessage(message: Pick<ListedMessage, "role" | "modelUsed">): boolean {
  return message.role === "assistant" && message.modelUsed === CRISIS_CARD_MODEL;
}

const bubbleBase = "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm";

export function CoachMessageBubble({ message }: { message: ListedMessage }) {
  if (isCrisisCardMessage(message)) {
    return (
      <div data-role="assistant" data-kind="crisis-card">
        <CoachCrisisReply />
      </div>
    );
  }
  return (
    <div
      data-role={message.role}
      className={cn(
        bubbleBase,
        message.role === "user"
          ? "ml-auto bg-primary text-primary-foreground"
          : "bg-muted text-foreground",
      )}
    >
      {message.content}
    </div>
  );
}

/** The user's words while they are on the way, or after a send that did not go through. */
export function CoachLocalBubble({ text, notSent }: { text: string; notSent: boolean }) {
  return (
    <div className="ml-auto flex max-w-[80%] flex-col items-end gap-1">
      <div
        data-role="user"
        data-local={notSent ? "not-sent" : "sending"}
        className={cn(
          bubbleBase,
          "max-w-full bg-primary text-primary-foreground",
          notSent && "opacity-70",
        )}
      >
        {text}
      </div>
      {notSent ? <span className="text-xs text-muted-foreground">Not sent yet</span> : null}
    </div>
  );
}

/** Polite live region that is always mounted, so the "Thinking…" bubble is announced when it appears. */
export function CoachThinking({ active }: { active: boolean }) {
  return (
    <output aria-live="polite" className="block" data-testid="coach-thinking">
      {active ? (
        <span className="inline-block w-fit rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
          Thinking…
        </span>
      ) : null}
    </output>
  );
}

export function CoachSendNotice({
  failure,
  onRetry,
  busy,
}: {
  failure: CoachFailure;
  onRetry: () => void;
  busy: boolean;
}) {
  return (
    <div
      aria-live="polite"
      data-testid="coach-send-notice"
      className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
    >
      <p className="flex-1 text-sm text-foreground">{failure.copy}</p>
      {failure.canRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={busy}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/** The input stays enabled while Tempo is thinking; only Send waits. */
export function CoachComposer({
  value,
  onChange,
  onSubmit,
  ready,
  sending,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  ready: boolean;
  sending: boolean;
}) {
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="flex-1">
        <span className="sr-only">Message</span>
        <input
          aria-label="Message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Help me pick one thing for this afternoon"
          disabled={!ready}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>
      <Button type="submit" disabled={!ready || sending || !value.trim()}>
        Send
      </Button>
    </form>
  );
}

type FailedTurn = { text: string; failure: CoachFailure };

export function CoachChat() {
  const { isAuthenticated } = useConvexAuth();
  // conversations.list calls requireUser: wait for the users row (getProfile is null until then).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const conversations = useQuery(api.conversations.list, isAuthenticated && profile ? {} : "skip");
  const createConversation = useMutation(api.conversations.create);
  const sendChat = useAction(api.chat.send);
  const { guard } = useCrisisGuard();

  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [input, setInput] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedTurn | null>(null);
  // "guard": the client crisis check matched and nothing was sent. "server": chat.send answered with
  // the crisis card; the thread shows the stored card once the list has it.
  const [crisisHold, setCrisisHold] = useState<"guard" | "server" | null>(null);
  const creatingRef = useRef(false);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuthenticated || conversations === undefined || conversationId) return;
    const latest = conversations[0];
    if (latest) {
      setConversationId(latest._id);
      return;
    }
    if (creatingRef.current) return;
    creatingRef.current = true;
    createConversation({})
      .then((id) => {
        setConversationId(id);
        creatingRef.current = false;
      })
      .catch(() => {
        // Pending accounts get the approval screen from the page. Stay on the loading line; no retry loop.
      });
  }, [isAuthenticated, conversations, conversationId, createConversation]);

  const messages = useQuery(api.messages.list, conversationId ? { conversationId } : "skip");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  });

  const isSending = pendingText !== null;

  const submitTurn = async (text: string, retryOf: MessageId | undefined) => {
    if (!conversationId || sendingRef.current) return;
    sendingRef.current = true;
    setPendingText(text);
    setFailed(null);
    try {
      const outcome = await runCoachTurn(
        { content: text, retryOf: turnIdentity(text, retryOf, messages) },
        guard,
        (turn) =>
          sendChat({
            conversationId,
            content: turn.content,
            ...(turn.retryOf ? { retryOf: turn.retryOf } : {}),
          }),
      );
      if (outcome.kind === "resources") {
        setCrisisHold("guard");
        return;
      }
      if (outcome.kind === "replied") {
        setCrisisHold(outcome.crisis ? "server" : null);
        return;
      }
      setFailed({ text, failure: outcome.failure });
      if (outcome.failure.restoreInput) {
        // The box stayed usable while Tempo was thinking: keep anything typed since.
        setInput((current) => (current.trim() ? current : text));
      }
    } finally {
      sendingRef.current = false;
      setPendingText(null);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !conversationId || isSending) return;
    setInput("");
    void submitTurn(text, undefined);
  };

  const handleRetry = () => {
    if (!failed?.failure.canRetry) return;
    void submitTurn(failed.text, failed.failure.retryOf);
  };

  const isLoading =
    isAuthenticated && (conversations === undefined || !conversationId || messages === undefined);

  const latest = messages?.at(-1);
  const localText = pendingText ?? (failed?.failure.canRetry ? failed.text : null);
  // Hide the local bubble once the thread lists the same words as its newest message.
  const showLocal =
    localText !== null && !(latest?.role === "user" && latest.content.trim() === localText);
  const showCrisisCard =
    crisisHold === "guard" || (crisisHold === "server" && !(latest && isCrisisCardMessage(latest)));

  return (
    <main className="container mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col px-6 py-12">
      <header>
        <p className="font-eyebrow text-muted-foreground">Flow</p>
        <h1 className="font-heading text-4xl font-semibold text-foreground">Coach</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Talk through what&rsquo;s in front of you. One small step at a time.
        </p>
      </header>

      <div className="mt-8 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-card">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your conversation.</p>
        ) : messages && messages.length === 0 && !showLocal ? (
          <p className="text-sm text-muted-foreground">
            Say what&rsquo;s on your mind — there&rsquo;s no wrong way to start.
          </p>
        ) : (
          messages?.map((message) => <CoachMessageBubble key={message._id} message={message} />)
        )}
        {showLocal && localText !== null ? (
          <CoachLocalBubble text={localText} notSent={!isSending} />
        ) : null}
        {showCrisisCard ? <CoachCrisisReply /> : null}
        <CoachThinking active={isSending} />
        <div ref={bottomRef} />
      </div>

      <CoachComposer
        value={input}
        onChange={(value) => {
          setInput(value);
          // A notice that put the words back in the box is done once they are edited; Retry stays.
          if (failed && !failed.failure.canRetry) setFailed(null);
        }}
        onSubmit={handleSend}
        ready={conversationId !== null}
        sending={isSending}
      />
      {failed ? (
        <CoachSendNotice failure={failed.failure} onRetry={handleRetry} busy={isSending} />
      ) : null}
    </main>
  );
}
