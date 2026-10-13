/**
 * @screen  Coach
 * @source  docs/design/v3/screens/mobile/coach.html
 * @data    conversations.list (latest thread) · messages.list · coach.currentProposal · tasks.list (for Undo)
 * @actions send -> coach.sendMessage (a new thread starts with conversations.create)
 *          "Plan my day with me" also asks coach.createProposal (built by code, no model call)
 *          accept / reject -> coach.decideProposal; Accept has a 5-minute Undo that puts each task's
 *          due date back (tasks.update). Nothing changes before Accept.
 *          talk instead -> /voice-call
 * @states  default | empty (new conversation) | loading | error | offline (composer hidden) · undo
 *          after each send (not crisis text) -> coach.reply, with a typing state; a missing key or
 *          provider error shows the kind "can't reach its model" line with Try again.
 */
import { useAction, useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Mic, Phone, Plus, Send, Sun } from "lucide-react-native";
import { type Dispatch, type RefObject, type SetStateAction, useEffect, useRef, useState } from "react";
import { I18nManager, ScrollView, TextInput, View } from "react-native";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Eyebrow, RADIUS, Row, T, TOUCH } from "@/components/v3/primitives";
import { MobileTopBar, Screen } from "@/components/v3/Shell";
import { useOffline, useTempoSession, useToday } from "@/components/v3/session";
import { OfflineNotice, QueryBoundary, StateError } from "@/components/v3/states";
import { useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clockTime, localIsoDate, shortDay } from "@/lib/v3/dates";
import { startAlign, textDirection } from "@/lib/v3/i18n";

export default function CoachScreen() {
  const t = useT("coach");
  const router = useRouter();
  const session = useTempoSession();
  const offline = useOffline();
  const params = useLocalSearchParams<{ ask?: string; task?: string }>();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<TextInput>(null);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const reply = useCoachReply();

  useEffect(() => {
    if (params.ask === "smaller") setDraft(params.task ? `${t("sug.smaller")}: ${params.task}` : t("sug.smaller"));
    if (params.ask) setTimeout(() => inputRef.current?.focus(), 300);
  }, [params.ask, params.task, t]);

  return (
    <Screen
      tabs
      scroll={false}
      keyboard
      footer={
        offline || !session.ready ? null : (
          <Composer
            draft={draft}
            setDraft={setDraft}
            inputRef={inputRef}
            conversationId={conversationId}
            setConversationId={setConversationId}
            onSent={reply.request}
          />
        )
      }
    >
      <MobileTopBar
        title={t("top.title")}
        start={{ kind: "icon", icon: Phone, label: t("top.call"), onPress: () => router.push("/voice-call") }}
      />
      <QueryBoundary
        fallback={(retry) => (
          <StateError title={t("err.title")} safe={t("state.safe")} body={t("err.body")} retryLabel={t("state.retry")} onRetry={retry} />
        )}
      >
        <Thread
          ready={session.ready}
          name={session.name}
          offline={offline}
          conversationId={conversationId}
          setConversationId={setConversationId}
          setDraft={setDraft}
          reply={reply}
        />
      </QueryBoundary>
    </Screen>
  );
}

type CoachReply = { state: "idle" | "typing" | "unavailable"; request: (id: Id<"conversations">) => void };

/**
 * The model's answer to the newest message (coach.reply). It never throws: a missing key or a
 * provider error leaves the message saved and the thread says the coach can't reach its model.
 */
function useCoachReply(): CoachReply {
  const ask = useAction(api.coach.reply);
  const [state, setState] = useState<CoachReply["state"]>("idle");
  const request = (id: Id<"conversations">) => {
    setState("typing");
    ask({ conversationId: id })
      .then((result) => setState(result.status === "unavailable" ? "unavailable" : "idle"))
      .catch(() => setState("unavailable"));
  };
  return { state, request };
}

function useSend(
  conversationId: Id<"conversations"> | null,
  setConversationId: (id: Id<"conversations">) => void,
  onSent: (id: Id<"conversations">) => void,
) {
  const create = useMutation(api.conversations.create);
  const send = useMutation(api.coach.sendMessage);
  return async (text: string) => {
    const content = text.trim();
    if (!content) return;
    let id = conversationId;
    if (!id) {
      id = await create({ title: content.slice(0, 60) });
      setConversationId(id);
    }
    const result = await send({ conversationId: id, content });
    // Crisis text gets the fixed resources card and never reaches a model.
    if (!result.crisis) onSent(id);
  };
}

function Thread({
  ready,
  name,
  offline,
  conversationId,
  setConversationId,
  setDraft,
  reply,
}: {
  ready: boolean;
  name: string;
  offline: boolean;
  conversationId: Id<"conversations"> | null;
  setConversationId: (id: Id<"conversations">) => void;
  setDraft: Dispatch<SetStateAction<string>>;
  reply: CoachReply;
}) {
  const t = useT("coach");
  const { lang, colors: c } = usePrefs();
  const today = useToday();
  const conversations = useQuery(api.conversations.list, ready ? {} : "skip");
  // Threads started in the web's Agent chat can't take legacy messages; with only those, a send
  // starts a new thread.
  const latest = conversations?.find((conversation) => conversation.chatMode !== "agent")?._id ?? null;
  const threadId = conversationId ?? latest;
  const messages = useQuery(api.messages.list, threadId ? { conversationId: threadId } : "skip");
  const createProposal = useMutation(api.coach.createProposal);
  const send = useSend(threadId, setConversationId, reply.request);
  const scroll = useRef<ScrollView>(null);
  const [sendError, setSendError] = useState(false);

  useEffect(() => {
    if (!conversationId && latest) setConversationId(latest);
  }, [conversationId, latest, setConversationId]);

  const loading = !ready || conversations === undefined || (threadId !== null && messages === undefined);
  const list = messages ?? [];

  const suggest = (text: string, plan: boolean) => {
    setSendError(false);
    send(text).catch(() => {
      // Put the words back only into an empty box, never over something typed since.
      setDraft((current) => (current.trim() ? current : text));
      setSendError(true);
    });
    // The plan card is built by code from open tasks; with none open there is simply no card.
    if (plan) createProposal({}).catch(() => undefined);
  };

  let lastDay = "";
  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1 }}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
      accessibilityLabel={t("thread.label")}
    >
      <T size="sm" tone="muted" center>
        {t("coach.sub")}
      </T>
      {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
      {loading ? (
        <Typing label={t("loading")} />
      ) : list.length === 0 ? (
        <View style={{ gap: 16 }}>
          <Bubble who="coach" label={t("coach.name")} text={name ? t("empty.opener", { name }) : t("empty.opener.noname")} />
          {offline ? null : (
            <Row className="gap-2" wrap>
              <Button small label={t("sug.plan")} onPress={() => suggest(t("sug.plan"), true)} />
              <Button small label={t("sug.smaller")} onPress={() => suggest(t("sug.smaller"), false)} />
              <Button small label={t("sug.stuck")} onPress={() => suggest(t("sug.stuck"), false)} />
            </Row>
          )}
        </View>
      ) : (
        list
          .filter((m) => m.role !== "system")
          .map((m) => {
            const day = localIsoDate(new Date(m.createdAt));
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <View key={m._id} style={{ gap: 16 }}>
                {showDay ? (
                  <View style={{ alignItems: "center" }}>
                    <Eyebrow>{`${day === today.iso ? t("day.today") : shortDay(day, lang)} · ${clockTime(m.createdAt)}`}</Eyebrow>
                  </View>
                ) : null}
                <Bubble who={m.role === "user" ? "you" : "coach"} label={m.role === "user" ? t("msg.you") : t("coach.name")} text={m.content} />
              </View>
            );
          })
      )}
      {reply.state === "typing" ? <Typing label={t("typing")} /> : null}
      {reply.state === "unavailable" && threadId && list.at(-1)?.role === "user" ? (
        <View style={{ gap: 8 }}>
          <T size="sm" tone="muted" accessibilityLiveRegion="polite">
            {t("reply.unavailable")}
          </T>
          <Row>
            <Button small variant="ghost" label={t("reply.retry")} onPress={() => reply.request(threadId)} />
          </Row>
        </View>
      ) : null}
      {sendError ? (
        <T size="sm" tone="danger" accessibilityRole="alert">
          {t("send.error")}
        </T>
      ) : null}
      {ready && !loading ? <Proposal /> : null}
      <View style={{ height: 1, backgroundColor: c.ground }} />
    </ScrollView>
  );
}

/** CoachMessage / UserMessage. User text takes its own direction. */
function Bubble({ who, label, text }: { who: "you" | "coach"; label: string; text: string }) {
  const p = usePrefs();
  const c = p.colors;
  const mine = who === "you";
  const dir = textDirection(text, p.rtl ? "rtl" : "ltr");
  const endSide = p.rtl === I18nManager.isRTL ? "flex-end" : "flex-start";
  const startSide = p.rtl === I18nManager.isRTL ? "flex-start" : "flex-end";
  return (
    <View style={{ gap: 4, alignItems: mine ? endSide : startSide, maxWidth: "100%" }}>
      <T size="xs" weight="600" tone="muted">
        {label}
      </T>
      <View
        style={{
          maxWidth: mine ? "88%" : "94%",
          backgroundColor: mine ? c.sunken : "transparent",
          paddingVertical: mine ? 12 : 0,
          paddingHorizontal: mine ? 16 : 0,
          borderRadius: RADIUS.lg,
        }}
      >
        <T user style={{ textAlign: startAlign(dir === "rtl", I18nManager.isRTL) }}>
          {text}
        </T>
      </View>
    </View>
  );
}

/** TypingIndicator: the words carry the meaning; the dots stay still. */
function Typing({ label }: { label: string }) {
  const { colors: c, row } = usePrefs();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ flexDirection: row, alignItems: "center", gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.inkMuted, opacity: 0.6 }} />
        ))}
      </View>
      <T size="sm" tone="muted">
        {label}
      </T>
    </View>
  );
}

/** ProposalCard: exactly what changes, Accept / Reject, and a 5-minute Undo after Accept. */
function Proposal() {
  const t = useT("coach");
  const p = usePrefs();
  const c = p.colors;
  const toast = useToast();
  const today = useToday();
  const proposal = useQuery(api.coach.currentProposal, {});
  const tasks = useQuery(api.tasks.list, proposal?.tasks.length ? {} : "skip");
  const decide = useMutation(api.coach.decideProposal);
  const update = useMutation(api.tasks.update);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!proposal || !proposal.tasks.length) {
    return note ? (
      <Row className="gap-2" style={{ alignItems: "center" }}>
        <Check size={16} color={c.done} />
        <T size="sm" tone="muted" accessibilityLiveRegion="polite">
          {note}
        </T>
      </Row>
    ) : null;
  }

  const n = proposal.tasks.length;
  const onDecide = async (decision: "accept" | "reject") => {
    if (busy) return;
    setBusy(true);
    // Each task's due date before Accept, so Undo can put it back exactly.
    const before = new Map((tasks ?? []).map((x) => [x._id as string, x.dueAt ?? null]));
    const ids = proposal.tasks.map((x) => x.taskId);
    try {
      await decide({ proposalId: proposal._id, decision });
      if (decision === "reject") {
        setNote(t("proposal.rejected"));
        return;
      }
      setNote(t("proposal.accepted"));
      toast({
        title: n === 1 ? t("toast.title.one") : t("toast.title", { n }),
        onUndo: async () => {
          await Promise.all(ids.map((taskId) => update({ taskId, dueAt: before.get(taskId) ?? null })));
          setNote(t("undo.done"));
        },
      });
    } catch {
      setNote(t("proposal.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      accessibilityRole="summary"
      style={{ backgroundColor: c.paper, borderWidth: 1, borderColor: c.lineStrong, borderRadius: RADIUS.lg, overflow: "hidden" }}
    >
      <Row style={{ alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <Sun size={16} color={c.ink} />
        <View style={{ flex: 1 }}>
          <T weight="600" accessibilityRole="header">
            {n === 1 ? t("prop.title.one") : t("prop.title", { n })}
          </T>
        </View>
        <T size="xs" tone="muted">
          {shortDay(today.iso, p.lang)}
        </T>
      </Row>
      {proposal.tasks.map((task) => (
        <Row key={task.taskId} style={{ gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Row
            style={{ minWidth: 64, minHeight: 24, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 8, borderRadius: RADIUS.sm, backgroundColor: c.doneWash, alignSelf: "flex-start" }}
          >
            <Plus size={14} color={c.done} />
            <T size="xs" weight="700" tone="done">
              {t("op.add")}
            </T>
          </Row>
          <View style={{ flex: 1, gap: 2 }}>
            <T weight="600" user>
              {task.title}
            </T>
            <T size="sm" tone="muted">
              {t("chg.task", { n: task.minutes })}
            </T>
          </View>
        </Row>
      ))}
      <Row className="gap-2" wrap style={{ padding: 12, paddingHorizontal: 16, backgroundColor: c.ground }}>
        {/* Accept waits for the task list, so its Undo can always put each due date back. */}
        <Button variant="primary" icon={Check} label={t("proposal.accept")} onPress={() => onDecide("accept")} disabled={busy || !tasks} />
        <Button variant="ghost" label={t("proposal.reject")} onPress={() => onDecide("reject")} disabled={busy} />
      </Row>
    </View>
  );
}

/** Composer: type and Send (ink, not accent), or tap the mic for a voice call. */
function Composer({
  draft,
  setDraft,
  inputRef,
  conversationId,
  setConversationId,
  onSent,
}: {
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<TextInput | null>;
  conversationId: Id<"conversations"> | null;
  setConversationId: (id: Id<"conversations">) => void;
  onSent: (id: Id<"conversations">) => void;
}) {
  const t = useT("coach");
  const p = usePrefs();
  const c = p.colors;
  const router = useRouter();
  const conversations = useQuery(api.conversations.list, {});
  // Same pick as Thread: never an Agent-mapped thread, which coach.sendMessage refuses.
  const latest = conversations?.find((conversation) => conversation.chatMode !== "agent")?._id ?? null;
  const send = useSend(conversationId ?? latest, setConversationId, onSent);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const dir = textDirection(draft, p.rtl ? "rtl" : "ltr");

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setFailed(false);
    setDraft("");
    send(text)
      .catch(() => {
        // Put the words back only into an empty box, never over something typed since.
        setDraft((current) => (current.trim() ? current : text));
        setFailed(true);
      })
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12, backgroundColor: c.ground, borderTopWidth: 1, borderTopColor: c.line }}>
      <View style={{ gap: 8, padding: 12, backgroundColor: c.paper, borderWidth: 1, borderColor: c.lineControl, borderRadius: RADIUS.lg }}>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder={t("composer.ph")}
          placeholderTextColor={c.inkSubtle}
          accessibilityLabel={t("composer.label")}
          multiline
          style={{
            minHeight: TOUCH,
            maxHeight: 160,
            color: c.ink,
            fontSize: Math.round(17 * p.textScale),
            writingDirection: dir,
            textAlign: startAlign(dir === "rtl", I18nManager.isRTL),
          }}
        />
        {failed ? (
          <T size="sm" tone="danger" accessibilityRole="alert">
            {t("send.error")}
          </T>
        ) : null}
        <Row style={{ alignItems: "center", gap: 4 }}>
          <Button small variant="ghost" iconOnly icon={Mic} accessibilityLabel={t("composer.voice")} onPress={() => router.push("/voice-call")} />
          <View style={{ flex: 1 }}>
            <T size="xs" tone="muted">
              {t("composer.hint")}
            </T>
          </View>
          <Button small variant="ink" iconOnly icon={Send} accessibilityLabel={t("composer.send")} onPress={submit} disabled={!draft.trim() || busy} />
        </Row>
      </View>
    </View>
  );
}
