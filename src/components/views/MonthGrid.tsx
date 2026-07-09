"use client";

import type { ItemLite, OccasionLite } from "@/lib/types";
import { WEEKDAYS_AR, hijriLabel } from "@/lib/hijri";
import { groupByDay, occasionsOf, isWeekend, ItemChip, dropProps, dayKey } from "./shared";
import Icon from "../Icon";

export default function MonthGrid({
  cursor,
  items,
  occasions,
  onDrop,
  onOpen,
  onNote,
  onAddOnDay,
}: {
  cursor: Date;
  items: ItemLite[];
  occasions: OccasionLite[];
  onDrop: (itemId: string, dateISO: string) => void;
  onOpen: (id: string) => void;
  onNote: (item: ItemLite) => void;
  onAddOnDay?: (dateISO: string) => void;
}) {
  const byDay = groupByDay(items);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // الأحد = 0

  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();

  return (
    <div className="overflow-hidden rounded-xl border border-steel-300/70 bg-white shadow-sm">
      {/* أسماء الأيام */}
      <div className="grid grid-cols-7 border-b border-steel-300/70 bg-navy-900 text-center">
        {WEEKDAYS_AR.map((d) => (
          <div key={d} className="py-2.5 font-heading text-sm font-bold text-cream-50">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, idx) => {
          if (!date)
            return <div key={idx} className="min-h-28 border-b border-l border-steel-300/40 bg-cream-50/60 last:border-l-0" />;

          const k = dayKey(date);
          const dayItems = byDay.get(k) ?? [];
          const occ = occasionsOf(date, occasions);
          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();

          return (
            <div
              key={idx}
              {...dropProps(k, onDrop)}
              onClick={onAddOnDay ? () => onAddOnDay(k) : undefined}
              title={onAddOnDay ? "إضافة بطاقة في هذا اليوم" : undefined}
              className={`group relative min-h-28 border-b border-l border-steel-300/40 p-1.5 transition last:border-l-0 hover:bg-sand-100/40 ${
                onAddOnDay ? "cursor-pointer" : ""
              } ${isWeekend(date) ? "bg-sand-100/60" : "bg-white"} ${isToday ? "ring-2 ring-inset ring-sand-500" : ""}`}
            >
              <div className="mb-1 flex items-baseline justify-between">
                <span className={`font-heading text-sm font-bold ${isToday ? "rounded bg-sand-500 px-1.5 text-navy-900" : "text-navy-900"}`}>
                  {date.getDate()}
                </span>
                {onAddOnDay && (
                  <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sand-500 text-sm font-bold leading-none text-navy-900 opacity-0 transition group-hover:opacity-100" aria-hidden>
                    +
                  </span>
                )}
                <span className="text-[10px] text-steel-500">{hijriLabel(date)}</span>
              </div>

              {occ.map((o) => (
                <div
                  key={o.id}
                  className="mb-1 truncate rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: o.color ?? "#758694" }}
                >
                  <Icon name="star" size={10} /> {o.nameAr}
                </div>
              ))}

              <div className="flex flex-col gap-0.5">
                {dayItems.slice(0, 3).map((it) => (
                  <ItemChip key={it.id} item={it} onOpen={onOpen} onNote={onNote} />
                ))}
                {dayItems.length > 3 && (
                  <span className="px-1 text-[10px] font-bold text-steel-500">+{dayItems.length - 3} أخرى</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
