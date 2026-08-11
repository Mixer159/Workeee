import { NotificationFeed } from "@/components/notifications/notification-feed";

/**
 * The in-app notification feed. Personal, like `/nastaveni/upozorneni` — no
 * manager guard, everybody has their own. Reached from the rail, where the
 * unread count sits on the link.
 */
export default function NotificationsPage() {
  return <NotificationFeed />;
}
