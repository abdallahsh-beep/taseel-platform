"use client";

import { useState } from "react";
import Icon from "./Icon";

// خريطة اختصارات نصية → إيموجي (مثل Planable ‏ :balloon: ← 🎈)
export const SHORTCODES: Record<string, string> = {
  balloon: "🎈", fire: "🔥", heart: "❤️", check: "✅", star: "⭐", tada: "🎉",
  book: "📖", books: "📚", bulb: "💡", rocket: "🚀", pray: "🤲", sparkles: "✨",
  sun: "☀️", moon: "🌙", calendar: "📅", pencil: "✏️", clap: "👏", "100": "💯",
  point_down: "👇", point_left: "👈", point_right: "👉", ok: "👌", muscle: "💪",
  graduation: "🎓", school: "🏫", mosque: "🕌", flag_sa: "🇸🇦", handshake: "🤝",
  bell: "🔔", megaphone: "📢", trophy: "🏆", target: "🎯", writing: "📝",
  smile: "🙂", thumbsup: "👍", eyes: "👀", gift: "🎁", checkered: "🏁",
};

// يحوّل أي :shortcode: مكتمل داخل النص إلى الإيموجي المقابل
export function expandShortcodes(text: string): string {
  return text.replace(/:([a-z0-9_]+):/gi, (m, code) => SHORTCODES[code.toLowerCase()] ?? m);
}

// لوحات إيموجي مختصرة مرتّبة (تكفي منشورات جمعية تعليمية)
const GROUPS: { label: string; items: string[] }[] = [
  { label: "شائع", items: ["😊", "🙂", "😍", "🤩", "👍", "👏", "🙏", "🤝", "💪", "🔥", "✨", "🎉", "❤️", "💯", "👀", "🎯"] },
  { label: "تعليم", items: ["📚", "📖", "✏️", "📝", "🎓", "🏫", "💡", "🔬", "🧠", "📐", "🧮", "🖊️", "📅", "⏰", "🏆", "🥇"] },
  { label: "رموز", items: ["✅", "⭐", "🌟", "💫", "📢", "🔔", "🎁", "🚀", "🕌", "🌙", "☀️", "🇸🇦", "👇", "👈", "👉", "➡️"] },
];

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="إدراج إيموجي"
        className="rounded-lg border border-steel-300 bg-white px-2 py-1.5 text-steel-500 hover:bg-cream-50 hover:text-navy-900"
      >
        <Icon name="smiley" size={18} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute z-[71] mt-1 w-64 rounded-xl border border-steel-300 bg-white p-2 shadow-2xl">
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-1">
                <div className="px-1 pb-1 text-[10px] font-bold text-steel-500">{g.label}</div>
                <div className="grid grid-cols-8 gap-0.5">
                  {g.items.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => { onPick(e); setOpen(false); }}
                      className="rounded p-1 text-lg leading-none hover:bg-cream-50"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="mt-1 border-t border-steel-300/50 px-1 pt-1 text-[10px] text-steel-500">
              نصياً: اكتب ‎:balloon:‎ ← 🎈 ، ‎:fire:‎ ← 🔥
            </p>
          </div>
        </>
      )}
    </div>
  );
}
