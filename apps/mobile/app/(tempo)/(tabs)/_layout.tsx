import { Tabs } from "expo-router";
import { BookOpen, CheckSquare, Heart, Home } from "lucide-react-native";
import { tempoV3Colors } from "@tempo/ui/theme";

/**
 * Tempo Flow bottom tab bar.
 * @source docs/design/v3/screens/mobile/today.html (tab bar)
 * @action navigateTab
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // v3 tab bar (tempo.css .tp-tab): ink when current on a hover wash, muted ink otherwise.
        tabBarActiveTintColor: tempoV3Colors.ink,
        tabBarInactiveTintColor: tempoV3Colors.inkMuted,
        tabBarActiveBackgroundColor: tempoV3Colors.hover,
        tabBarLabelStyle: { fontWeight: "600" },
        // The current-tab wash is a rounded pill inside the bar, as in tempo.css.
        tabBarItemStyle: { borderRadius: 12, overflow: "hidden", marginHorizontal: 4, marginVertical: 4 },
        tabBarStyle: {
          backgroundColor: tempoV3Colors.paper,
          borderTopColor: tempoV3Colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => (
            <CheckSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ color, size }) => (
            <BookOpen size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarIcon: ({ color, size }) => <Heart size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
