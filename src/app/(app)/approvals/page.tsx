import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import { STATUS } from "@/lib/workflow";
import ApprovalList from "@/components/ApprovalList";

export default async function ApprovalsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasAnyRole(user.roles, ["admin", "supervisor"])) redirect("/");

  const items = await db.contentItem.findMany({
    where: { deletedAt: null, statusId: STATUS.PENDING },
    include: {
      category: true,
      writer: true,
      variants: { include: { platform: true } },
      approvals: { where: { decision: "pending" }, include: { requestedBy: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return (
    <ApprovalList
      items={items.map((i) => ({
        id: i.id,
        title: i.title,
        baseText: i.baseText,
        scheduledAt: i.scheduledAt.toISOString(),
        categoryName: i.category.nameAr,
        categoryColor: i.category.color,
        writerName: i.writer?.name ?? null,
        requestedBy: i.approvals[0]?.requestedBy?.name ?? "—",
        requestedAt: i.approvals[0]?.requestedAt?.toISOString() ?? null,
        platforms: i.variants.map((v) => ({ key: v.platform.key, name: v.platform.nameAr })),
      }))}
      user={{ id: user.id, name: user.name, roles: user.roles }}
    />
  );
}
