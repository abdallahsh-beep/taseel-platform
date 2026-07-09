"use client";

import type { ItemLite, OccasionLite } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { hijriParts } from "@/lib/hijri";
import PlatformIcon from "@/components/PlatformIcon";
import Icon from "../Icon";

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function groupByDay(items: ItemLite[]) {
  const map = new Map<string, ItemLite[]>();
  for (const it of items) {
    const k = dayKey(new Date(it.scheduledAt));
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

export function occasionsOf(date: Date, occasions: OccasionLite[]) {
  const h = hijriParts(date);
  return occasions.filter((o) => {
    if (o.specificDate) {
      const d = new Date(o.specificDate);
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
    }
    if (o.gregMonth && o.gregDay) return o.gregMonth === date.getMonth() + 1 && o.gregDay === date.getDate();
    if (o.hijriMonth && o.hijriDay) return o.hijriMonth === h.month && o.hijriDay === h.day;
    return false;
  });
}

export function isFriday(d: Date) {
  return d.getDay() === 5;
}
export function isWeekend(d: Date) {
  return d.getDay() === 5 || d.getDay() === 6;
}

/** شريحة بطاقة داخل خلية يوم — النقر يفتح البطاقة، وزر 📝 يفتح الملاحظات السريعة */
export function ItemChip({
  item,
  onOpen,
  onNote,
  compact = false,
}: {
  item: ItemLite;
  onOpen: (id: string) => void;
  onNote?: (item: ItemLite) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/item-id", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item.id);
      }}
      onKeyDown={(e) => e.key === "Enter" && onOpen(item.id)}
      title={`${item.title} — ${item.statusLabel}`}
      className={`group flex w-full cursor-pointer items-center gap-1 rounded px-1.5 text-right text-[11px] leading-5 transition hover:brightness-95 ${compact ? "py-0" : "py-0.5"}`}
      style={{ background: `${item.categoryColor}22`, borderRight: `3px solid ${item.categoryColor}` }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: STATUS_COLORS[item.statusId] }}
        title={item.statusLabel}
      />
      <span className="truncate font-medium text-navy-900">{item.title}</span>
      {!compact && (
        <span className="mr-auto flex shrink-0 items-center gap-0.5">
          {item.platforms.slice(0, 3).map((p) => (
            <PlatformIcon key={p} platform={p} size={10} />
          ))}
        </span>
      )}
      {item.commentCount > 0 && (
        <span className={`flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-steel-500 ${compact ? "mr-auto" : ""}`} title={`${item.commentCount} ملاحظة`}>
          <Icon name="comment" size={12} />{item.commentCount}
        </span>
      )}
      {onNote && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNote(item);
          }}
          title="إضافة ملاحظة سريعة"
          className={`shrink-0 rounded px-0.5 transition hover:bg-white/70 ${compact && item.commentCount === 0 ? "mr-auto" : ""}`}
        >
          <Icon name="note" size={12} />
        </button>
      )}
    </div>
  );
}

/** خصائص خلية قابلة للإفلات */
export function dropProps(dateISO: string, onDrop: (itemId: string, dateISO: string) => void) {
  return {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/item-id");
      if (id) onDrop(id, dateISO);
    },
  };
}
