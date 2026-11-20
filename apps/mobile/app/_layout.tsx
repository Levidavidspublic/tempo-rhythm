import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { Slot } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

import { PrefsProvider } from '@/components/v3/prefs';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import { bootstrapRTL } from '@/lib/rtlBootstrap';
import { getConvexUrl, readPublicConvexUrl } from '@/utils/convexConfig';

// אסטרטגיית RTL (ראה docs/rtl-knowhow.md):
// 1. תוסף expo-localization (app.json) - מגדיר RTL ברמת ה-Native (עובד ב-Dev Builds ו-Production)
// 2. עיצוב RTL מפורש (lib/rtl.ts) - עובד בכל מקום כולל Expo Go
// 3. סידור ידני של טאבים - מטפל ב-Tab Bar בכל הסביבות
//
// הגישה ההיברידית מבטיחה תמיכה עקבית בעברית/RTL בכל הסביבות.

// אחסון מאובטח של הטוקן (Token) באמצעות expo-secure-store
// זה קריטי לשמירה על אבטחת המידע של המשתמש
const secureStorage = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // טיפול שקט בשגיאות שמירה
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // טיפול שקט בשגיאות מחיקה
    }
  },
};

export default function RootLayout() {
  const convexUrl = readPublicConvexUrl();
  const convex = useMemo(() => {
    if (!convexUrl) {
      return null;
    }
    return new ConvexReactClient(getConvexUrl());
  }, [convexUrl]);

  // Bootstrap RTL for Expo Go on first mount
  useEffect(() => {
    bootstrapRTL().catch(() => {
      // Silently handle errors - bootstrap will reload app if needed
    });
  }, []);

  if (!convex) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" translucent={false} backgroundColor="#0a0a0a" />
        <View className="flex-1 items-center justify-center bg-background px-6">
          <Text className="text-center font-serif text-2xl text-foreground">
            This build is missing its app URL.
          </Text>
          <Text className="mt-3 text-center text-base text-muted-foreground">
            Add EXPO_PUBLIC_CONVEX_URL to the environment, then start again.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {/* StatusBar: translucent={false} מונע מהתוכן להיכנס מתחת לבר הסטטוס באנדרואיד */}
      {/* זה עובד ב-Expo Go, בניגוד להגדרות ב-app.json */}
      <StatusBar style="light" translucent={false} backgroundColor="#0a0a0a" />

      {/* ספק האימות של Convex עוטף את כל האפליקציה ומנהל את מצב ההתחברות */}
      <ConvexAuthProvider client={convex} storage={secureStorage}>
        {/* ספק RevenueCat לניהול מנויים ורכישות */}
        <RevenueCatProvider>
          {/* Slot מעבד את הראוטים (Routes) הילדים - ה-Layouts הפנימיים מנהלים את הניווט שלהם */}
          {/* v3 preferences (language, theme, text size) for the Tempo screens and onboarding */}
          <PrefsProvider>
            <Slot />
          </PrefsProvider>
        </RevenueCatProvider>
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}
