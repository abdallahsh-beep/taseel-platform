import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import CalendarShell from "@/components/CalendarShell";
import type { ItemLite, OccasionLite, CategoryLite } from "@/lib/types";

export default async function CalendarPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [items, occasions, categories] = await Promise.all([
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
    db.occasion.findMany(),
    db.category.findMany({ where: { isActive: true } }),
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

  const occasionsLite: OccasionLite[] = occasions.map((o) => ({
    id: o.id,
    nameAr: o.nameAr,
    hijriMonth: o.hijriMonth,
    hijriDay: o.hijriDay,
    gregMonth: o.gregMonth,
    gregDay: o.gregDay,
    specificDate: o.specificDate?.toISOString() ?? null,
    color: o.color,
  }));

  const categoriesLite: CategoryLite[] = categories.map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    color: c.color,
  }));

  return (
    <CalendarShell
      items={itemsLite}
      occasions={occasionsLite}
      categories={categoriesLite}
      user={{ id: user.id, name: user.name, roles: user.roles }}
    />
  );
}
