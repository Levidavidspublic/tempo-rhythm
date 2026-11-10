/**
 * Mobile shell pieces (components.md §2.17): the screen frame, MobileTopBar, the floating capture
 * button and MobileSheet. Floating chrome uses the solid glass fallback (`glassSolid`): the app has
 * no blur dependency, and DESIGN.md §5 allows the solid surface everywhere glass is used.
 */
import { useRouter } from "expo-router";
import { type LucideIcon, Plus, X } from "lucide-react-native";
import type { ReactNode } from "react";
import {
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { usePrefs, useT } from "./prefs";
import { Avatar, Button, Chevron, RADIUS, Row, T, TOUCH, withAlpha } from "./primitives";
import { useTempoSession } from "./session";

/** `end` in the language's reading order, on any native layout direction. */
export function useEndEdge(value: number): ViewStyle {
  const { rtl } = usePrefs();
  return rtl === I18nManager.isRTL ? { end: value } : { start: value };
}

export function Screen({
  children,
  tabs,
  scroll = true,
  footer,
  keyboard,
  overlay,
  contentStyle,
  testID,
}: {
  children: ReactNode;
  /** A tab screen: the tab bar sits below, and the floating button needs room. */
  tabs?: boolean;
  scroll?: boolean;
  footer?: ReactNode;
  keyboard?: boolean;
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors: c } = usePrefs();
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: tabs ? 112 : 40, gap: 24 }, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: 16, paddingTop: 12, gap: 16 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView testID={testID} edges={tabs ? ["top"] : ["top", "bottom"]} style={{ flex: 1, backgroundColor: c.ground }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboard && Platform.OS === "ios" ? "padding" : undefined}>
        {body}
        {footer}
      </KeyboardAvoidingView>
      {overlay}
    </SafeAreaView>
  );
}

type StartAction = { kind: "back" } | { kind: "icon"; icon: LucideIcon; label: string; onPress: () => void };

export function MobileTopBar({
  title,
  start,
  end = "avatar",
}: {
  title: string;
  start?: StartAction;
  end?: "avatar" | "none" | ReactNode;
}) {
  const router = useRouter();
  const t = useT("today");
  const p = usePrefs();
  const c = p.colors;
  const session = useTempoSession();
  const back = () => (router.canGoBack() ? router.back() : router.replace("/today"));
  const startNode =
    start?.kind === "back" ? (
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={t("top.back")}
        style={{ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" }}
      >
        <Chevron back size={20} color={c.ink} />
      </Pressable>
    ) : start?.kind === "icon" ? (
      <Button variant="ghost" iconOnly icon={start.icon} accessibilityLabel={start.label} onPress={start.onPress} />
    ) : (
      <View style={{ width: TOUCH }} />
    );
  const endNode =
    end === "avatar" ? (
      <Pressable
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        accessibilityLabel={session.fullName ? t("top.avatar", { name: session.fullName }) : t("more.settings")}
        style={{ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" }}
      >
        <Avatar initials={session.initials} />
      </Pressable>
    ) : end === "none" ? (
      <View style={{ width: TOUCH }} />
    ) : (
      end
    );
  return (
    <Row
      style={{
        alignItems: "center",
        gap: 4,
        minHeight: TOUCH + 8,
        paddingHorizontal: 4,
        marginHorizontal: -8,
        borderRadius: RADIUS.lg,
        backgroundColor: c.glassSolid,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      {startNode}
      <View style={{ flex: 1 }}>
        <T size="sm" weight="600" center lines={1} accessibilityRole="header">
          {title}
        </T>
      </View>
      {endNode}
    </Row>
  );
}

/** The floating + that opens Capture (CaptureButton). */
export function CaptureFab({ label, onPress, icon: Icon = Plus }: { label: string; onPress: () => void; icon?: LucideIcon }) {
  const { colors: c } = usePrefs();
  const edge = useEndEdge(16);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          position: "absolute",
          bottom: 16,
          width: TOUCH + 12,
          height: TOUCH + 12,
          borderRadius: RADIUS.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? c.hover : c.glassSolid,
          borderWidth: 1,
          borderColor: c.lineControl,
          shadowColor: c.ink,
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 5,
        },
        edge,
      ]}
    >
      <Icon size={26} color={c.ink} />
    </Pressable>
  );
}

/** MobileSheet: a bottom sheet with a grabber, a title, Close and an optional footer. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
  closeLabel,
  alert,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  /** A confirm sheet (alert-dialog). */
  alert?: boolean;
}) {
  const p = usePrefs();
  const c = p.colors;
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={p.reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable
          style={{ flex: 1, backgroundColor: p.dark ? withAlpha(c.sunken, 0.48) : withAlpha(c.ink, 0.28) }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View
          accessibilityViewIsModal
          accessibilityRole={alert ? "alert" : undefined}
          style={{
            maxHeight: "88%",
            backgroundColor: c.glassSolid,
            borderTopLeftRadius: RADIUS.xl,
            borderTopRightRadius: RADIUS.xl,
            borderWidth: 1,
            borderColor: c.line,
            paddingBottom: insets.bottom,
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 4, marginTop: 8, borderRadius: RADIUS.pill, backgroundColor: c.lineStrong }} />
          <Row style={{ alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 8 }}>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
              <T size="lg" weight="500" serif accessibilityRole="header">
                {title}
              </T>
            </View>
            <Button variant="ghost" iconOnly icon={X} accessibilityLabel={closeLabel} onPress={onClose} />
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}>
            {children}
          </ScrollView>
          {footer ? (
            <View style={{ gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: c.line }}>{footer}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
