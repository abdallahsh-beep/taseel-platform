"use client";

// معاينة المنشور كما سيظهر على المنصة (FR-10) — حساب الجمعية @j_taseel

import PlatformIcon from "./PlatformIcon";

function Avatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900">
      <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden>
        <path d="M4 4h24l8 10v22H22L4 18V4z" fill="#FBF6EF" />
        <path d="M10 30l10-10 10 10H10z" fill="#C1996B" />
      </svg>
    </div>
  );
}

function MediaPlaceholder() {
  return (
    <div className="pattern-bg mt-2 flex h-40 items-center justify-center rounded-lg bg-sand-100 text-sm text-sand-600">
      🖼️ التصميم المرفق يظهر هنا
    </div>
  );
}

export default function PostPreview({ platform, text }: { platform: string; text: string }) {
  const body = text.trim() || "— النص فارغ —";

  if (platform === "x") {
    return (
      <div className="rounded-xl border border-steel-300/60 bg-white p-4">
        <div className="flex gap-3">
          <Avatar />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-bold text-ink-900">تأصيل التعليمية</span>
              <span className="text-steel-500" dir="ltr">@j_taseel</span>
              <span className="text-steel-500">· الآن</span>
              <span className="mr-auto"><PlatformIcon platform="x" size={16} /></span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-ink-900">{body}</p>
            <MediaPlaceholder />
            <div className="mt-3 flex justify-between px-2 text-steel-500" dir="ltr">
              <span>💬 12</span><span>🔁 34</span><span>♥ 128</span><span>📊 2.4K</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "instagram") {
    return (
      <div className="overflow-hidden rounded-xl border border-steel-300/60 bg-white">
        <div className="flex items-center gap-2.5 p-3">
          <Avatar />
          <span className="text-sm font-bold">j_taseel</span>
          <span className="mr-auto flex items-center gap-2">
            <PlatformIcon platform="instagram" size={16} />
            <span className="text-steel-500">⋯</span>
          </span>
        </div>
        <div className="pattern-bg flex aspect-square items-center justify-center bg-sand-100 text-sand-600">
          🖼️ التصميم (1:1)
        </div>
        <div className="p-3 text-sm">
          <div className="mb-2 flex gap-3 text-lg"><span>♥</span><span>💬</span><span>✈</span></div>
          <p className="whitespace-pre-wrap leading-6">
            <span className="font-bold">j_taseel</span> {body}
          </p>
        </div>
      </div>
    );
  }

  if (platform === "facebook") {
    return (
      <div className="rounded-xl border border-steel-300/60 bg-white p-4">
        <div className="flex items-center gap-2.5">
          <Avatar />
          <div>
            <div className="text-sm font-bold">جمعية تأصيل التعليمية</div>
            <div className="text-xs text-steel-500">الآن · 🌐</div>
          </div>
          <span className="mr-auto"><PlatformIcon platform="facebook" size={18} /></span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6">{body}</p>
        <MediaPlaceholder />
        <div className="mt-3 flex justify-around border-t border-steel-300/40 pt-2 text-sm text-steel-500">
          <span>👍 أعجبني</span><span>💬 تعليق</span><span>↗ مشاركة</span>
        </div>
      </div>
    );
  }

  if (platform === "whatsapp") {
    return (
      <div className="overflow-hidden rounded-xl border border-steel-300/60 bg-[#ECE5DD]">
        <div className="flex items-center gap-2.5 bg-[#075E54] p-3 text-white">
          <Avatar />
          <div>
            <div className="text-sm font-bold">قناة تأصيل التعليمية</div>
            <div className="text-xs text-white/70">قناة · واتساب</div>
          </div>
          <span className="mr-auto"><PlatformIcon platform="whatsapp" size={18} mono className="text-white" /></span>
        </div>
        <div className="p-3">
          <div className="rounded-lg rounded-tr-none bg-white p-2.5 shadow-sm">
            <p className="whitespace-pre-wrap text-[15px] leading-6 text-ink-900">{body}</p>
            <MediaPlaceholder />
            <div className="mt-1 text-left text-[10px] text-steel-500">١٠:٣٠ ص ✓✓</div>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "telegram") {
    return (
      <div className="overflow-hidden rounded-xl border border-steel-300/60 bg-[#EEF3F6]">
        <div className="flex items-center gap-2.5 bg-[#26A5E4] p-3 text-white">
          <Avatar />
          <div>
            <div className="text-sm font-bold">قناة تأصيل التعليمية</div>
            <div className="text-xs text-white/80">قناة · تليجرام</div>
          </div>
          <span className="mr-auto"><PlatformIcon platform="telegram" size={18} mono className="text-white" /></span>
        </div>
        <div className="p-3">
          <div className="rounded-lg rounded-tl-none bg-white p-2.5 shadow-sm">
            <p className="whitespace-pre-wrap text-[15px] leading-6 text-ink-900">{body}</p>
            <MediaPlaceholder />
            <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-steel-500">
              <span>👁 1.2K</span><span>١٠:٣٠ ص</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // لينكد إن
  return (
    <div className="rounded-xl border border-steel-300/60 bg-white p-4">
      <div className="flex items-center gap-2.5">
        <Avatar />
        <div>
          <div className="text-sm font-bold">جمعية تأصيل التعليمية</div>
          <div className="text-xs text-steel-500">1,240 متابعًا · الآن</div>
        </div>
        <span className="mr-auto"><PlatformIcon platform="linkedin" size={18} /></span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-6">{body}</p>
      <MediaPlaceholder />
      <div className="mt-3 flex gap-4 border-t border-steel-300/40 pt-2 text-sm text-steel-500">
        <span>👍 إعجاب</span><span>💬 تعليق</span><span>🔁 إعادة نشر</span>
      </div>
    </div>
  );
}
