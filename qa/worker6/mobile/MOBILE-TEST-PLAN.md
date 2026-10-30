# Mobile test plan. Status: waiting. No mobile app exists yet (UNKNOWN if one is planned).
Trigger: run once a mobile build (APK/IPA or Expo dev build) exists for Tempo or OmniAgent.

Tool choice
- Maestro first (YAML flows, works for React Native/Expo and native). Docs: https://docs.maestro.dev/
- Detox only if the app is React Native and needs gray-box sync. Docs: https://wix.github.io/Detox/
- Appium for real-device cloud runs. Docs: https://appium.io/docs/en/latest/
- Monkey: Android `adb shell monkey -p <pkg> -v 5000`. Docs: https://developer.android.com/studio/test/other-testing-tools/monkey

Per loop (same yes/no rule as web; a NO sends the ticket back)
1. Install on Android emulator (API 34) and iOS simulator (latest).
2. Maestro flows: launch, onboarding, main job, each tab/button, back nav, background/foreground, rotate, offline mode.
3. Monkey 5000 events (Android), seeded. Pass = no crash/ANR.
4. Extreme input: huge text, Hebrew RTL, emoji, large font scale.
5. Standards: touch target >= 48dp (https://developer.android.com/guide/topics/ui/accessibility/apps) and 44pt (https://developer.apple.com/design/human-interface-guidelines/accessibility); cold start, see https://developer.android.com/topic/performance/vitals/launch-time ; ANR/crash rates per Android vitals https://developer.android.com/topic/performance/vitals
6. Screen reader pass: TalkBack and VoiceOver label every control.

Sample flow: mobile/flows/smoke.yaml
