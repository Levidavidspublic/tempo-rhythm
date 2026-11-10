import { useConvexAuth, useQuery } from "convex/react";
import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { usePrefs } from "@/components/v3/prefs";
import { ToastProvider } from "@/components/v3/Toast";
import { api } from "@/convex/_generated/api";

/**
 * (tempo) group — wraps the new Tempo Flow mobile surfaces.
 * Tabs live under (tempo)/(tabs); modal routes live as siblings.
 * Signed-out visitors go to sign-in: every screen here reads the person's own data.
 */
export default function TempoLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { colors, dark, reducedMotion } = usePrefs();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  // An account that hasn't finished onboarding goes back to it, however it got here. A deleted
  // account has no profile (null) and stays, so Settings can still offer Sign out.
  if (profile && profile.onboardedAt === undefined) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return (
    <ToastProvider>
      <StatusBar style={dark ? "light" : "dark"} backgroundColor={colors.ground} translucent={false} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.ground },
          animation: reducedMotion ? "none" : "default",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="habits" />
        <Stack.Screen name="journal" />
        <Stack.Screen name="routines" />
        <Stack.Screen name="movement" />
        <Stack.Screen name="breathwork" />
        <Stack.Screen name="session-player" />
        <Stack.Screen name="tracking" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="accessibility" />
        <Stack.Screen name="templates" />
        <Stack.Screen name="page/[id]" />
        <Stack.Screen name="capture" options={{ presentation: "modal" }} />
        <Stack.Screen name="voice-call" options={{ presentation: "fullScreenModal" }} />
      </Stack>
    </ToastProvider>
  );
}
