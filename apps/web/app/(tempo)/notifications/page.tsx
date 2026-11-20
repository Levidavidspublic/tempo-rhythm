/**
 * @screen: notifications
 * @category: You
 * @source: docs/design/v3/screens/web/notifications.html
 * @summary: Notices worth knowing, newest first; open one to mark it read.
 * @queries: notifications.list
 * @mutations: notifications.markRead, notifications.markAllRead
 * @auth: required (calm sign-in link otherwise)
 */
import { NotificationsScreen } from "@/components/notifications/NotificationsScreen";

export default function Page() {
  return <NotificationsScreen />;
}
