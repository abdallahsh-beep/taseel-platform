"use client";

import type { ItemLite } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { hijriLabel, WEEKDAYS_AR, GREG_MONTHS_AR } from "@/lib/hijri";
import PlatformIcon from "@/components/PlatformIcon";
import Icon from "../Icon";

export default function ListTable({
  items,
  onOpen,
  onNote,
}: {
  items: ItemLite[];
  onOpen: (id: string) => void;
  onNote: (item: ItemLite) => void;
}) {
  const sorted = [...items].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div className="overflow-x-auto rounded-xl border border-steel-300/70 bg-white shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-navy-900 text-right text-cream-50">
            <th className="px-4 py-3 font-heading font-bold">التاريخ</th>
            <th className="px-4 py-3 font-heading font-bold">العنوان</th>
            <th className="px-4 py-3 font-heading font-bold">التصنيف</th>
            <th className="px-4 py-3 font-heading font-bold">المنصات</th>
            <th className="px-4 py-3 font-heading font-bold">الحالة</th>
            <th className="px-4 py-3 font-heading font-bold">الكاتب</th>
            <th className="px-4 py-3 font-heading font-bold">الملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((it, i) => {
            const d = new Date(it.scheduledAt);
            return (
              <tr
                key={it.id}
                onClick={() => onOpen(it.id)}
                className={`cursor-pointer border-t border-steel-300/40 transition hover:bg-sand-100/50 ${
                  i % 2 ? "bg-cream-50/60" : "bg-white"
                }`}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="font-bold text-navy-900">
                    {WEEKDAYS_AR[d.getDay()]} {d.getDate()} {GREG_MONTHS_AR[d.getMonth()]}
                  </div>
                  <div className="text-xs text-steel-500">{hijriLabel(d)}</div>
                </td>
                <td className="px-4 py-3 font-medium text-navy-900">{it.title}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-bold text-white"
                    style={{ background: it.categoryColor }}
                  >
                    {it.categoryName}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {it.platforms.map((p) => (
                      <PlatformIcon key={p} platform={p} size={16} />
                    ))}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className="rounded px-2 py-1 text-xs font-bold text-white"
                    style={{ background: STATUS_COLORS[it.statusId] }}
                  >
                    {it.statusLabel}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-steel-500">{it.writerName ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNote(it);
                    }}
                    title="إضافة ملاحظة سريعة"
                    className="inline-flex items-center gap-1 rounded-lg border border-steel-300/60 px-2.5 py-1 text-xs font-bold text-navy-700 transition hover:border-sand-500 hover:bg-sand-100/60"
                  >
                    <Icon name="note" size={13} /> {it.commentCount > 0 ? it.commentCount : "ملاحظة"}
                  </button>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-steel-500">
                لا توجد بطاقات مطابقة
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
