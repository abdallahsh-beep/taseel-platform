// شعار نصي مؤقت بهوية تأصيل — استبدله تلقائياً بوضع الملف الرسمي في public/brand/logo.png
import fs from "fs";
import path from "path";

export default function Logo({ light = false, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  const hasOfficial = fs.existsSync(path.join(process.cwd(), "public", "brand", "logo.png"));
  if (hasOfficial) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/brand/logo.png" alt="تأصيل التعليمية" className={size === "lg" ? "h-16 w-auto" : "h-10 w-auto"} />;
  }
  return (
    <div className="flex items-center gap-2.5">
      {/* أيقونة هندسية مستوحاة من علامة تأصيل */}
      <svg viewBox="0 0 40 40" className={size === "lg" ? "h-12 w-12" : "h-9 w-9"} aria-hidden>
        <path d="M4 4h24l8 10v22H22L4 18V4z" fill={light ? "#FBF6EF" : "#1B3347"} />
        <path d="M10 30l10-10 10 10H10z" fill="#C1996B" />
        <rect x="24" y="10" width="6" height="6" transform="rotate(45 27 13)" fill={light ? "#1B3347" : "#FBF6EF"} />
      </svg>
      <div className="leading-tight">
        <div
          className={`font-heading text-xl font-black ${light ? "text-cream-50" : "text-navy-900"} ${size === "lg" ? "text-3xl" : ""}`}
        >
          روزنامة تأصيل
        </div>
        <div className={`text-[11px] ${light ? "text-sand-300" : "text-steel-500"}`}>
          منصة إدارة المحتوى — تأصيل التعليمية
        </div>
      </div>
    </div>
  );
}
