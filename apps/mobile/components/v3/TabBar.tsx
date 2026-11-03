/**
 * TabBar (MobileTabBar, data-count="5"): Today, Tasks, Coach, Notes and More. More opens the
 * MobileSheet with Journal, Habits, Calendar, Routines, Templates and Settings.
 * Colours follow PR #911: ink on a hover wash for the current tab, muted ink otherwise.
 * The bar reads in the language's order (Hebrew starts on the right).
 */
import { useRouter } from "expo-router";
import {
  CalendarDays,
  Ellipsis,
  FileText,
  LayoutTemplate,
  ListChecks,
  type LucideIcon,
  MessageCircle,
  NotebookPen,
  Repeat,
  Settings,
  Sun,
} from "lucide-react-native";
import { type ComponentProps, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";
import { usePrefs, useT } from "./prefs";
import { RADIUS, Row, TouchRow } from "./primitives";
import { Sheet } from "./Shell";

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: readonly { name: string; label: "tab.today" | "tab.tasks" | "tab.coach" | "tab.notes"; icon: LucideIcon }[] = [
  { name: "today", label: "tab.today", icon: Sun },
  { name: "tasks", label: "tab.tasks", icon: ListChecks },
  { name: "coach", label: "tab.coach", icon: MessageCircle },
  { name: "notes", label: "tab.notes", icon: FileText },
];

const MORE: readonly {
  href: "/journal" | "/habits" | "/calendar" | "/routines" | "/templates" | "/settings";
  label: "more.journal" | "more.habits" | "more.calendar" | "more.routines" | "more.templates" | "more.settings";
  icon: LucideIcon;
}[] = [
  { href: "/journal", label: "more.journal", icon: NotebookPen },
  { href: "/habits", label: "more.habits", icon: Repeat },
  { href: "/calendar", label: "more.calendar", icon: CalendarDays },
  { href: "/routines", label: "more.routines", icon: ListChecks },
  { href: "/templates", label: "more.templates", icon: LayoutTemplate },
  { href: "/settings", label: "more.settings", icon: Settings },
];

function TabButton({
  label,
  icon: Icon,
  current,
  onPress,
  expanded,
}: {
  label: string;
  icon: LucideIcon;
  current: boolean;
  onPress: () => void;
  expanded?: boolean;
}) {
  const p = usePrefs();
  const c = p.colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={expanded === undefined ? "tab" : "button"}
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? { selected: current } : { expanded }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 52,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        borderRadius: RADIUS.md,
        backgroundColor: current || pressed ? c.hover : "transparent",
      })}
    >
      <Icon size={22} color={current ? c.ink : c.inkMuted} />
      <Text
        numberOfLines={1}
        style={{ color: current ? c.ink : c.inkMuted, fontSize: 13, fontWeight: "600" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TempoTabBar({ state, navigation }: TabBarProps) {
  const t = useT("today");
  const p = usePrefs();
  const c = p.colors;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(name);
  };

  return (
    <View style={{ backgroundColor: c.ground, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 4, paddingHorizontal: 8 }}>
      <Row
        accessibilityRole="tablist"
        accessibilityLabel={t("tab.label")}
        style={{
          gap: 4,
          padding: 4,
          borderRadius: RADIUS.xl,
          backgroundColor: c.glassSolid,
          borderWidth: 1,
          borderColor: c.line,
          shadowColor: c.ink,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }}
      >
        {TABS.map((tab) => (
          <TabButton key={tab.name} label={t(tab.label)} icon={tab.icon} current={current === tab.name} onPress={() => go(tab.name)} />
        ))}
        <TabButton label={t("tab.more")} icon={Ellipsis} current={false} expanded={moreOpen} onPress={() => setMoreOpen(true)} />
      </Row>
      <MoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpen={(href) => {
          setMoreOpen(false);
          router.push(href);
        }}
      />
    </View>
  );
}

export function MoreSheet({
  visible,
  onClose,
  onOpen,
}: {
  visible: boolean;
  onClose: () => void;
  onOpen: (href: (typeof MORE)[number]["href"]) => void;
}) {
  const t = useT("today");
  return (
    <Sheet visible={visible} title={t("more.title")} onClose={onClose} closeLabel={t("more.close")}>
      <View style={{ marginHorizontal: -20 }}>
        {MORE.map((item, i) => (
          <TouchRow
            key={item.href}
            icon={item.icon}
            label={t(item.label)}
            role="link"
            last={i === MORE.length - 1}
            onPress={() => onOpen(item.href)}
          />
        ))}
      </View>
    </Sheet>
  );
}
