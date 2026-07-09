import { db } from "@/lib/db";
import { gregLabel, hijriFullLabel, hijriLabel, WEEKDAYS_AR, GREG_MONTHS_AR } from "@/lib/hijri";
import { STATUS } from "@/lib/workflow";
import PostPreview from "@/components/PostPreview";
import PlatformIcon from "@/components/PlatformIcon";
import Icon from "@/components/Icon";

// صفحة معاينة الضيوف — قراءة فقط (FR-39):
// بلا مصادقة، بلا تعليقات داخلية، بلا أسماء أو بيانات مستخدمين
// يُعرض للضيف الخارجي المحتوى المعتمد فقط (جاهز/منشور) — لا تُكشف المسودات الداخلية
const GUEST_VISIBLE_STATUSES: number[] = [STATUS.READY, STATUS.PUBLISHED];

function GuestShell({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <main className="pattern-bg min-h-screen bg-cream-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-900 px-5 py-4 text-cream-50">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden>
              <path d="M4 4h24l8 10v22H22L4 18V4z" fill="#FBF6EF" />
              <path d="M10 30l10-10 10 10H10z" fill="#C1996B" />
            </svg>
            <div>
              <div className="font-heading text-xl font-black">روزنامة تأصيل</div>
              <div className="text-xs text-sand-300">جمعية تأصيل التعليمية</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-500 px-3 py-1 text-xs font-bold text-navy-900"><Icon name="eye" size={13} /> معاينة للقراءة فقط</span>
        </header>
        {children}
        <footer className="mt-8 text-center text-xs text-steel-500">{note}</footer>
      </div>
    </main>
  );
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await db.shareLink.findUnique({ where: { token } });

  const invalid = !link || link.revokedAt || link.expiresAt < new Date();
  if (invalid) {
    return (
      <GuestShell note="">
        <div className="rounded-2xl border border-steel-300/60 bg-white p-12 text-center">
          <div className="mb-3 flex justify-center text-steel-500"><Icon name="lock" size={40} /></div>
          <h1 className="mb-2 font-heading text-2xl font-black text-navy-900">الرابط غير صالح</h1>
          <p className="text-steel-500">انتهت صلاحية رابط المعاينة أو تم إبطاله — تواصل مع فريق الجمعية للحصول على رابط جديد.</p>
        </div>
      </GuestShell>
    );
  }

  await db.shareLink.update({ where: { id: link.id }, data: { viewCount: { increment: 1 } } });
  const expiryNote = `تنتهي صلاحية هذا الرابط في ${gregLabel(link.expiresAt)} — أُنشئ بواسطة منصة روزنامة تأصيل`;

  // ---------- معاينة بطاقة واحدة ----------
  if (link.scope === "item" && link.targetId) {
    const item = await db.contentItem.findUnique({
      where: { id: link.targetId },
      include: { category: true, variants: { include: { platform: true } } },
    });
    if (!item || item.deletedAt || !GUEST_VISIBLE_STATUSES.includes(item.statusId)) {
      return (
        <GuestShell note="">
          <div className="rounded-2xl border border-steel-300/60 bg-white p-12 text-center text-steel-500">المحتوى لم يعد متاحاً</div>
        </GuestShell>
      );
    }
    const d = item.scheduledAt;
    return (
      <GuestShell note={expiryNote}>
        <div className="rounded-2xl border border-steel-300/60 bg-white p-6">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: item.category.color }}>
              {item.category.nameAr}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm text-steel-500">
              <Icon name="calendar" size={14} /> {gregLabel(d)} — {hijriFullLabel(d)}
            </span>
          </div>
          <h1 className="mb-5 font-heading text-3xl font-black text-navy-900">{item.title}</h1>
          <div className="grid gap-5 md:grid-cols-2">
            {item.variants.map((v) => (
              <div key={v.id}>
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-navy-900">
                  <PlatformIcon platform={v.platform.key} size={16} />
                  {v.platform.nameAr}
                </div>
                <PostPreview
                  platform={v.platform.key}
                  text={(v.variantText || item.baseText) + (item.hashtags ? `\n\n${item.hashtags}` : "")}
                />
              </div>
            ))}
          </div>
        </div>
      </GuestShell>
    );
  }

  // ---------- معاينة روزنامة شهر (كل الحسابات بتوقيت الرياض لتوافق الروزنامة الداخلية) ----------
  // مفتاح اليوم بتوقيت الرياض (YYYY-MM-DD) بدل UTC
  const riyadhDayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const start = link.periodStart ?? new Date();
  const ym = riyadhDayKey(start).slice(0, 7); // "YYYY-MM" بتوقيت الرياض
  const [sy, sm] = ym.split("-").map(Number);
  const monthStart = new Date(`${ym}-01T00:00:00+03:00`);
  const monthEnd = new Date(`${sm === 12 ? sy + 1 : sy}-${String(sm === 12 ? 1 : sm + 1).padStart(2, "0")}-01T00:00:00+03:00`);
  const items = await db.contentItem.findMany({
    where: {
      deletedAt: null,
      scheduledAt: { gte: monthStart, lt: monthEnd },
      statusId: { in: GUEST_VISIBLE_STATUSES }, // لا تُكشف المسودات للضيف
    },
    include: { category: true, variants: { include: { platform: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  const byDay = new Map<string, typeof items>();
  for (const it of items) {
    const k = riyadhDayKey(it.scheduledAt);
    if (!byDay.has(k)) byDay.set(k, [] as typeof items);
    byDay.get(k)!.push(it);
  }

  return (
    <GuestShell note={expiryNote}>
      <h1 className="mb-1 font-heading text-3xl font-black text-navy-900">
        خطة محتوى شهر {GREG_MONTHS_AR[sm - 1]} {sy}
      </h1>
      <p className="mb-6 text-sm text-steel-500">{items.length} منشوراً وفعالية مخططة</p>

      <div className="flex flex-col gap-3">
        {[...byDay.entries()].map(([k, dayItems]) => {
          const d = new Date(`${k}T12:00:00`);
          return (
            <div key={k} className="overflow-hidden rounded-xl border border-steel-300/60 bg-white">
              <div className="flex items-baseline gap-3 bg-navy-900 px-4 py-2 text-cream-50">
                <span className="font-heading text-lg font-bold">
                  {WEEKDAYS_AR[d.getDay()]} {d.getDate()} {GREG_MONTHS_AR[d.getMonth()]}
                </span>
                <span className="text-xs text-sand-300">{hijriLabel(d)}</span>
              </div>
              <ul className="divide-y divide-steel-300/30">
                {dayItems.map((it) => (
                  <li key={it.id} className="flex flex-wrap items-center gap-2.5 px-4 py-2.5 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.category.color }} />
                    <span className="font-medium text-navy-900">{it.title}</span>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: it.category.color }}>
                      {it.category.nameAr}
                    </span>
                    <span className="mr-auto flex items-center gap-1.5">
                      {it.variants.map((v) => (
                        <PlatformIcon key={v.id} platform={v.platform.key} size={13} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-steel-300 bg-white py-14 text-center text-steel-500">
            لا محتوى مخططاً في هذا الشهر
          </div>
        )}
      </div>
    </GuestShell>
  );
}
