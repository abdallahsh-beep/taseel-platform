"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemLite, SessionLite } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import PlatformIcon from "./PlatformIcon";
import Icon from "./Icon";
import { STATUS, findTransition } from "@/lib/workflow";
import { moveItem } from "@/app/actions";
import { hijriLabel } from "@/lib/hijri";
import CardModal from "./CardModal";

const LOCK_HINTS: Record<number, string> = {
  [STATUS.READY]: "عبر الاعتماد فقط",
  [STATUS.PUBLISHED]: "عبر توثيق النشر فقط",
};

export default function Kanban({
  items,
  statuses,
  user,
}: {
  items: ItemLite[];
  statuses: { id: number; labelAr: string }[];
  user: SessionLite;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleDrop(statusId: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const itemId = e.dataTransfer.getData("text/item-id");
    const item = items.find((i) => i.id === itemId);
    if (!item || item.statusId === statusId) return;

    const t = findTransition(item.statusId, statusId);
    if (!t) return setError("انتقال غير مسموح في آلة الحالات");
    if (!t.roles.some((r) => user.roles.includes(r))) return setError("دورك لا يملك صلاحية هذا الانتقال");
    if (t.kind !== "move")
      return setError(
        t.kind === "approve"
          ? "الانتقال إلى «جاهز» يتم حصراً عبر إجراء الاعتماد داخل البطاقة"
          : t.kind === "publish"
            ? "الانتقال إلى «منشور» يتم حصراً عبر توثيق النشر داخل البطاقة"
            : "الإرجاع من الاعتماد يتطلب رفضاً بملاحظة داخل البطاقة",
      );

    startTransition(async () => {
      const res = await moveItem(itemId, statusId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">لوحة المهام</h1>
        <p className="mt-1 text-sm text-steel-500">
          اسحب البطاقات بين الأعمدة — الاعتماد والنشر محكومان بآلة الحالات ولا يتمان بالسحب
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button onClick={() => setError(null)} className="font-bold"><Icon name="close" size={14} /></button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {statuses.map((s) => {
          const colItems = items.filter((i) => i.statusId === s.id);
          return (
            <div
              key={s.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(s.id);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(s.id, e)}
              className={`flex w-64 shrink-0 flex-col rounded-xl border bg-white transition ${
                dragOver === s.id ? "border-sand-500 ring-2 ring-sand-500/40" : "border-steel-300/60"
              }`}
            >
              <div
                className="flex items-center justify-between rounded-t-xl px-3 py-2.5 text-white"
                style={{ background: STATUS_COLORS[s.id] }}
              >
                <span className="font-heading text-sm font-bold">{s.labelAr}</span>
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">{colItems.length}</span>
              </div>
              {LOCK_HINTS[s.id] && (
                <div className="flex items-center gap-1 border-b border-steel-300/40 bg-cream-50 px-3 py-1 text-[10px] text-steel-500">
                  <Icon name="lock" size={12} />
                  {LOCK_HINTS[s.id]}
                </div>
              )}

              <div className="flex min-h-40 flex-col gap-2 p-2">
                {colItems.map((it) => {
                  const d = new Date(it.scheduledAt);
                  return (
                    <button
                      key={it.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/item-id", it.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => setOpenItem(it.id)}
                      className="rounded-lg border border-steel-300/50 bg-cream-50/70 p-2.5 text-right shadow-sm transition hover:border-sand-500 hover:shadow"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: it.categoryColor }} />
                        <span className="text-[10px] font-bold text-steel-500">{it.categoryName}</span>
                        <span className="mr-auto flex items-center gap-1">
                          {it.platforms.map((p) => (
                            <PlatformIcon key={p} platform={p} size={12} />
                          ))}
                        </span>
                      </div>
                      <div className="text-sm font-bold leading-5 text-navy-900">{it.title}</div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-steel-500">
                        <span>
                          {d.getDate()}/{d.getMonth() + 1} — {hijriLabel(d)}
                          {it.commentCount > 0 && (
                            <span className="mr-1.5 inline-flex items-center gap-0.5 font-bold">
                              <Icon name="comment" size={12} />
                              {it.commentCount}
                            </span>
                          )}
                        </span>
                        {it.writerName && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sand-300 font-bold text-navy-900">
                            {it.writerName.slice(0, 1)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {colItems.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-steel-300/60 py-6 text-xs text-steel-300">
                    لا بطاقات
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openItem && <CardModal itemId={openItem} user={user} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
