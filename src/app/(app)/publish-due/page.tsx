import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { STATUS } from "@/lib/workflow";
import PublishDueList from "@/components/PublishDueList";

export default async function PublishDuePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasAnyRole(user.roles, ["admin", "supervisor", "publisher"])) redirect("/");

  // نهاية الأسبوع الحالي (الأسبوع السعودي: الأحد → السبت)
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(startToday);
  weekEnd.setDate(weekEnd.getDate() + (7 - startToday.getDay()));

  const [ready, weekPrep] = await Promise.all([
    db.contentItem.findMany({
      where: { deletedAt: null, statusId: STATUS.READY },
      include: { category: true, variants: { include: { platform: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    // منشورات هذا الأسبوع التي ما تزال قيد التجهيز (لم تعتمد بعد)
    db.contentItem.findMany({
      where: {
        deletedAt: null,
        statusId: { in: [STATUS.IDEA, STATUS.WRITING, STATUS.DESIGN, STATUS.PENDING] },
        scheduledAt: { gte: startToday, lt: weekEnd },
      },
      include: { category: true, status: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  return (
    <PublishDueList
      items={ready.map((i) => ({
        id: i.id,
        title: i.title,
        baseText: i.baseText,
        scheduledAt: i.scheduledAt.toISOString(),
        categoryName: i.category.nameAr,
        categoryColor: i.category.color,
        variants: i.variants.map((v) => ({ id: v.id, platformKey: v.platform.key, platformName: v.platform.nameAr })),
      }))}
      weekPrep={weekPrep.map((i) => ({
        id: i.id,
        title: i.title,
        scheduledAt: i.scheduledAt.toISOString(),
        categoryColor: i.category.color,
        statusId: i.statusId,
        statusLabel: i.status.labelAr,
      }))}
      user={{ id: user.id, name: user.name, roles: user.roles }}
    />
  );
}
