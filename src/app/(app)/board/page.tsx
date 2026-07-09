import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import Kanban from "@/components/Kanban";
import type { ItemLite } from "@/lib/types";

export default async function BoardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [items, statuses] = await Promise.all([
    db.contentItem.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        status: true,
        writer: true,
        variants: { include: { platform: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.status.findMany({ where: { phase: 1 }, orderBy: { sortOrder: "asc" } }),
  ]);

  const itemsLite: ItemLite[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    scheduledAt: i.scheduledAt.toISOString(),
    statusId: i.statusId,
    statusLabel: i.status.labelAr,
    categoryName: i.category.nameAr,
    categoryColor: i.category.color,
    platforms: i.variants.map((v) => v.platform.key),
    writerName: i.writer?.name ?? null,
    commentCount: i._count.comments,
  }));

  return (
    <Kanban
      items={itemsLite}
      statuses={statuses.map((s) => ({ id: s.id, labelAr: s.labelAr }))}
      user={{ id: user.id, name: user.name, roles: user.roles }}
    />
  );
}
