import { Tabs } from "expo-router";
import { usePrefs } from "@/components/v3/prefs";
import { TempoTabBar } from "@/components/v3/TabBar";

/**
 * Tempo Flow bottom tab bar: Today, Tasks, Coach, Notes, and More (a sheet).
 * @source docs/design/v3/screens/mobile/today.html (tab bar, data-count="5")
 * @action navigateTab
 */
export default function TabsLayout() {
  const { colors } = usePrefs();
  return (
    <Tabs
      tabBar={(props) => <TempoTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // v3 tab bar (tempo.css .tp-tab): ink when current on a hover wash, muted ink otherwise.
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarActiveBackgroundColor: colors.hover,
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      <Tabs.Screen name="today" options={{ title: "Today" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="coach" options={{ title: "Coach" }} />
      <Tabs.Screen name="notes" options={{ title: "Notes" }} />
    </Tabs>
  );
}
