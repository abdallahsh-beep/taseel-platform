// الشعار الرسمي لتأصيل — نسخة كحلية للخلفيات الفاتحة، ونسخة كريمية مقلوبة للخلفيات الداكنة.
// يُقدَّم من public/brand عبر CDN (لا قراءة نظام ملفات وقت التشغيل — آمن على Vercel).

export default function Logo({ light = false, size = "md" }: { light?: boolean; size?: "md" | "lg" }) {
  const file = light ? "logo-light.png" : "logo.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/${file}`}
      alt="تأصيل التعليمية"
      className={size === "lg" ? "h-16 w-auto" : "h-11 w-auto"}
    />
  );
}
