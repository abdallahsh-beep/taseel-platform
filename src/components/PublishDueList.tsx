"use client";

// «مستحق النشر» لمسؤول النشر (FR-34/35):
// المحتوى الجاهز مقسماً زمنياً: متأخر / اليوم / غداً / بقية هذا الأسبوع / لاحقاً،
// مع توثيق النشر برابط لكل منصة، وقائمة «قيد التجهيز هذا الأسبوع»

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionLite } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { publishItem } from "@/app/actions";
import { gregLabel, hijriLabel, WEEKDAYS_AR } from "@/lib/hijri";
import CardModal from "./CardModal";
import PlatformIcon from "./PlatformIcon";
import Icon, { type IconName } from "./Icon";

type Row = {
  id: string;
  title: string;
  baseText: string;
  scheduledAt: string;
  categoryName: string;
  categoryColor: string;
  variants: { id: string; platformKey: string; platformName: string }[];
};

type PrepRow = {
  id: string;
  title: string;
  scheduledAt: string;
  categoryColor: string;
  statusId: number;
  statusLabel: string;
};

type GroupKey = "overdue" | "today" | "tomorrow" | "week" | "later";

const GROUPS: { key: GroupKey; title: string; icon: IconName; tone: string }[] = [
  { key: "overdue", title: "متأخر عن موعده", icon: "warning", tone: "#B3402A" },
  { key: "today", title: "منشور اليوم", icon: "pin", tone: "#1B3347" },
  { key: "tomorrow", title: "منشور الغد", icon: "clock", tone: "#304F6D" },
  { key: "week", title: "منشورات هذا الأسبوع", icon: "calendar", tone: "#758694" },
  { key: "later", title: "لاحقاً", icon: "folder", tone: "#B4B6C5" },
];

function groupOf(iso: string, now: Date): GroupKey {
  const d = new Date(iso);
  if (d < now) return "overdue";
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startAfter = new Date(startToday); startAfter.setDate(startAfter.getDate() + 2);
  const weekEnd = new Date(startToday); weekEnd.setDate(weekEnd.getDate() + (7 - startToday.getDay()));
  if (d < startTomorrow) return "today";
  if (d < startAfter) return "tomorrow";
  if (d < weekEnd) return "week";
  return "later";
}

export default function PublishDueList({
  items,
  weekPrep,
  user,
}: {
  items: Row[];
  weekPrep: PrepRow[];
  user: SessionLite;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const now = new Date();
  const grouped = new Map<GroupKey, Row[]>();
  for (const it of items) {
    const g = groupOf(it.scheduledAt, now);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(it);
  }

  function doPublish(item: Row) {
    startTransition(async () => {
      const res = await publishItem(
        item.id,
        item.variants.map((v) => ({ variantId: v.id, url: links[v.id] ?? "" })),
      );
      if (res?.error) setError(res.error);
      else {
        setPublishing(null);
        setLinks({});
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">مستحق النشر</h1>
        <p className="mt-1 text-sm text-steel-500">
          المحتوى المعتمد «جاهز» مقسماً زمنياً — انشره على المنصة ثم وثّق الرابط هنا
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button onClick={() => setError(null)} className="font-bold"><Icon name="close" size={14} /></button>
        </div>
      )}

      {items.length === 0 && (
        <div className="mb-6 rounded-xl border border-dashed border-steel-300 bg-white py-14 text-center text-steel-500">
          لا يوجد محتوى جاهز بانتظار النشر حالياً
        </div>
      )}

      {GROUPS.map((g) => {
        const rows = grouped.get(g.key) ?? [];
        if (rows.length === 0) return null;
        return (
          <section key={g.key} className="mb-7">
            <div className="mb-3 flex items-center gap-2.5">
              <span style={{ color: g.tone }}><Icon name={g.icon} size={18} /></span>
              <h2 className="font-heading text-xl font-bold" style={{ color: g.tone }}>
                {g.title}
              </h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                style={{ background: g.tone }}
              >
                {rows.length}
              </span>
              <span className="h-px flex-1" style={{ background: `${g.tone}33` }} />
            </div>

            <div className="flex flex-col gap-3">
              {rows.map((it) => {
                const d = new Date(it.scheduledAt);
                return (
                  <div
                    key={it.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm ${
                      g.key === "overdue" ? "border-red-300 bg-red-50/40" : g.key === "today" ? "border-sand-500" : "border-steel-300/60"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: it.categoryColor }}>
                            {it.categoryName}
                          </span>
                        </div>
                        <button onClick={() => setOpenItem(it.id)} className="font-heading text-lg font-bold text-navy-900 hover:underline">
                          {it.title}
                        </button>
                        <p className="mt-1 text-xs text-steel-500">
                          <Icon name="clock" size={12} className="align-middle" /> {WEEKDAYS_AR[d.getDay()]} {gregLabel(d)} ({hijriLabel(d)}) —{" "}
                          {d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          <span className="mr-2 inline-flex items-center gap-1.5 align-middle">
                            المنصات:
                            {it.variants.map((v) => (
                              <PlatformIcon key={v.id} platform={v.platformKey} size={14} />
                            ))}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => setPublishing(publishing === it.id ? null : it.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-bold text-cream-50 hover:bg-navy-700"
                      >
                        <Icon name="rocket" size={15} /> توثيق النشر
                      </button>
                    </div>

                    {publishing === it.id && (
                      <div className="mt-3 rounded-lg border border-navy-700/20 bg-cream-50 p-3">
                        <p className="mb-2 text-xs font-bold text-navy-900">أدخل رابط المنشور المنشور فعلياً على كل منصة (إلزامي)</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          {it.variants.map((v) => (
                            <div key={v.id}>
                              <label className="mb-0.5 flex items-center gap-1 text-xs text-steel-500">
                                <PlatformIcon platform={v.platformKey} size={12} /> {v.platformName}
                              </label>
                              <input
                                dir="ltr"
                                placeholder="https://..."
                                value={links[v.id] ?? ""}
                                onChange={(e) => setLinks({ ...links, [v.id]: e.target.value })}
                                className="w-full rounded border border-steel-300 bg-white px-2 py-1.5 text-left text-sm"
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          disabled={pending}
                          onClick={() => doPublish(it)}
                          className="mt-3 rounded bg-navy-900 px-5 py-2 text-sm font-bold text-cream-50 disabled:opacity-60"
                        >
                          تأكيد — نقل إلى «منشور»
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* منشورات هذا الأسبوع التي ما تزال قيد التجهيز */}
      {weekPrep.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2.5">
            <Icon name="settings" size={18} className="text-steel-500" />
            <h2 className="font-heading text-xl font-bold text-steel-500">قيد التجهيز هذا الأسبوع</h2>
            <span className="rounded-full bg-steel-500 px-2.5 py-0.5 text-xs font-bold text-white">{weekPrep.length}</span>
            <span className="h-px flex-1 bg-steel-300/40" />
          </div>
          <p className="mb-3 text-xs text-steel-500">
            منشورات مجدولة خلال هذا الأسبوع لم تصل «جاهز» بعد — تابعها مع الفريق قبل مواعيدها
          </p>
          <div className="overflow-hidden rounded-xl border border-steel-300/50 bg-white">
            <ul className="divide-y divide-steel-300/30">
              {weekPrep.map((it) => {
                const d = new Date(it.scheduledAt);
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => setOpenItem(it.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-right text-sm transition hover:bg-cream-50"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.categoryColor }} />
                      <span className="truncate font-medium text-navy-900">{it.title}</span>
                      <span
                        className="shrink-0 rounded px-2 py-0.5 text-[11px] font-bold text-white"
                        style={{ background: STATUS_COLORS[it.statusId] }}
                      >
                        {it.statusLabel}
                      </span>
                      <span className="mr-auto shrink-0 text-xs text-steel-500">
                        {WEEKDAYS_AR[d.getDay()]} {d.getDate()}/{d.getMonth() + 1} — {hijriLabel(d)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {openItem && <CardModal itemId={openItem} user={user} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
