"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ItemLite, SessionLite } from "@/lib/types";
import ListTable from "./views/ListTable";
import CardModal from "./CardModal";
import QuickNote from "./QuickNote";
import Icon from "./Icon";

export default function SearchResults({
  query,
  results,
  user,
}: {
  query: string;
  results: ItemLite[];
  user: SessionLite;
}) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [noteItem, setNoteItem] = useState<ItemLite | null>(null);
  const [q, setQ] = useState(query);
  const router = useRouter();

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">البحث</h1>
        <p className="mt-1 text-sm text-steel-500">بحث شامل في العناوين والنصوص والهاشتاقات والتعليقات</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(q)}`);
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب كلمة بحث (حرفان فأكثر)..."
          autoFocus
          className="flex-1 rounded-xl border border-steel-300 bg-white px-4 py-3 outline-none focus:border-navy-700 focus:ring-2 focus:ring-navy-700/20"
        />
        <button className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-6 py-3 font-heading font-bold text-cream-50 hover:bg-navy-700">
          <Icon name="search" size={16} /> بحث
        </button>
      </form>

      {query.length >= 2 && (
        <p className="mb-3 text-sm text-steel-500">
          نتائج البحث عن «{query}»: <span className="font-bold text-navy-900">{results.length}</span> بطاقة
        </p>
      )}
      {query.length > 0 && query.length < 2 && (
        <p className="mb-3 text-sm text-red-700">اكتب حرفين على الأقل</p>
      )}

      {results.length > 0 && <ListTable items={results} onOpen={setOpenItem} onNote={setNoteItem} />}

      {query.length >= 2 && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-steel-300 bg-white py-16 text-center text-steel-500">
          لا نتائج مطابقة لبحثك
        </div>
      )}

      {openItem && <CardModal itemId={openItem} user={user} onClose={() => setOpenItem(null)} />}
      {noteItem && <QuickNote itemId={noteItem.id} title={noteItem.title} onClose={() => setNoteItem(null)} />}
    </div>
  );
}
