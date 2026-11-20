/**
 * @screen  Capture composer (modal)
 * @source  docs/design/v3/screens/mobile/capture.html
 * @actions add to Today -> tasks.createQuick({ title, dueAt: end of today }) (Undo 5 min -> tasks.remove)
 *          add to Inbox -> tasks.createQuick({ title }) — the Inbox is open tasks with no due date yet
 *          close -> router.back(); the draft stays on the phone
 * @states  default | empty (button disabled) | error (words kept, Try again) | offline
 * Hold to talk is shown but switched off: the app has no speech-to-text call yet.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { CircleAlert, Inbox, Mic, Plus, RefreshCw, Sun, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, type TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Notice, Row, Segmented, T, TextField } from "@/components/v3/primitives";
import { useOffline, useTempoSession, useToday } from "@/components/v3/session";
import { OfflineNotice } from "@/components/v3/states";
import { ToastProvider, useToast } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { endOfDayDueAt } from "@/lib/v3/dates";

/** The unsent thought is kept per account, so the next person on a shared phone never sees it. */
const draftKeyFor = (userId: string) => `tempo.v3.capture.${userId}`;

export default function CaptureScreen() {
  // The modal sits above the app's own toast layer on iOS, so it carries its own.
  return (
    <ToastProvider bottomOffset={150}>
      <CaptureSheet />
    </ToastProvider>
  );
}

function CaptureSheet() {
  const t = useT("capture");
  const p = usePrefs();
  const c = p.colors;
  const router = useRouter();
  const toast = useToast();
  const offline = useOffline();
  const today = useToday();
  const createQuick = useMutation(api.tasks.createQuick);
  const remove = useMutation(api.tasks.remove);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const textRef = useRef("");
  const [dest, setDest] = useState<"today" | "inbox">("today");
  const [failed, setFailed] = useState<string | null>(null);
  const userId = useTempoSession().profile?._id;
  const draftKey = userId ? draftKeyFor(userId) : null;

  useEffect(() => {
    if (!draftKey) return;
    AsyncStorage.getItem(draftKey)
      .then((draft) => {
        if (draft)
          setText((cur) => {
            const next = cur || draft;
            textRef.current = next;
            return next;
          });
      })
      .catch(() => undefined);
  }, [draftKey]);

  const change = (value: string) => {
    textRef.current = value;
    setText(value);
    if (draftKey) AsyncStorage.setItem(draftKey, value).catch(() => undefined);
  };

  /** Puts a thought back in the box only when the box is empty, never over newer words. */
  const restore = (value: string) => {
    if (!textRef.current.trim()) change(value);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/today"));

  const save = (value: string = text) => {
    const title = value.trim();
    if (!title) return;
    setFailed(null);
    // Optimistic: the box clears at once for the next thought; a failure puts the words back.
    // A retry from the failure notice leaves newer words in the box alone.
    if (textRef.current.trim() === title) change("");
    const where = dest;
    const created = createQuick(where === "today" ? { title, dueAt: endOfDayDueAt(today.iso) } : { title });
    created
      .then((taskId: Id<"tasks">) => {
        toast({
          title: t(where === "today" ? "added.today" : "added.inbox"),
          onUndo: async () => {
            await remove({ taskId });
            restore(title);
            inputRef.current?.focus();
          },
        });
      })
      .catch(() => {
        restore(title);
        setFailed(title);
      });
    inputRef.current?.focus();
  };

  const empty = !text.trim();

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: c.glassSolid }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ alignSelf: "center", width: 40, height: 4, marginTop: 8, borderRadius: 999, backgroundColor: c.lineStrong }} />
        <Row style={{ alignItems: "center", paddingVertical: 8, paddingHorizontal: 8 }}>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <T size="lg" serif weight="500" accessibilityRole="header">
              {t("cap.title")}
            </T>
          </View>
          <Button variant="ghost" iconOnly icon={X} accessibilityLabel={t("cap.close")} onPress={close} />
        </Row>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 20 }}>
          {offline ? <OfflineNotice title={t("offline.title")} body={t("offline.body")} /> : null}
          {failed ? (
            <Notice
              tone="caution"
              icon={CircleAlert}
              title={t("err.title")}
              body={t("err.body")}
              live="assertive"
              action={<Button small icon={RefreshCw} label={t("state.retry")} onPress={() => save(failed)} />}
            />
          ) : null}
          <TextField
            label={t("cap.label")}
            help={t("cap.help")}
            value={text}
            onChangeText={change}
            placeholder={t("cap.ph")}
            multiline
            minHeight={96}
            user
            autoFocus
            inputRef={inputRef}
          />
          <T size="sm" tone="muted" center>
            {t("cap.or")}
          </T>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Button
              block
              icon={Mic}
              label={t("ptt.hold")}
              disabled
              accessibilityHint={t("ptt.unavailable")}
              style={{ minHeight: 64, borderRadius: 999, borderWidth: 2 }}
            />
            <T size="sm" tone="muted" center>
              {t("ptt.unavailable")}
            </T>
          </View>
          <View style={{ gap: 8 }}>
            <T size="sm" weight="600">
              {t("dest.label")}
            </T>
            <Segmented
              block
              label={t("dest.label")}
              value={dest}
              onChange={setDest}
              options={[
                { value: "today", label: t("dest.today"), icon: Sun },
                { value: "inbox", label: t("dest.inbox"), icon: Inbox },
              ]}
            />
            <T size="sm" tone="muted">
              {t(dest === "today" ? "dest.help.today" : "dest.help.inbox")}
            </T>
          </View>
        </ScrollView>
        <View style={{ gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: c.line }}>
          <Button
            variant="primary"
            block
            icon={Plus}
            label={t(dest === "today" ? "save.today" : "save.inbox")}
            disabled={empty}
            onPress={() => save()}
          />
          <Button variant="ghost" block label={t("cap.cancel")} onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
