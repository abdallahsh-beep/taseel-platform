import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import NotificationList from "@/components/NotificationList";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <NotificationList
      notifications={notifications.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        itemId: n.itemId,
        read: !!n.readAt,
        createdAt: n.createdAt.toISOString(),
      }))}
      user={{ id: user.id, name: user.name, roles: user.roles }}
    />
  );
}
