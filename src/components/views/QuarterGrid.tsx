"use client";

// العرض الربع سنوي — محاكاة روزنامة تأصيل الورقية (FR-37):
// شبكة متصلة RTL بصفوف أيام متتالية، فواصل الشهور بطاقات ملونة داخل التدفق،
// تمييز الجمعة بلون كريمي، والتواريخ مولّدة آلياً.

import Icon from "../Icon";
import type { ItemLite, OccasionLite } from "@/lib/types";
import { WEEKDAYS_AR, GREG_MONTHS_AR, hijriParts } from "@/lib/hijri";
import { groupByDay, occasionsOf, isFriday, ItemChip, dropProps, dayKey } from "./shared";

const COLS = 10; // أعمدة الصف الواحد (الورقية ~12، خُفّضت قليلاً لوضوح الشاشة)
const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

type Cell =
  | { kind: "month"; month: number; year: number }
  | { kind: "day"; date: Date };

export default function QuarterGrid({
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
  const qStart = Math.floor(cursor.getMonth() / 3) * 3;

  // تدفق متصل: بطاقة شهر ثم أيامه، للأشهر الثلاثة
  const cells: Cell[] = [];
  for (let m = qStart; m < qStart + 3; m++) {
    cells.push({ kind: "month", month: m, year });
    const days = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) cells.push({ kind: "day", date: new Date(year, m, d) });
  }

  const monthTone = (m: number) =>
    m % 2 === 0 ? { bg: "#1B3347", fg: "#FBF6EF" } : { bg: "#C1996B", fg: "#1B3347" };

  return (
    <div className="rounded-xl border border-steel-300/70 bg-white p-3 shadow-sm">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {cells.map((cell, idx) => {
          if (cell.kind === "month") {
            const tone = monthTone(cell.month);
            const h = hijriParts(new Date(cell.year, cell.month, 15));
            return (
              <div
                key={idx}
                className="pattern-bg-light flex min-h-24 flex-col items-center justify-center rounded-lg p-1 text-center"
                style={{ background: tone.bg, color: tone.fg }}
              >
                <div className="font-heading text-2xl font-black leading-none">
                  {String(cell.month + 1).padStart(2, "0")}
                </div>
                <div className="mt-1 font-heading text-sm font-bold">شهر {GREG_MONTHS_AR[cell.month]}</div>
                <div className="mt-0.5 text-[10px] opacity-80">{HIJRI_MONTHS[h.month - 1]} {h.year}هـ</div>
              </div>
            );
          }

          const { date } = cell;
          const k = dayKey(date);
          const dayItems = byDay.get(k) ?? [];
          const occ = occasionsOf(date, occasions);
          const friday = isFriday(date);
          const h = hijriParts(date);

          return (
            <div
              key={idx}
              {...dropProps(k, onDrop)}
              onClick={onAddOnDay ? () => onAddOnDay(k) : undefined}
              title={onAddOnDay ? "إضافة بطاقة في هذا اليوم" : undefined}
              className={`group relative flex min-h-24 flex-col rounded-lg border p-1 transition hover:border-sand-500 ${
                onAddOnDay ? "cursor-pointer" : ""
              } ${friday ? "border-sand-300 bg-sand-100/80" : "border-steel-300/50 bg-cream-50/50"}`}
            >
              {onAddOnDay && (
                <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sand-500 text-xs font-bold leading-none text-navy-900 opacity-0 transition group-hover:opacity-100" aria-hidden>
                  +
                </span>
              )}
              <div className="mb-0.5 flex items-center justify-between px-0.5">
                <span className={`text-[10px] font-bold ${friday ? "text-sand-600" : "text-steel-500"}`}>
                  {WEEKDAYS_AR[date.getDay()]}
                </span>
                <span className="font-heading text-[11px] font-bold text-navy-900" dir="ltr">
                  {date.getFullYear()}/{date.getMonth() + 1}/{date.getDate()}
                </span>
              </div>
              <div className="px-0.5 text-right text-[9px] text-steel-500">{h.day} {HIJRI_MONTHS[h.month - 1]}</div>

              {occ.map((o) => (
                <div
                  key={o.id}
                  title={o.nameAr}
                  className="mt-0.5 truncate rounded px-1 text-[9px] font-bold text-white"
                  style={{ background: o.color ?? "#758694" }}
                >
                  <Icon name="star" size={9} className="ml-0.5 inline-block align-[-1px]" /> {o.nameAr}
                </div>
              ))}

              <div className="mt-0.5 flex flex-col gap-0.5">
                {dayItems.slice(0, 2).map((it) => (
                  <ItemChip key={it.id} item={it} onOpen={onOpen} onNote={onNote} compact />
                ))}
                {dayItems.length > 2 && (
                  <span className="px-1 text-[9px] font-bold text-steel-500">+{dayItems.length - 2}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[11px] text-steel-500">
        شبكة متصلة على نسق روزنامة تأصيل الورقية — التواريخ الهجرية والميلادية مولّدة آلياً (تقويم أم القرى)
      </p>
    </div>
  );
}
