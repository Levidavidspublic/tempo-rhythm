"use client";

import { CoachBubble, Pill } from "@tempo/ui/primitives";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { SoftCard } from "@/components/soft-editorial/SoftCard";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  companionNameFromTechnique,
  filterHistoryConversations,
  getConversationPreview,
  type HistoryConversation,
  type HistoryMessage,
  isLiveConversation,
} from "@/lib/conversationHistory";
import type { MessageKey } from "@/lib/i18n";
import { intlLocale } from "@/lib/you/screenState";

type Translate = (key: MessageKey) => string;
type ThreadTimes = { createdAt: number; updatedAt: number };

/** The title conversations.create stores when none is given (convex/conversations.ts). */
const SERVER_DEFAULT_TITLE = "New Conversation";

/**
 * A thread is saved once it holds a message. conversations.list carries no message count, but
 * every message write moves the thread's `updatedAt` past its `createdAt`, and the app never
 * renames or retags a thread, so one whose times still match is an empty "New Conversation".
 */
export function isSavedThread(conversation: ThreadTimes): boolean {
  return conversation.updatedAt > conversation.createdAt;
}

function countLabel(n: number, one: MessageKey, many: MessageKey, t: Translate): string {
  return n === 1 ? t(one) : t(many).replace("{n}", String(n));
}

/** "1 saved thread" / "{n} saved threads", counting only threads that hold a message. */
export function savedThreadsLabel(conversations: readonly ThreadTimes[], t: Translate): string {
  return countLabel(
    conversations.filter(isSavedThread).length,
    "hist.count.one",
    "hist.count.many",
    t
  );
}

function threadTitle(title: string, t: Translate): string {
  return title === SERVER_DEFAULT_TITLE ? t("hist.defaultTitle") : title;
}

function companionName(technique: string | undefined, t: Translate): string {
  return technique ? companionNameFromTechnique(technique) : t("hist.companion");
}

function previewText(messages: HistoryMessage[], t: Translate): string {
  return messages.some((message) => message.role !== "system")
    ? getConversationPreview(messages)
    : t("hist.preview.empty");
}

export function HistoryScreen() {
  const { lang, t } = useLocale();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const hasConvexUser = profile != null;
  const conversations = useQuery(
    api.conversations.list,
    isAuthenticated && hasConvexUser ? {} : "skip"
  );
  const [query, setQuery] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(
    null
  );

  const liveConversations = useMemo(
    () => (conversations ?? []).filter(isLiveConversation),
    [conversations]
  );
  // An empty thread (the coach opens one before the first message) has nothing to pick up, so
  // it stays out of the list as well as the count; the two always agree.
  const savedConversations = useMemo(
    () => liveConversations.filter(isSavedThread),
    [liveConversations]
  );
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: "medium", timeStyle: "short" }),
    [lang]
  );
  const formatDate = (timestamp: number) => dateFormat.format(new Date(timestamp));

  useEffect(() => {
    if (selectedConversationId !== null) {
      return;
    }
    const first = savedConversations[0];
    if (first) {
      setSelectedConversationId(first._id);
    }
  }, [savedConversations, selectedConversationId]);

  const selectedConversation = useQuery(
    api.conversations.get,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  );
  const selectedMessages = useQuery(
    api.messages.list,
    selectedConversationId ? { conversationId: selectedConversationId } : "skip"
  );
  const trimmedQuery = query.trim().slice(0, 200);
  const searchHits = useQuery(
    api.messages.searchMine,
    isAuthenticated && hasConvexUser && trimmedQuery.length > 0 ? { query: trimmedQuery } : "skip"
  );
  const [settledHits, setSettledHits] = useState<NonNullable<typeof searchHits> | null>(null);
  const [settledQuery, setSettledQuery] = useState("");
  if (trimmedQuery.length === 0) {
    if (settledHits !== null || settledQuery !== "") {
      setSettledHits(null);
      setSettledQuery("");
    }
  } else if (searchHits !== undefined && settledQuery !== trimmedQuery) {
    setSettledHits(searchHits);
    setSettledQuery(trimmedQuery);
  }
  const searchPending = trimmedQuery.length > 0 && searchHits === undefined;
  // An in-flight query is undefined, not an empty hit list. Keep the last
  // settled hits so a keystroke does not wipe the thread list.
  const hitsForList = searchPending ? settledHits : (searchHits ?? null);
  const searchByConversation = useMemo(() => {
    const grouped = new Map<string, HistoryMessage[]>();
    for (const hit of hitsForList ?? []) {
      const existing = grouped.get(hit.conversationId) ?? [];
      existing.push({
        id: hit.messageId,
        conversationId: hit.conversationId,
        role: hit.role,
        content: hit.content,
        createdAt: hit.createdAt,
      });
      grouped.set(hit.conversationId, existing);
    }
    return grouped;
  }, [hitsForList]);

  const historyConversations = useMemo((): HistoryConversation[] => {
    return savedConversations.map((conversation) => {
      const isSelected = conversation._id === selectedConversationId;
      const messages: HistoryMessage[] = isSelected
        ? (selectedMessages ?? []).map((message) => ({
            id: message._id,
            conversationId: message.conversationId,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          }))
        : (searchByConversation.get(conversation._id) ?? []);

      // Search matches what is on screen, so the titles and names are the shown ones.
      return {
        id: conversation._id,
        title: threadTitle(conversation.title, t),
        companionName: companionName(conversation.technique, t),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages,
      };
    });
  }, [savedConversations, searchByConversation, selectedConversationId, selectedMessages, t]);

  const filteredConversations = useMemo(() => {
    if (searchPending && hitsForList === null) {
      return filterHistoryConversations(historyConversations, "");
    }
    return filterHistoryConversations(historyConversations, query);
  }, [historyConversations, hitsForList, query, searchPending]);

  const isLoading =
    isAuthLoading ||
    (isAuthenticated && (profile === undefined || (hasConvexUser && conversations === undefined)));

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-6">
          <div className="h-12 w-64 animate-pulse rounded-xl bg-muted" />
          <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.4fr)]">
            <div className="h-[28rem] animate-pulse rounded-2xl bg-muted" />
            <div className="h-[28rem] animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !profile || !conversations) {
    return (
      <div className="container mx-auto max-w-5xl px-6 py-16 text-center">
        <SoftCard className="mx-auto max-w-xl">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {t("hist.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("hist.signInBody")}</p>
          <Button asChild className="mt-6">
            <Link href="/sign-in?next=/history">{t("hist.signIn")}</Link>
          </Button>
        </SoftCard>
      </div>
    );
  }

  if (savedConversations.length === 0) {
    return (
      <div className="container mx-auto max-w-5xl px-6 py-16 text-center">
        <SoftCard className="mx-auto max-w-2xl">
          <h1 className="font-heading text-3xl font-semibold text-foreground">
            {t("hist.empty.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("hist.empty.body")}</p>
          <Button asChild className="mt-6">
            <Link href="/coach">{t("hist.empty.cta")}</Link>
          </Button>
        </SoftCard>
      </div>
    );
  }

  const locallySelected = selectedConversationId
    ? savedConversations.find((conversation) => conversation._id === selectedConversationId)
    : undefined;
  const activeConversation =
    (selectedConversation && isLiveConversation(selectedConversation)
      ? selectedConversation
      : undefined) ??
    locallySelected ??
    savedConversations[0];
  const activeId = activeConversation._id;
  const activeTitle = threadTitle(activeConversation.title, t);
  const activeMessages = selectedConversationId === activeId ? (selectedMessages ?? []) : [];
  const activeCompanion = companionName(activeConversation.technique, t);
  const activeHistory = filteredConversations.find((row) => row.id === activeId);

  return (
    <div className="container mx-auto max-w-6xl px-6 py-12">
      <div className="space-y-8">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="slate">{t("hist.title")}</Pill>
              <Pill tone="orange">{savedThreadsLabel(liveConversations, t)}</Pill>
            </div>
            <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
              {t("hist.heading")}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{t("hist.sub")}</p>
          </div>
          <label
            className="flex min-w-full flex-col gap-2 lg:min-w-[20rem]"
            htmlFor="history-search"
          >
            <span className="text-sm font-medium text-foreground">{t("hist.search")}</span>
            <input
              id="history-search"
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t("hist.searchPh")}
              className="h-12 rounded-2xl border border-border bg-card px-4 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              type="search"
            />
          </label>
        </header>

        <section className="grid min-h-[28rem] gap-6 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.4fr)]">
          <SoftCard className="p-0">
            <div className="border-b border-border px-6 py-4">
              <h2 className="font-heading text-xl font-semibold text-foreground">
                {t("hist.threads")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchPending
                  ? t("hist.searching")
                  : t("hist.shown")
                      .replace("{shown}", String(filteredConversations.length))
                      .replace("{total}", String(savedConversations.length))}
              </p>
            </div>
            {filteredConversations.length > 0 ? (
              <section
                className="max-h-[36rem] space-y-2 overflow-y-auto p-3"
                aria-label={t("hist.results")}
              >
                {filteredConversations.map((conversation) => {
                  const isSelected = activeId === conversation.id;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      aria-pressed={isSelected}
                      className={[
                        "w-full rounded-2xl border px-4 py-3 text-start transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-transparent hover:border-border hover:bg-muted/40",
                      ].join(" ")}
                      onClick={() => {
                        setSelectedConversationId(conversation.id as Id<"conversations">);
                      }}
                    >
                      <span className="block font-medium text-foreground">
                        {conversation.title}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <Pill tone="neutral">{conversation.companionName}</Pill>
                        {conversation.matchingMessageCount > 0 ? (
                          <Pill tone="moss">
                            {countLabel(
                              conversation.matchingMessageCount,
                              "hist.matches.one",
                              "hist.matches.many",
                              t
                            )}
                          </Pill>
                        ) : null}
                      </span>
                      <span className="mt-3 line-clamp-2 block text-sm text-muted-foreground">
                        {previewText(conversation.messages, t)}
                      </span>
                      <span className="mt-3 block text-xs text-muted-foreground">
                        {t("hist.updated").replace("{date}", formatDate(conversation.updatedAt))}
                      </span>
                    </button>
                  );
                })}
              </section>
            ) : (
              <div className="p-6">
                <p className="font-heading text-lg font-semibold text-foreground">
                  {t("hist.noMatch")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t("hist.noMatchHint")}</p>
              </div>
            )}
          </SoftCard>

          <SoftCard className="p-0">
            <div className="border-b border-border px-6 py-4">
              <Pill tone="slate">{activeCompanion}</Pill>
              <h2 className="mt-3 font-heading text-xl font-semibold text-foreground">
                {activeTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("hist.updated").replace("{date}", formatDate(activeConversation.updatedAt))}
                {activeHistory
                  ? ` · ${countLabel(activeHistory.messages.length, "hist.loaded.one", "hist.loaded.many", t)}`
                  : null}
              </p>
            </div>
            <div
              className="flex max-h-[36rem] flex-col gap-4 overflow-y-auto px-6 py-5"
              role="log"
              aria-label={t("hist.messagesFor").replace("{title}", () => activeTitle)}
            >
              {selectedConversationId !== activeId ? (
                <p className="text-sm text-muted-foreground">{t("hist.choose")}</p>
              ) : selectedMessages === undefined ? (
                <div className="h-32 animate-pulse rounded-2xl bg-muted" />
              ) : activeMessages.length > 0 ? (
                activeMessages.map((message) => (
                  <CoachBubble
                    key={message._id}
                    role={message.role === "assistant" ? "coach" : message.role}
                    timestamp={formatDate(message.createdAt)}
                  >
                    {message.content}
                  </CoachBubble>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t("hist.ready")}</p>
              )}
            </div>
          </SoftCard>
        </section>
      </div>
    </div>
  );
}
