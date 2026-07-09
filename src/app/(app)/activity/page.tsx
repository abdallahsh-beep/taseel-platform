import { db } from "@/lib/db";

const ACTION_LABELS: Record<string, string> = {
  created: "أنشأ البطاقة",
  updated: "عدّل المحتوى",
  status_changed: "نقل الحالة",
  rescheduled: "غيّر الموعد",
  approved: "اعتمد",
  rejected: "رفض",
  published: "وثّق النشر",
  commented: "علّق",
  approval_voided: "أُبطل الاعتماد",
};

export default async function ActivityPage() {
  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: true },
  });

  const itemIds = [...new Set(logs.map((l) => l.entityId))];
  const items = await db.contentItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, title: true } });
  const titles = new Map(items.map((i) => [i.id, i.title]));

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">سجل النشاط</h1>
        <p className="mt-1 text-sm text-steel-500">توثيق كامل لكل تغييرات سير العمل — سجل غير قابل للتعديل (FR-31)</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-steel-300/60 bg-white shadow-sm">
        <ul className="divide-y divide-steel-300/40">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-300 font-bold text-navy-900">
                {l.actor?.name.slice(0, 1) ?? "؟"}
              </span>
              <span className="font-bold text-navy-900">{l.actor?.name ?? "النظام"}</span>
              <span className="text-steel-500">{ACTION_LABELS[l.action] ?? l.action}</span>
              <span className="font-medium text-navy-700">«{titles.get(l.entityId) ?? l.entityId.slice(0, 8)}»</span>
              {l.detail && <span className="text-xs text-steel-500">({l.detail})</span>}
              <span className="mr-auto whitespace-nowrap text-xs text-steel-500">
                {l.createdAt.toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </li>
          ))}
          {logs.length === 0 && <li className="px-4 py-10 text-center text-steel-500">لا نشاط بعد</li>}
        </ul>
      </div>
    </div>
  );
}
