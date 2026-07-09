"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importCsv } from "@/app/actions";
import Icon from "./Icon";

const TEMPLATE = `العنوان,التاريخ,الوقت,التصنيف,المنصات,النص
تغريدة عن بر الوالدين,2026-07-20,09:00,تغريدات,x,«ورضا الله في رضا الوالدين»
بطاقة فعالية الملتقى,2026-07-25,17:30,فعالية حضورية,x;instagram,ندعوكم لحضور الملتقى`;

export default function ImportForm() {
  const [result, setResult] = useState<{ created?: number; errors?: string[]; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await importCsv(formData);
      setResult(res);
      if (!res?.error) router.refresh();
    });
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">استيراد روزنامة</h1>
        <p className="mt-1 text-sm text-steel-500">
          رحّل روزنامتك الحالية من Excel: احفظ الجدول بصيغة CSV (UTF-8) ثم ارفعه أو الصق محتواه
        </p>
      </div>

      <div className="mb-5 rounded-xl border border-sand-300 bg-sand-100/40 p-4 text-sm">
        <p className="mb-2 font-bold text-navy-900">تنسيق الأعمدة المطلوب (السطر الأول عناوين):</p>
        <pre dir="rtl" className="overflow-x-auto rounded-lg bg-white p-3 text-xs leading-6 text-ink-900">{TEMPLATE}</pre>
        <ul className="mt-2 list-inside list-disc text-xs text-steel-500">
          <li>التاريخ: YYYY-MM-DD · الوقت اختياري (HH:MM، الافتراضي 12:00)</li>
          <li>التصنيف: بنفس اسمه في المنصة (تغريدات، إنستجرام، فيسبوك، لينكد إن، فعالية حضورية، برنامج تعليمي)</li>
          <li>المنصات مفصولة بفاصلة منقوطة: x؛ instagram؛ facebook؛ linkedin (أو بأسمائها العربية)</li>
          <li>كل الصفوف تُنشأ بحالة «فكرة» وتُسند لصانع المحتوى</li>
        </ul>
      </div>

      <form action={submit} className="rounded-xl border border-steel-300/60 bg-white p-5">
        <label className="mb-1 block text-sm font-bold text-navy-900">ملف CSV</label>
        <input type="file" name="file" accept=".csv,text/csv"
          className="mb-4 w-full rounded-lg border border-steel-300 bg-cream-50 px-3 py-2 text-sm file:ml-3 file:rounded file:border-0 file:bg-navy-700 file:px-3 file:py-1 file:text-cream-50" />
        <div className="mb-1 flex items-center gap-2">
          <span className="h-px flex-1 bg-steel-300/50" />
          <span className="text-xs text-steel-500">أو</span>
          <span className="h-px flex-1 bg-steel-300/50" />
        </div>
        <label className="mb-1 block text-sm font-bold text-navy-900">الصق محتوى CSV</label>
        <textarea name="csvText" rows={6} dir="rtl" placeholder={TEMPLATE}
          className="mb-4 w-full rounded-lg border border-steel-300 bg-cream-50 px-3 py-2 text-sm leading-6" />
        <button disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-6 py-2.5 font-heading font-bold text-cream-50 disabled:opacity-60">
          {pending ? "جارٍ الاستيراد..." : <><Icon name="import" size={16} /> استيراد</>}
        </button>
      </form>

      {result && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${result.error ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
          {result.error && <p className="flex items-center gap-2 font-bold text-red-800"><Icon name="warning" size={15} /> {result.error}</p>}
          {result.created !== undefined && (
            <p className="flex items-center gap-2 font-bold text-green-800"><Icon name="check" size={15} /> استُوردت {result.created} بطاقة بنجاح — ستجدها في الروزنامة بحالة «فكرة»</p>
          )}
          {result.errors && result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-800">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
