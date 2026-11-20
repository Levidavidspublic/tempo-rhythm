import { useConvexAuth, useQuery } from 'convex/react';
import { Redirect, Slot, useLocalSearchParams, useSegments } from 'expo-router';

import { IS_DEV_MODE } from '@/config/appConfig';
import { api } from '@/convex/_generated/api';

export default function AuthRoutesLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const segments = useSegments();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  // Whether onboarding is finished lives on the account, not in the route the person came from.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : 'skip');

  // המתנה לטעינת סטטוס האימות
  if (isLoading) {
    return null;
  }

  // בדיקה אם זה מצב תצוגה מקדימה (preview mode)
  // במצב תצוגה מקדימה, משתמשים מחוברים יכולים לגשת לדפי auth לצורך דיבאג
  const isPreviewMode = IS_DEV_MODE && preview === 'true';

  // בדיקה האם המסלול הנוכחי הוא paywall
  // מסלול זה צריך להיות נגיש גם למשתמשים מחוברים (למשל מהגדרות/דיבאג)
  // המרה למערך מחרוזות כללי כדי לאפשר בדיקת includes
  const segmentStrings = segments as string[];
  const isPaywallRoute = segmentStrings.includes('paywall');
  // Onboarding (v3) runs signed in: it saves the person's choices to their account.
  const isOnboardingRoute = segmentStrings.includes('onboarding');
  const isAllowedForAuthenticated = isPaywallRoute || isPreviewMode || isOnboardingRoute;

  if (!isAuthenticated && isOnboardingRoute) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // אם המשתמש כבר מחובר, הפנה אותו לאזור המאומת
  // אלא אם הוא במסלול paywall או במצב תצוגה מקדימה
  // זה מונע ממשתמשים מחוברים לגשת למסכי התחברות/הרשמה
  // אבל מאפשר להם לגשת דרך הגדרות/דיבאג במצב preview
  // An account that hasn't finished onboarding goes back to it; everyone else lands on Today.
  if (isAuthenticated && !isAllowedForAuthenticated) {
    if (profile === undefined) return null;
    return <Redirect href={profile?.onboardedAt === undefined ? '/(auth)/onboarding' : '/(tempo)/(tabs)/today'} />;
  }

  // שימוש ב-Slot כדי לעבד את המסכים הפנימיים (sign-in, sign-up, paywall)
  // אנחנו משתמשים ב-Slot במקום Stack כי ה-Layout הראשי כבר מספק את הקונטקסט הדרוש
  return <Slot />;
}
