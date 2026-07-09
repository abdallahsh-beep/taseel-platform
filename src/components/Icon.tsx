import { ICONS, type IconName } from "./icons/generated";

// أيقونة خطية أحادية اللون من مجموعة أيقونات تأصيل (ترث اللون عبر currentColor).
// الاستخدام: <Icon name="bell" size={16} className="text-navy-900" />
export default function Icon({
  name,
  size = 18,
  className = "",
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  const ic = ICONS[name];
  if (!ic) return null;
  return (
    <svg
      viewBox={ic.vb}
      width={size}
      height={size}
      fill="none"
      className={`inline-block shrink-0 ${className}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : "") + ic.body }}
    />
  );
}

export type { IconName };
