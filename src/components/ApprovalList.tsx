"use client";

// عرض «بانتظاري» للمشرف (FR-18) — اعتماد سريع أو رفض بملاحظة أو فتح البطاقة

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionLite } from "@/lib/types";
import { approveItem, rejectItem } from "@/app/actions";
import { gregLabel, hijriLabel } from "@/lib/hijri";
import CardModal from "./CardModal";
import PlatformIcon from "./PlatformIcon";
import Icon from "./Icon";

type Row = {
  id: string;
  title: string;
  baseText: string;
  scheduledAt: string;
  categoryName: string;
  categoryColor: string;
  writerName: string | null;
  requestedBy: string;
  requestedAt: string | null;
  platforms: { key: string; name: string }[];
};

export default function ApprovalList({ items, user }: { items: Row[]; user: SessionLite }) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [returnTo, setReturnTo] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function doApprove(id: string) {
    startTransition(async () => {
      const res = await approveItem(id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function doReject(id: string) {
    startTransition(async () => {
      const res = await rejectItem(id, note, returnTo);
      if (res?.error) setError(res.error);
      else {
        setRejecting(null);
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">بانتظاري</h1>
        <p className="mt-1 text-sm text-steel-500">كل البطاقات المنتظرة اعتمادك — {items.length} بطاقة</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button onClick={() => setError(null)} className="font-bold"><Icon name="close" size={14} /></button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((it) => {
          const d = new Date(it.scheduledAt);
          return (
            <div key={it.id} className="rounded-xl border border-steel-300/60 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: it.categoryColor }}>
                      {it.categoryName}
                    </span>
                    <span className="text-xs text-steel-500">
                      موعد النشر: {gregLabel(d)} ({hijriLabel(d)})
                    </span>
                  </div>
                  <button onClick={() => setOpenItem(it.id)} className="font-heading text-lg font-bold text-navy-900 hover:underline">
                    {it.title}
                  </button>
                  {it.baseText && <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-6 text-ink-900/80">{it.baseText}</p>}
                  <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-steel-500">
                    <Icon name="edit" size={13} /> {it.writerName ?? "—"} · طلب الاعتماد: {it.requestedBy} · المنصات:
                    {it.platforms.map((p) => (
                      <PlatformIcon key={p.key} platform={p.key} size={14} />
                    ))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setOpenItem(it.id)}
                    className="rounded-lg border border-steel-300 px-3 py-2 text-sm font-bold text-navy-900 hover:bg-cream-50"
                  >
                    معاينة
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => doApprove(it.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60"
                  >
                    <Icon name="check" size={15} /> اعتماد
                  </button>
                  <button
                    onClick={() => setRejecting(rejecting === it.id ? null : it.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
                  >
                    <Icon name="close" size={15} /> رفض
                  </button>
                </div>
              </div>

              {rejecting === it.id && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="ملاحظة الرفض (إلزامية)..."
                    rows={2}
                    className="mb-2 w-full rounded border border-steel-300 bg-white px-2 py-1.5 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <select value={returnTo} onChange={(e) => setReturnTo(Number(e.target.value))} className="rounded border border-steel-300 bg-white px-2 py-1.5 text-sm">
                      <option value={2}>إرجاع إلى: جاري الكتابة</option>
                      <option value={3}>إرجاع إلى: قيد التصميم</option>
                    </select>
                    <button
                      disabled={pending || !note.trim()}
                      onClick={() => doReject(it.id)}
                      className="rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      تأكيد الرفض
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-steel-300 bg-white py-16 text-center text-steel-500">
            <Icon name="star" size={16} /> لا بطاقات بانتظار اعتمادك
          </div>
        )}
      </div>

      {openItem && <CardModal itemId={openItem} user={user} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
