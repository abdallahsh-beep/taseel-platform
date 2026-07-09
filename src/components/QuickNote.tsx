"use client";

// نافذة ملاحظات سريعة على منشور من الروزنامة — نفس نظام تعليقات البطاقة
// (كل ما يُكتب هنا يظهر داخل البطاقة والعكس)

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment } from "@/app/actions";
import Icon from "./Icon";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function QuickNote({
  itemId,
  title,
  onClose,
}: {
  itemId: string;
  title: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<any[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function load() {
    const res = await fetch(`/api/item/${itemId}`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
    } else {
      setComments([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await addComment(itemId, text);
      if (res?.error) setError(res.error);
      else {
        setText("");
        setError(null);
        await load();
        router.refresh();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-navy-900 px-4 py-3 text-cream-50">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-sand-300"><Icon name="note" size={13} /> ملاحظات المنشور</div>
            <div className="truncate font-heading text-base font-bold">{title}</div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg px-2 py-0.5 hover:bg-navy-700"><Icon name="close" size={16} /></button>
        </div>

        <div className="max-h-64 overflow-y-auto p-4">
          {comments === null && <p className="py-4 text-center text-sm text-steel-500">جارٍ التحميل...</p>}
          {comments?.length === 0 && (
            <p className="py-4 text-center text-sm text-steel-500">لا ملاحظات بعد — كن أول من يضيف</p>
          )}
          <div className="flex flex-col gap-2">
            {comments?.map((c) => (
              <div key={c.id} className="rounded-lg border border-steel-300/50 bg-cream-50/70 p-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sand-500 text-[10px] font-bold text-navy-900">
                    {c.author.name.slice(0, 1)}
                  </span>
                  <span className="text-xs font-bold text-navy-900">{c.author.name}</span>
                  <span className="text-[10px] text-steel-500">
                    {new Date(c.createdAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink-900">{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="px-4 pb-1 text-xs text-red-700">{error}</p>}

        <div className="flex gap-2 border-t border-steel-300/40 p-3">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="اكتب ملاحظة... استخدم @الاسم للإشارة"
            className="flex-1 rounded-lg border border-steel-300 bg-cream-50 px-3 py-2 text-sm outline-none focus:border-navy-700"
          />
          <button
            disabled={pending || !text.trim()}
            onClick={submit}
            className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-bold text-cream-50 hover:bg-navy-900 disabled:opacity-50"
          >
            {pending ? "..." : "إضافة"}
          </button>
        </div>
      </div>
    </div>
  );
}
