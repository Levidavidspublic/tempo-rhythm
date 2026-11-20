/**
 * @screen  Voice call (live coach call) — layout only
 * @source  docs/design/v3/screens/mobile/voice-call.html
 * The live call needs a realtime voice session the app does not have yet (no provider, no paid API,
 * no new env). The screen shows the call layout honestly: the state word is "Not connected", a
 * notice says live calls are not ready, the mic and hold-to-talk are switched off, and End call /
 * Back to chat return to the Coach tab. Nothing is recorded and no minutes are shown.
 */
import { useRouter } from "expo-router";
import { CircleAlert, Globe, Hand, Mic, MicOff, PhoneOff } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePrefs, useT } from "@/components/v3/prefs";
import { Button, Chevron, Notice, RADIUS, Row, T } from "@/components/v3/primitives";
import { useOffline } from "@/components/v3/session";
import { OfflineNotice } from "@/components/v3/states";

const LEVELS = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15];

export default function VoiceCallScreen() {
  const t = useT("voiceCall");
  const p = usePrefs();
  const c = p.colors;
  const router = useRouter();
  const offline = useOffline();
  // The call language is a choice for when calls exist; it is kept on this screen only.
  const [callLang, setCallLang] = useState(p.lang);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/coach"));

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: c.ground }}
      accessibilityViewIsModal
      accessibilityLabel={t("call.title")}
    >
      <Row className="gap-2" wrap style={{ alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 }}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <T size="lg" serif weight="500" accessibilityRole="header">
            {t("call.title")}
          </T>
        </View>
        <Pressable
          onPress={() => setCallLang((l) => (l === "en" ? "he" : "en"))}
          accessibilityRole="button"
          accessibilityLabel={`${t("call.langLabel")}: ${callLang === "en" ? "English" : "עברית"}`}
          style={{
            flexDirection: p.row,
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: RADIUS.pill,
            borderWidth: 1,
            borderColor: c.lineControl,
            backgroundColor: c.paper,
          }}
        >
          <Globe size={16} color={c.ink} />
          <T size="sm" weight="600">
            {callLang === "en" ? "English" : "עברית"}
          </T>
          <T size="sm" tone="muted">
            {callLang === "en" ? "עברית" : "English"}
          </T>
        </Pressable>
      </Row>

      <View style={{ flex: 1, alignItems: "center", gap: 16, paddingVertical: 8, paddingHorizontal: 16 }}>
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 64 }}
        >
          {LEVELS.map((level, i) => (
            <View key={i} style={{ width: 6, height: 64 * level, borderRadius: RADIUS.pill, backgroundColor: c.lineStrong }} />
          ))}
        </View>
        <T size="3xl" serif weight="500" center accessibilityLiveRegion="polite">
          {t("call.notConnected")}
        </T>
        <View style={{ alignSelf: "stretch" }}>
          {offline ? (
            <OfflineNotice title={t("off.title")} body={t("off.body")} />
          ) : (
            <Notice tone="caution" icon={CircleAlert} title={t("unavailable.title")} body={t("unavailable.body")} live="polite" />
          )}
        </View>
      </View>

      <View style={{ gap: 12, paddingTop: 12, paddingBottom: 16, paddingHorizontal: 16 }}>
        <Row style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Button icon={Hand} label={t("call.interrupt")} disabled />
          <View style={{ alignItems: "center", gap: 8 }}>
            <Pressable
              disabled
              accessibilityRole="switch"
              accessibilityLabel={t("call.unmute")}
              accessibilityState={{ checked: false, disabled: true }}
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.paper,
                borderWidth: 2,
                borderColor: c.lineControl,
                opacity: 0.55,
              }}
            >
              <MicOff size={32} color={c.ink} />
            </Pressable>
            <T size="sm" weight="600" importantForAccessibility="no">
              {t("call.micOff")}
            </T>
          </View>
          <Button variant="danger" icon={PhoneOff} label={t("call.end")} onPress={back} />
        </Row>
        <Button
          block
          icon={Mic}
          label={t("ptt.hold")}
          disabled
          accessibilityHint={t("unavailable.title")}
          style={{ minHeight: 64, borderRadius: RADIUS.pill, borderWidth: 2 }}
        />
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={t("call.back")}
          style={({ pressed }) => ({
            flexDirection: p.row,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 44,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: c.lineControl,
            backgroundColor: pressed ? c.hover : c.paper,
          })}
        >
          <Chevron back color={c.ink} />
          <T size="sm" weight="600">
            {t("call.back")}
          </T>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
