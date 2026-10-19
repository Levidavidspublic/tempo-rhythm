# KB-70 notification action and focus evidence

The mounted `/notifications` screen still uses the same profile/list queries and `markRead({ notificationId })` and `markAllRead({})` mutations. A read row now returns focus only when the person stayed on its unread button while a delayed query update arrived. If focus moved to the preferences link or another control, the row leaves it there. “Mark all read” accepts one in-flight submission and shows a short localized pending explanation beside its unchanged button label; its existing success and error copy remain.

The [contact sheet](./kb-70-notification-actions-keep-focus-and-submit-once.jpg) will pair the original checked-in mounted component saved before editing with the updated mount and controlled gallery at 390 and 1280 px in English and Hebrew, light and dark. Screens use fictional Maya, Dana and Yoni notices and mocked auth/query/mutation boundaries. These are component comparisons, not claims about a live account. The original source capture was saved before editing at `/workspace/work/kb-70-evidence/NotificationsScreen.before.tsx`.

The hydrated browser fixture exercises delayed `markRead` updates in both focus paths, double submission and failure/success of `markAllRead`, plus the exported gallery’s default, pending, success, error, disabled, empty and overflow views. It checks keyboard interaction, one h1/main, RTL, reduced motion, 44 px phone targets and horizontal overflow. Exact browser results and source/evidence commits will be added after the capture run.

New Hebrew is machine-drafted for Amit's native review. Device screen-reader and live-account behavior remain UNKNOWN.
