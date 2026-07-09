"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

const LINKS: { href: string; label: string; icon: IconName; roles: string[] }[] = [
  { href: "/publish-due", label: "مستحق النشر", icon: "rocket", roles: ["admin", "supervisor", "publisher"] },
  { href: "/dashboard", label: "لوحة المعلومات", icon: "chart-bar", roles: ["admin", "supervisor", "writer", "designer", "publisher"] },
  { href: "/", label: "الروزنامة", icon: "calendar", roles: ["admin", "supervisor", "writer", "designer", "publisher"] },
  { href: "/board", label: "لوحة المهام", icon: "grid", roles: ["admin", "supervisor", "writer", "designer", "publisher"] },
  { href: "/approvals", label: "بانتظاري", icon: "check-circle", roles: ["admin", "supervisor"] },
  { href: "/media", label: "مكتبة الوسائط", icon: "image", roles: ["admin", "supervisor", "writer", "designer", "publisher"] },
  { href: "/search", label: "البحث", icon: "search", roles: ["admin", "supervisor", "writer", "designer", "publisher"] },
  { href: "/import", label: "استيراد روزنامة", icon: "import", roles: ["admin", "supervisor"] },
  { href: "/activity", label: "سجل النشاط", icon: "clock", roles: ["admin", "supervisor", "writer", "designer", "publisher"] },
];

export default function NavLinks({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {LINKS.filter((l) => l.roles.some((r) => roles.includes(r))).map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition max-lg:justify-center max-lg:px-2 ${
              active
                ? "bg-sand-500 font-bold text-navy-900"
                : "text-cream-50/85 hover:bg-navy-700"
            }`}
          >
            <Icon name={l.icon} size={18} />
            <span className="max-lg:hidden">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
