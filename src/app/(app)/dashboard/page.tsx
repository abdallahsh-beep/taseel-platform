import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { STATUS_COLORS } from "@/lib/types";
import { STATUS } from "@/lib/workflow";
import PlatformIcon from "@/components/PlatformIcon";
import Icon, { type IconName } from "@/components/Icon";

// لوحة المعلومات — إحصاء المنشورات والتصاميم والمحتوى وجميع الأنشطة
// الألوان لا تحمل الهوية وحدها: كل مقطع/صف مرفق باسمه وعدده نصياً

const ACTION_LABELS: Record<string, { label: string; icon: IconName }> = {
  created: { label: "بطاقات أُنشئت", icon: "edit" },
  updated: { label: "تعديلات محتوى", icon: "note" },
  status_changed: { label: "نقلات حالة", icon: "arrow-right" },
  rescheduled: { label: "تغييرات مواعيد", icon: "calendar-clock" },
  approved: { label: "اعتمادات", icon: "check-circle" },
  rejected: { label: "رفض/طلب تعديل", icon: "undo" },
  published: { label: "توثيقات نشر", icon: "rocket" },
  commented: { label: "تعليقات", icon: "comment" },
  approval_voided: { label: "اعتمادات أُبطلت", icon: "warning" },
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    statuses,
    statusCounts,
    categories,
    categoryCounts,
    platforms,
    variantCounts,
    publishedVariantCounts,
    designItems,
    overdueReady,
    monthPublished,
    commentsTotal,
    activityTotal,
    actionCounts,
    actorCounts,
    users,
    recent,
  ] = await Promise.all([
    db.status.findMany({ where: { phase: 1 }, orderBy: { sortOrder: "asc" } }),
    db.contentItem.groupBy({ by: ["statusId"], where: { deletedAt: null }, _count: { _all: true } }),
    db.category.findMany({ where: { isActive: true } }),
    db.contentItem.groupBy({ by: ["categoryId"], where: { deletedAt: null }, _count: { _all: true } }),
    db.platform.findMany({ orderBy: { id: "asc" } }),
    db.platformVariant.groupBy({ by: ["platformId"], _count: { _all: true } }),
    db.platformVariant.groupBy({ by: ["platformId"], where: { publishStatus: "published" }, _count: { _all: true } }),
    db.contentItem.count({ where: { deletedAt: null, designerId: { not: null } } }),
    db.contentItem.count({ where: { deletedAt: null, statusId: STATUS.READY, scheduledAt: { lt: now } } }),
    db.platformVariant.count({ where: { publishStatus: "published", publishedAt: { gte: monthStart } } }),
    db.comment.count(),
    db.activityLog.count(),
    db.activityLog.groupBy({ by: ["action"], _count: { _all: true } }),
    db.activityLog.groupBy({ by: ["actorId"], _count: { _all: true } }),
    db.user.findMany({ select: { id: true, name: true, roles: true } }),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }),
  ]);

  const countOf = (statusId: number) => statusCounts.find((s) => s.statusId === statusId)?._count._all ?? 0;
  const totalItems = statusCounts.reduce((a, s) => a + s._count._all, 0);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const itemTitles = new Map(
    (await db.contentItem.findMany({ where: { id: { in: recent.map((r) => r.entityId) } }, select: { id: true, title: true } })).map(
      (i) => [i.id, i.title],
    ),
  );

  const kpis: { label: string; value: number; icon: IconName; accent: string }[] = [
    { label: "إجمالي البطاقات", value: totalItems, icon: "grid", accent: "#304F6D" },
    { label: "منشور", value: countOf(STATUS.PUBLISHED), icon: "rocket", accent: STATUS_COLORS[6] },
    { label: "جاهز للنشر", value: countOf(STATUS.READY), icon: "check-circle", accent: STATUS_COLORS[5] },
    { label: "بانتظار الاعتماد", value: countOf(STATUS.PENDING), icon: "clock", accent: STATUS_COLORS[4] },
    { label: "بطاقات بتصميم", value: designItems, icon: "image", accent: "#C1996B" },
    { label: "متأخر عن موعده", value: overdueReady, icon: "warning", accent: "#B3402A" },
  ];

  const topActors = actorCounts
    .filter((a) => a.actorId)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 5);

  const maxCat = Math.max(1, ...categoryCounts.map((c) => c._count._all));

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">لوحة المعلومات</h1>
        <p className="mt-1 text-sm text-steel-500">
          إحصاءات المحتوى والتصاميم وكل أنشطة المنصة — حتى{" "}
          {now.toLocaleDateString("ar-SA", { dateStyle: "long" })}
        </p>
      </div>

      {/* بطاقات المؤشرات */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-steel-300/50 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Icon name={k.icon} size={20} className="text-navy-700" />
              <span className="h-1.5 w-8 rounded-full" style={{ background: k.accent }} />
            </div>
            <div className="mt-2 font-heading text-3xl font-black text-navy-900">{k.value}</div>
            <div className="mt-0.5 text-xs text-steel-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* توزيع الحالات */}
      <div className="mb-6 rounded-xl border border-steel-300/50 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-heading text-lg font-bold text-navy-900">توزيع البطاقات على مراحل سير العمل</h2>
        {totalItems > 0 ? (
          <>
            <div className="flex h-7 w-full gap-0.5 overflow-hidden rounded-lg" role="img" aria-label="شريط توزيع الحالات">
              {statuses.map((s) => {
                const c = countOf(s.id);
                if (!c) return null;
                const pct = (c / totalItems) * 100;
                return (
                  <div
                    key={s.id}
                    title={`${s.labelAr}: ${c} (${Math.round(pct)}%)`}
                    className="flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ width: `${pct}%`, background: STATUS_COLORS[s.id], minWidth: c ? 22 : 0 }}
                  >
                    {c}
                  </div>
                );
              })}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 xl:grid-cols-6">
              {statuses.map((s) => {
                const c = countOf(s.id);
                const pct = totalItems ? Math.round((c / totalItems) * 100) : 0;
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ background: STATUS_COLORS[s.id] }} />
                    <span className="text-ink-900">{s.labelAr}</span>
                    <span className="mr-auto font-bold text-navy-900">
                      {c} <span className="font-normal text-steel-500">({pct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="text-steel-500">لا بطاقات بعد</p>
        )}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* التصنيفات */}
        <div className="rounded-xl border border-steel-300/50 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-heading text-lg font-bold text-navy-900">المحتوى حسب التصنيف</h2>
          <ul className="flex flex-col gap-3">
            {categories.map((cat) => {
              const c = categoryCounts.find((x) => x.categoryId === cat.id)?._count._all ?? 0;
              return (
                <li key={cat.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-900">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color }} />
                      {cat.nameAr}
                    </span>
                    <span className="font-bold text-navy-900">{c}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-cream-50">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${(c / maxCat) * 100}%`, background: cat.color }}
                      title={`${cat.nameAr}: ${c}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* المنصات */}
        <div className="rounded-xl border border-steel-300/50 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-heading text-lg font-bold text-navy-900">نسخ المنشورات حسب المنصة</h2>
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((p) => {
              const total = variantCounts.find((v) => v.platformId === p.id)?._count._all ?? 0;
              const pub = publishedVariantCounts.find((v) => v.platformId === p.id)?._count._all ?? 0;
              return (
                <div key={p.id} className="rounded-lg border border-steel-300/40 bg-cream-50/60 p-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                    <PlatformIcon platform={p.key} size={16} />
                    {p.nameAr}
                  </div>
                  <div className="mt-1 font-heading text-2xl font-black text-navy-700">{total}</div>
                  <div className="text-xs text-steel-500">نسخة — منها {pub} منشورة</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-sand-100/60 px-3 py-2 text-xs text-ink-900/80">
            <Icon name="rocket" size={13} className="text-navy-700" /> نُشر هذا الشهر:{" "}
            <span className="font-bold text-navy-900">{monthPublished}</span> نسخة منصة
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* أنشطة المنصة */}
        <div className="rounded-xl border border-steel-300/50 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-heading text-lg font-bold text-navy-900">أنشطة المنصة</h2>
          <p className="mb-4 text-xs text-steel-500">
            إجمالي العمليات الموثقة: <span className="font-bold text-navy-900">{activityTotal}</span> · التعليقات:{" "}
            <span className="font-bold text-navy-900">{commentsTotal}</span>
          </p>
          <ul className="mb-5 grid grid-cols-2 gap-2 text-sm">
            {actionCounts
              .sort((a, b) => b._count._all - a._count._all)
              .map((a) => {
                const meta = ACTION_LABELS[a.action] ?? { label: a.action, icon: "note" as IconName };
                return (
                  <li key={a.action} className="flex items-center gap-2 rounded-lg bg-cream-50/70 px-3 py-2">
                    <Icon name={meta.icon} size={14} className="text-navy-700" />
                    <span className="text-ink-900">{meta.label}</span>
                    <span className="mr-auto font-bold text-navy-900">{a._count._all}</span>
                  </li>
                );
              })}
          </ul>
          <h3 className="mb-2 text-sm font-bold text-navy-900">الأكثر نشاطاً</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {topActors.map((a) => (
              <li key={a.actorId} className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sand-500 text-xs font-bold text-navy-900">
                  {(userName.get(a.actorId!) ?? "؟").slice(0, 1)}
                </span>
                <span className="text-ink-900">{userName.get(a.actorId!) ?? "غير معروف"}</span>
                <span className="mr-auto text-steel-500">{a._count._all} عملية</span>
              </li>
            ))}
          </ul>
        </div>

        {/* آخر الأنشطة */}
        <div className="rounded-xl border border-steel-300/50 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-heading text-lg font-bold text-navy-900">آخر الأنشطة</h2>
          <ul className="flex flex-col divide-y divide-steel-300/30">
            {recent.map((l) => {
              const meta = ACTION_LABELS[l.action] ?? { label: l.action, icon: "note" as IconName };
              return (
                <li key={l.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <Icon name={meta.icon} size={14} className="text-navy-700" />
                  <span className="font-bold text-navy-900">{l.actor?.name ?? "النظام"}</span>
                  <span className="text-steel-500">{meta.label}</span>
                  <span className="truncate text-navy-700">«{itemTitles.get(l.entityId) ?? ""}»</span>
                  <span className="mr-auto whitespace-nowrap text-[11px] text-steel-500">
                    {l.createdAt.toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              );
            })}
            {recent.length === 0 && <li className="py-6 text-center text-steel-500">لا أنشطة بعد</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
