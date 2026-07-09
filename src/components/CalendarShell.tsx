"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemLite, OccasionLite, CategoryLite, SessionLite } from "@/lib/types";
import { GREG_MONTHS_AR } from "@/lib/hijri";
import { rescheduleItem, createItem, createShareLink } from "@/app/actions";
import { canCreate, canReschedule } from "@/lib/workflow";
import MonthGrid from "./views/MonthGrid";
import QuarterGrid from "./views/QuarterGrid";
import ListTable from "./views/ListTable";
import CardModal from "./CardModal";
import QuickNote from "./QuickNote";
import PlatformIcon from "./PlatformIcon";
import Icon from "./Icon";

type View = "month" | "quarter" | "list";

const PLATFORM_OPTIONS = [
  { id: 1, key: "x", label: "إكس" },
  { id: 2, key: "instagram", label: "إنستجرام" },
  { id: 3, key: "facebook", label: "فيسبوك" },
  { id: 4, key: "linkedin", label: "لينكد إن" },
  { id: 5, key: "whatsapp", label: "واتساب" },
  { id: 6, key: "telegram", label: "تليجرام" },
];

export default function CalendarShell({
  items,
  occasions,
  categories,
  user,
}: {
  items: ItemLite[];
  occasions: OccasionLite[];
  categories: CategoryLite[];
  user: SessionLite;
}) {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date(2026, 6, 1)); // يوليو 2026 (بيانات تجريبية)
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [noteItem, setNoteItem] = useState<ItemLite | null>(null);
  // تاريخ البطاقة الجديدة (YYYY-MM-DD)؛ null = النافذة مغلقة
  const [newDate, setNewDate] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharePending, startShare] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(
    () => (catFilter ? items.filter((i) => i.categoryName === catFilter) : items),
    [items, catFilter],
  );

  const quarter = Math.floor(cursor.getMonth() / 3); // 0..3
  const quarterLabel = ["الأول", "الثاني", "الثالث", "الرابع"][quarter];

  function shift(dir: 1 | -1) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + dir * (view === "quarter" ? 3 : 1));
    setCursor(d);
  }

  function handleDrop(itemId: string, dateISO: string) {
    if (!canReschedule(user.roles)) {
      setError("دورك لا يملك تعديل المواعيد");
      return;
    }
    startTransition(async () => {
      const res = await rescheduleItem(itemId, dateISO);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      {/* الترويسة */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-black text-navy-900">الروزنامة</h1>
          <p className="mt-1 text-sm text-steel-500">
            {view === "quarter"
              ? `الربع ${quarterLabel} من العام ${cursor.getFullYear()}`
              : `${GREG_MONTHS_AR[cursor.getMonth()]} ${cursor.getFullYear()}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* التنقل */}
          <div className="flex items-center overflow-hidden rounded-lg border border-steel-300 bg-white">
            <button onClick={() => shift(-1)} className="px-3 py-2 hover:bg-cream-50" aria-label="السابق"><Icon name="chevron-right" size={18} /></button>
            <button
              onClick={() => setCursor(new Date(2026, 6, 1))}
              className="border-x border-steel-300 px-3 py-2 text-sm hover:bg-cream-50"
            >
              يوليو ٢٠٢٦
            </button>
            <button onClick={() => shift(1)} className="px-3 py-2 hover:bg-cream-50" aria-label="التالي"><Icon name="chevron-left" size={18} /></button>
          </div>

          {/* طرق العرض */}
          <div className="flex overflow-hidden rounded-lg border border-navy-900 bg-white text-sm">
            {(
              [
                ["month", "شهري"],
                ["quarter", "ربع سنوي"],
                ["list", "قائمة"],
              ] as [View, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 font-bold transition ${
                  view === v ? "bg-navy-900 text-cream-50" : "text-navy-900 hover:bg-cream-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "quarter" && (
            <button
              onClick={() => window.print()}
              title="تصدير الروزنامة الربع سنوية PDF / طباعة"
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 px-3 py-2 text-sm font-bold text-navy-700 transition hover:bg-navy-700 hover:text-cream-50"
            >
              <Icon name="print" size={15} /> PDF
            </button>
          )}

          {user.roles.some((r) => ["admin", "supervisor"].includes(r)) && (
            <button
              onClick={() => setShowShare(!showShare)}
              title="رابط معاينة الشهر للضيوف — قراءة فقط"
              className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 px-3 py-2 text-sm font-bold text-navy-700 transition hover:bg-navy-700 hover:text-cream-50"
            >
              <Icon name="link" size={15} /> مشاركة
            </button>
          )}

          {canCreate(user.roles) && (
            <button
              onClick={() => setNewDate(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-15`)}
              className="rounded-lg bg-sand-500 px-4 py-2 text-sm font-bold text-navy-900 shadow-sm transition hover:bg-sand-600 hover:text-cream-50"
            >
              + بطاقة جديدة
            </button>
          )}
        </div>
      </div>

      {showShare && (
        <div className="mb-4 rounded-xl border border-navy-700/30 bg-white p-4">
          <p className="mb-2 text-sm font-bold text-navy-900">
            رابط معاينة شهر {GREG_MONTHS_AR[cursor.getMonth()]} {cursor.getFullYear()} للضيوف (قراءة فقط — بلا أسماء أو تعليقات داخلية)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={sharePending}
              onClick={() =>
                startShare(async () => {
                  const res = await createShareLink(
                    "month",
                    null,
                    `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
                    7,
                  );
                  if ("url" in res && res.url) setShareUrl(`${window.location.origin}${res.url}`);
                  else if ("error" in res && res.error) setError(res.error);
                })
              }
              className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-bold text-cream-50 disabled:opacity-60"
            >
              إنشاء رابط (صلاحية 7 أيام)
            </button>
            {shareUrl && (
              <>
                <input readOnly value={shareUrl} dir="ltr" onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-lg border border-steel-300 bg-cream-50 px-3 py-2 text-left text-xs" />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sand-500 px-3 py-2 text-xs font-bold text-navy-900"
                >
                  <Icon name="copy" size={13} /> نسخ
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* فلترة التصنيفات (الترميز اللوني) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCatFilter(null)}
          className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
            !catFilter ? "border-navy-900 bg-navy-900 text-cream-50" : "border-steel-300 bg-white text-steel-500"
          }`}
        >
          الكل
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatFilter(catFilter === c.nameAr ? null : c.nameAr)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition ${
              catFilter === c.nameAr ? "border-navy-900 bg-white" : "border-steel-300/60 bg-white text-ink-900/80"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.nameAr}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button onClick={() => setError(null)} className="font-bold" aria-label="إغلاق"><Icon name="close" size={14} /></button>
        </div>
      )}

      {/* العرض */}
      <div className="print-area">
        {view === "month" && (
          <MonthGrid cursor={cursor} items={filtered} occasions={occasions} onDrop={handleDrop} onOpen={setOpenItem} onNote={setNoteItem} onAddOnDay={canCreate(user.roles) ? setNewDate : undefined} />
        )}
        {view === "quarter" && (
          <QuarterGrid cursor={cursor} items={filtered} occasions={occasions} onDrop={handleDrop} onOpen={setOpenItem} onNote={setNoteItem} onAddOnDay={canCreate(user.roles) ? setNewDate : undefined} />
        )}
        {view === "list" && <ListTable items={filtered} onOpen={setOpenItem} onNote={setNoteItem} />}
      </div>

      {openItem && (
        <CardModal itemId={openItem} user={user} onClose={() => setOpenItem(null)} />
      )}

      {noteItem && (
        <QuickNote itemId={noteItem.id} title={noteItem.title} onClose={() => setNoteItem(null)} />
      )}

      {newDate && (
        <NewItemDialog categories={categories} defaultDate={newDate} onClose={() => setNewDate(null)} onError={setError} />
      )}
    </div>
  );
}

// ---------- نافذة بطاقة جديدة ----------
function NewItemDialog({
  categories,
  defaultDate,
  onClose,
  onError,
}: {
  categories: CategoryLite[];
  defaultDate: string;
  onClose: () => void;
  onError: (e: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [campaigns, setCampaigns] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [templates, setTemplates] = useState<any[]>([]);
  const [baseText, setBaseText] = useState("");
  const [hashtags, setHashtags] = useState("");

  useEffect(() => {
    fetch("/api/composer-meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCampaigns(d.campaigns ?? []); setTemplates(d.templates ?? []); } })
      .catch(() => {});
  }, []);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await createItem(formData);
      if (res?.error) onError(res.error);
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4" onClick={onClose}>
      <form
        action={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="mb-4 font-heading text-xl font-black text-navy-900">بطاقة محتوى جديدة</h2>

        <label className="mb-1 block text-sm font-bold">العنوان *</label>
        <input name="title" required className="mb-3 w-full rounded-lg border border-steel-300 px-3 py-2 outline-none focus:border-navy-700" />

        {templates.length > 0 && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-bold">ابدأ من قالب</label>
            <select
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value);
                if (t) { setBaseText(t.baseText ?? ""); setHashtags(t.hashtags ?? ""); }
              }}
              className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">— بدون قالب —</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
        )}

        <label className="mb-1 block text-sm font-bold">النص الأساسي</label>
        <textarea name="baseText" rows={3} value={baseText} onChange={(e) => setBaseText(e.target.value)} className="mb-3 w-full rounded-lg border border-steel-300 px-3 py-2 outline-none focus:border-navy-700" />

        <label className="mb-1 block text-sm font-bold">الهاشتاقات</label>
        <input name="hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} className="mb-3 w-full rounded-lg border border-steel-300 px-3 py-2 outline-none focus:border-navy-700" />

        <label className="mb-1 block text-sm font-bold">صورة المنشور (اختياري)</label>
        <input
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="mb-3 w-full rounded-lg border border-steel-300 px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-navy-700 file:px-3 file:py-1 file:text-cream-50"
        />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-bold">الحملة</label>
            <select name="campaignId" defaultValue="" className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2">
              <option value="">— بدون حملة —</option>
              {campaigns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold">وسوم (بفواصل)</label>
            <input name="labels" placeholder="مثال: أولوية, تصميم" className="w-full rounded-lg border border-steel-300 px-3 py-2" />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-bold">التصنيف *</label>
            <select name="categoryId" required className="w-full rounded-lg border border-steel-300 bg-white px-3 py-2">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameAr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold">تاريخ النشر *</label>
            <input name="date" type="date" required defaultValue={defaultDate} className="w-full rounded-lg border border-steel-300 px-3 py-2" />
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-bold">وقت النشر</label>
          <input name="time" type="time" defaultValue="17:00" className="w-full rounded-lg border border-steel-300 px-3 py-2" />
        </div>

        <label className="mb-1 block text-sm font-bold">المنصات المستهدفة</label>
        <div className="mb-5 flex flex-wrap gap-3">
          {PLATFORM_OPTIONS.map((p) => (
            <label key={p.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="platforms" value={p.id} defaultChecked={p.id === 1} className="accent-navy-700" />
              <PlatformIcon platform={p.key} size={14} />
              {p.label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-steel-300 px-4 py-2 text-sm">إلغاء</button>
          <button disabled={pending} className="rounded-lg bg-navy-900 px-5 py-2 text-sm font-bold text-cream-50 disabled:opacity-60">
            {pending ? "جارٍ الإنشاء..." : "إنشاء البطاقة"}
          </button>
        </div>
      </form>
    </div>
  );
}
