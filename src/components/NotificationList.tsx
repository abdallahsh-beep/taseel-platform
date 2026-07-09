"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionLite } from "@/lib/types";
import { markAllNotificationsRead } from "@/app/actions";
import CardModal from "./CardModal";
import Icon, { type IconName } from "./Icon";

const TYPE_ICONS: Record<string, IconName | "@"> = {
  assigned: "clipboard",
  mentioned: "@",
  approval_requested: "clock",
  approved: "check-circle",
  rejected: "undo",
  published: "rocket",
  commented: "comment",
  ready_for_design: "image",
  ready_for_writing: "edit",
};

type Row = { id: string; type: string; message: string; itemId: string | null; read: boolean; createdAt: string };

export default function NotificationList({ notifications, user }: { notifications: Row[]; user: SessionLite }) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-black text-navy-900">الإشعارات</h1>
          <p className="mt-1 text-sm text-steel-500">{unread > 0 ? `${unread} إشعار غير مقروء` : "كل الإشعارات مقروءة"}</p>
        </div>
        {unread > 0 && (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead();
                router.refresh();
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-navy-700 px-4 py-2 text-sm font-bold text-navy-700 transition hover:bg-navy-700 hover:text-cream-50 disabled:opacity-60"
          >
            <Icon name="check" size={15} /> تعليم الكل كمقروء
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-steel-300/60 bg-white shadow-sm">
        <ul className="divide-y divide-steel-300/30">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => n.itemId && setOpenItem(n.itemId)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-right transition hover:bg-cream-50 ${
                  n.read ? "" : "bg-sand-100/40"
                }`}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-50 text-base text-navy-700">
                  {TYPE_ICONS[n.type] === "@" ? (
                    "@"
                  ) : (
                    <Icon name={(TYPE_ICONS[n.type] ?? "bell") as IconName} size={16} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm leading-6 ${n.read ? "text-ink-900/80" : "font-bold text-navy-900"}`}>
                    {n.message}
                  </span>
                  <span className="text-[11px] text-steel-500">
                    {new Date(n.createdAt).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </span>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sand-500" />}
              </button>
            </li>
          ))}
          {notifications.length === 0 && (
            <li className="px-4 py-14 text-center text-steel-500">لا إشعارات بعد</li>
          )}
        </ul>
      </div>

      {openItem && <CardModal itemId={openItem} user={user} onClose={() => setOpenItem(null)} />}
    </div>
  );
}
